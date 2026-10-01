// Student registration documents.
//
// Documents are stored in Firestore (see ./fileChunks) rather than Firebase Storage so the
// project can stay on the free Spark plan. Chunks live under
// privateRegistrationDocuments/{uid}/chunks/{index}; the parent document describing the file
// is written last, so an admin never sees a partly uploaded document. Older uploads that
// point at Storage (storagePath) still open.
import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { updateUser } from './users';
import { CHUNK_CHARS, readChunksAsBlob, readFileAsBase64, splitIntoChunks, temporaryObjectUrl, withTimeout, writeChunks } from './fileChunks';

export const REGISTRATION_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const REGISTRATION_MAX_BYTES = 5 * 1024 * 1024;
export const REGISTRATION_CHUNK_CHARS = CHUNK_CHARS;
// Enough chunks for a 5 MB file once base64-encoded (about 6.7 million characters).
export const REGISTRATION_MAX_CHUNKS = 10;
export { splitIntoChunks };

export async function uploadRegistrationDocument(uid: string, file: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!REGISTRATION_ALLOWED_TYPES.includes(file.type)) throw new Error('Upload a PDF, JPG, or PNG registration document.');
  if (file.size === 0) throw new Error('The selected document is empty. Please choose another file.');
  if (file.size > REGISTRATION_MAX_BYTES) throw new Error('Registration documents must be 5 MB or smaller.');

  onProgress?.(2);
  const chunks = splitIntoChunks(await readFileAsBase64(file));
  if (chunks.length > REGISTRATION_MAX_CHUNKS) throw new Error('Registration documents must be 5 MB or smaller.');

  const parentRef = doc(db, 'privateRegistrationDocuments', uid);
  await writeChunks(parentRef, chunks, fraction => onProgress?.(Math.round(fraction * 90)));

  // Remove chunks left over from a previous, larger upload.
  await Promise.all(
    Array.from({ length: REGISTRATION_MAX_CHUNKS - chunks.length }, (_, offset) =>
      deleteDoc(doc(parentRef, 'chunks', String(chunks.length + offset))).catch(() => undefined)),
  );

  await withTimeout(Promise.all([
    setDoc(parentRef, {
      storage: 'firestore',
      fileName: file.name.slice(0, 200),
      contentType: file.type,
      size: file.size,
      chunkCount: chunks.length,
      updatedAt: Timestamp.fromDate(new Date()),
    }),
    updateUser(uid, {
      registrationVerificationStatus: 'pending',
      studentVerified: false,
    }),
  ]), 30_000, 'The document uploaded, but verification could not be submitted. Check your connection and try again.');

  onProgress?.(100);
  return `firestore:${uid}`;
}

/** A URL the admin can open to view a student's registration document, or null if none. */
export async function getAdminRegistrationDocumentUrl(uid: string): Promise<string | null> {
  const parentRef = doc(db, 'privateRegistrationDocuments', uid);
  const data = (await getDoc(parentRef)).data();
  if (!data) return null;

  if (data.storage === 'firestore' && typeof data.chunkCount === 'number' && data.chunkCount > 0) {
    return temporaryObjectUrl(await readChunksAsBlob(parentRef, data.chunkCount, data.contentType || 'application/pdf'));
  }

  // Documents uploaded before the switch to Firestore live in Firebase Storage.
  if (typeof data.storagePath === 'string' && data.storagePath) {
    return getDownloadURL(ref(storage, data.storagePath));
  }
  return null;
}
