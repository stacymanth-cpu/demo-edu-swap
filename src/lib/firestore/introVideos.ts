// Introduction videos recorded in the app and stored in Firestore (no Firebase Storage on
// the Spark plan). Clips are short and low-bitrate, then saved as base64 chunks under
// introVideos/{uid}/chunks/{index} (see ./fileChunks). The parent document records who may
// watch, and firestore.rules enforce it:
//   members  → any signed-in student
//   matches  → students in allowedViewerIds (accepted matches when the video was saved)
//   private  → only the owner (and admins)
// The profile's introductionVideoUrl holds a marker ("eduswap-video:{uid}"), not a link.
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../../types';
import { readChunksAsBlob, readFileAsBase64, splitIntoChunks, temporaryObjectUrl, withTimeout, writeChunks } from './fileChunks';
import { getMatches } from './matches';

export const INTRO_VIDEO_MAX_SECONDS = 60;
export const INTRO_VIDEO_MAX_BYTES = 8 * 1024 * 1024;
// An 8 MB clip is about 11.2 million base64 characters: 16 chunks of 700k.
export const INTRO_VIDEO_MAX_CHUNKS = 16;
export const INTRO_VIDEO_TYPES = ['video/webm', 'video/mp4'];
const INTRO_VIDEO_MARKER = 'eduswap-video:';

type Visibility = NonNullable<User['introductionVideoVisibility']>;

export const isStoredIntroVideo = (url?: string) => Boolean(url?.startsWith(INTRO_VIDEO_MARKER));

/** Accepted match partners, who may watch a "matches only" video. */
async function getAllowedViewerIds(uid: string, visibility: Visibility): Promise<string[]> {
  if (visibility !== 'matches') return [];
  const matches = await getMatches(uid);
  return Array.from(new Set(matches
    .filter(match => match.status === 'accepted')
    .map(match => (match.user1Id === uid ? match.user2Id : match.user1Id))
    .filter(Boolean))).slice(0, 200);
}

/** Save a recorded clip and return the marker to store in introductionVideoUrl. */
export async function saveIntroVideo(uid: string, file: Blob, visibility: Visibility, onProgress?: (progress: number) => void): Promise<string> {
  const contentType = file.type.split(';')[0];
  if (!INTRO_VIDEO_TYPES.includes(contentType)) throw new Error('This video format is not supported. Please record again.');
  if (file.size === 0) throw new Error('The recording is empty. Please record again.');
  if (file.size > INTRO_VIDEO_MAX_BYTES) throw new Error('The recording is too large. Please record a shorter introduction.');

  onProgress?.(2);
  const chunks = splitIntoChunks(await readFileAsBase64(file as File));
  if (chunks.length > INTRO_VIDEO_MAX_CHUNKS) throw new Error('The recording is too large. Please record a shorter introduction.');

  const parentRef = doc(db, 'introVideos', uid);
  await writeChunks(parentRef, chunks, fraction => onProgress?.(Math.round(fraction * 92)));
  // Remove chunks left over from a previous, longer video.
  await Promise.all(Array.from({ length: INTRO_VIDEO_MAX_CHUNKS - chunks.length }, (_, offset) =>
    deleteDoc(doc(parentRef, 'chunks', String(chunks.length + offset))).catch(() => undefined)));

  await withTimeout(setDoc(parentRef, {
    contentType,
    size: file.size,
    chunkCount: chunks.length,
    visibility,
    allowedViewerIds: await getAllowedViewerIds(uid, visibility),
    updatedAt: Timestamp.fromDate(new Date()),
  }), 30_000, 'The video uploaded, but could not be finalised. Please try again.');
  onProgress?.(100);
  return `${INTRO_VIDEO_MARKER}${uid}`;
}

/** Apply a new visibility to an existing video (also refreshes the list of matches). */
export async function updateIntroVideoAccess(uid: string, visibility: Visibility): Promise<void> {
  const parentRef = doc(db, 'introVideos', uid);
  if (!(await getDoc(parentRef)).exists()) return;
  await updateDoc(parentRef, {
    visibility,
    allowedViewerIds: await getAllowedViewerIds(uid, visibility),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

/**
 * A temporary URL to play a student's introduction video, or null when there is none or
 * the viewer is not allowed to watch it (the rules refuse the read).
 */
export async function getIntroVideoUrl(uid: string): Promise<string | null> {
  const parentRef = doc(db, 'introVideos', uid);
  try {
    const data = (await getDoc(parentRef)).data();
    if (!data || typeof data.chunkCount !== 'number') return null;
    return temporaryObjectUrl(await readChunksAsBlob(parentRef, data.chunkCount, data.contentType || 'video/webm'));
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') return null;
    throw error;
  }
}
