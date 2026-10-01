// Chat rooms, messages, presence and shared documents.
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, deleteField, query, setDoc, where, orderBy, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { ChatRoom, ChatMessage } from '../../types';
import { toDate } from './shared';
import { notifyUser } from './notifications';
import { dataUrlToBlob, readChunksAsBlob, readFileAsBase64, splitIntoChunks, temporaryObjectUrl, withTimeout, writeChunks } from './fileChunks';

export async function getChatRooms(uid: string): Promise<ChatRoom[]> {
  const q = query(
    collection(db, 'chatRooms'),
    where('participants', 'array-contains', uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      lastMessageAt: toDate(data.lastMessageAt),
    } as ChatRoom;
  });
}

export function subscribeToChatRooms(
  uid: string,
  callback: (rooms: ChatRoom[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'chatRooms'),
    where('participants', 'array-contains', uid)
  );
  return onSnapshot(q, snap => {
    const rooms = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        lastMessageAt: toDate(data.lastMessageAt),
      } as ChatRoom;
    });
    callback(rooms);
  });
}

/**
 * Create a chat room between two users if one doesn't already exist.
 * Returns the room ID.
 */
export async function getOrCreateChatRoom(
  user1Id: string, user1Name: string,
  user2Id: string, user2Name: string,
  matchId: string
): Promise<string> {
  // Check if a room already exists between these users
  const existing = await getChatRooms(user1Id);
  const found = existing.find(r => r.participants.includes(user2Id));
  if (found) return found.id;

  // Create a new chat room
  // Firestore rules only allow new rooms between students with an accepted match.
  const roomData = {
    matchId,
    participants: [user1Id, user2Id],
    participantNames: { [user1Id]: user1Name, [user2Id]: user2Name },
    lastMessage: '',
    lastMessageAt: Timestamp.fromDate(new Date()),
    unreadCount: { [user1Id]: 0, [user2Id]: 0 },
  };
  const docRef = await addDoc(collection(db, 'chatRooms'), roomData);
  return docRef.id;
}

export async function getChatMessages(roomId: string): Promise<ChatMessage[]> {
  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      timestamp: toDate(data.timestamp),
      deliveredAt: data.deliveredAt ? toDate(data.deliveredAt) : undefined,
      readAt: data.readAt ? toDate(data.readAt) : undefined,
      editedAt: data.editedAt ? toDate(data.editedAt) : undefined,
      deletedAt: data.deletedAt ? toDate(data.deletedAt) : undefined,
    } as ChatMessage;
  });
}

export function subscribeToChatMessages(
  roomId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        timestamp: toDate(data.timestamp),
        deliveredAt: data.deliveredAt ? toDate(data.deliveredAt) : undefined,
        readAt: data.readAt ? toDate(data.readAt) : undefined,
        editedAt: data.editedAt ? toDate(data.editedAt) : undefined,
        deletedAt: data.deletedAt ? toDate(data.deletedAt) : undefined,
      } as ChatMessage;
    });
    callback(msgs);
  });
}

export async function sendChatMessage(roomId: string, message: Omit<ChatMessage, 'id'>): Promise<void> {
  const messageRef = await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
    ...message,
    timestamp: Timestamp.fromDate(message.timestamp instanceof Date ? message.timestamp : new Date()),
  });

  const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
  const recipientId = roomSnap.data()?.participants?.find((id: string) => id !== message.senderId);
  await updateDoc(doc(db, 'chatRooms', roomId), {
    lastMessage: message.text,
    lastMessageAt: Timestamp.fromDate(new Date()),
    ...(recipientId ? { [`unreadCount.${recipientId}`]: (roomSnap.data()?.unreadCount?.[recipientId] || 0) + 1 } : {}),
    [`typingBy.${message.senderId}`]: false,
  });

  if (recipientId) {
    await notifyUser({
      id: `message-${messageRef.id}`,
      userId: recipientId,
      type: 'message',
      title: `New message from ${auth.currentUser?.displayName || 'your chat partner'}`,
      body: message.fileName ? `Shared a file: ${message.fileName}` : message.text || 'You received a new message',
      link: '/chat',
      source: { roomId },
    });
  }
}

export async function editChatMessage(roomId: string, messageId: string, text: string): Promise<void> {
  const cleanText = text.trim();
  if (!auth.currentUser || !cleanText || cleanText.length > 5000) throw new Error('Enter a message of 1 to 5,000 characters.');
  const messageRef = doc(db, 'chatRooms', roomId, 'messages', messageId);
  const snapshot = await getDoc(messageRef);
  if (!snapshot.exists() || snapshot.data().senderId !== auth.currentUser.uid || snapshot.data().deletedAt) {
    throw new Error('This message can no longer be edited.');
  }
  const data = snapshot.data();
  if (data.linkUrl || data.fileUrl || data.sharedNote) throw new Error('Only text messages can be edited.');
  await updateDoc(messageRef, { text: cleanText, editedAt: Timestamp.fromDate(new Date()) });
}

export async function deleteChatMessage(roomId: string, messageId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Please sign in to delete a message.');
  const messageRef = doc(db, 'chatRooms', roomId, 'messages', messageId);
  const snapshot = await getDoc(messageRef);
  if (!snapshot.exists() || snapshot.data().senderId !== auth.currentUser.uid) {
    throw new Error('Only the sender can delete this message.');
  }
  await updateDoc(messageRef, {
    text: 'This message was deleted',
    deletedAt: Timestamp.fromDate(new Date()),
    linkUrl: deleteField(),
    linkTitle: deleteField(),
    fileUrl: deleteField(),
    fileName: deleteField(),
    fileType: deleteField(),
    fileSize: deleteField(),
    sharedNote: deleteField(),
  });
}

export async function setChatTyping(roomId: string, userId: string, isTyping: boolean): Promise<void> {
  await updateDoc(doc(db, 'chatRooms', roomId), { [`typingBy.${userId}`]: isTyping });
}

export async function markChatMessagesRead(roomId: string, userId: string, messages: ChatMessage[]): Promise<void> {
  const receivedMessages = messages.filter(message => message.senderId !== userId && (!message.deliveredAt || !message.isRead));
  if (receivedMessages.length === 0) return;
  await Promise.all(receivedMessages.map(message => updateDoc(doc(db, 'chatRooms', roomId, 'messages', message.id), {
    deliveredAt: Timestamp.fromDate(message.deliveredAt || new Date()),
    ...(!message.isRead ? { isRead: true, readAt: Timestamp.fromDate(new Date()) } : {}),
  })));
  if (receivedMessages.some(message => !message.isRead)) {
    await updateDoc(doc(db, 'chatRooms', roomId), { [`unreadCount.${userId}`]: 0 });
  }
}

export function subscribeUserPresence(userId: string, callback: (presence: { isOnline: boolean; lastSeen: Date | null }) => void): Unsubscribe {
  return onSnapshot(doc(db, 'publicProfiles', userId), snapshot => {
    const data = snapshot.data();
    callback({ isOnline: data?.isOnline ?? false, lastSeen: data?.lastSeen ? toDate(data.lastSeen) : null });
  });
}


// ─── Shared chat files ──────────────────────────────────────────────
// Files are stored in Firestore (see ./fileChunks) under chatRooms/{roomId}/files/{fileId},
// readable by the two participants. The message keeps its usual fileUrl field, holding an
// internal reference ("eduswap-file:{fileId}") instead of a Storage download link.

export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;
// A 10 MB file is about 14 million base64 characters, which needs 20 chunks.
export const CHAT_FILE_MAX_CHUNKS = 20;
const CHAT_FILE_REFERENCE_PREFIX = 'eduswap-file:';

// Decided by extension because browsers often leave File.type empty for Office documents.
const CHAT_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const CHAT_FILE_EXTENSIONS = Object.keys(CHAT_FILE_TYPES);

export function getChatFileContentType(fileName: string): string | null {
  return CHAT_FILE_TYPES[fileName.split('.').pop()?.toLowerCase() || ''] || null;
}

/**
 * Files the app must open itself rather than with a plain link: Firestore-stored files, and
 * older messages that embedded the file as a data: URL (browsers block opening those in a tab).
 */
export const isChatFileReference = (fileUrl?: string) => Boolean(fileUrl?.startsWith(CHAT_FILE_REFERENCE_PREFIX) || fileUrl?.startsWith('data:'));

export async function uploadChatDocument(
  roomId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}> {
  const contentType = getChatFileContentType(file.name);
  const uploaderId = auth.currentUser?.uid;
  if (!uploaderId) throw new Error('Please sign in again to share files.');
  if (!contentType) throw new Error('Choose a PDF, document, presentation, spreadsheet, text file, or image.');
  if (file.size === 0) throw new Error('The selected file is empty.');
  if (file.size > CHAT_FILE_MAX_BYTES) throw new Error('Files must be 10 MB or smaller.');

  onProgress?.(2);
  const chunks = splitIntoChunks(await readFileAsBase64(file));
  if (chunks.length > CHAT_FILE_MAX_CHUNKS) throw new Error('Files must be 10 MB or smaller.');

  const fileRef = doc(collection(db, 'chatRooms', roomId, 'files'));
  await writeChunks(fileRef, chunks, fraction => onProgress?.(Math.round(fraction * 95)));
  await withTimeout(setDoc(fileRef, {
    uploaderId,
    fileName: file.name.slice(0, 200),
    contentType,
    size: file.size,
    chunkCount: chunks.length,
    createdAt: Timestamp.fromDate(new Date()),
  }), 30_000, 'The upload timed out. Check your connection and try again.');
  onProgress?.(100);

  return {
    fileUrl: `${CHAT_FILE_REFERENCE_PREFIX}${fileRef.id}`,
    fileName: file.name,
    fileType: contentType,
    fileSize: file.size,
  };
}

/** Rebuild a shared chat file and return a temporary URL that opens or downloads it. */
export async function getChatFileUrl(roomId: string, fileUrl: string): Promise<string> {
  if (fileUrl.startsWith('data:')) return temporaryObjectUrl(dataUrlToBlob(fileUrl));
  if (!isChatFileReference(fileUrl)) return fileUrl;
  const fileRef = doc(db, 'chatRooms', roomId, 'files', fileUrl.slice(CHAT_FILE_REFERENCE_PREFIX.length));
  const data = (await getDoc(fileRef)).data();
  if (!data || typeof data.chunkCount !== 'number') throw new Error('This file is no longer available.');
  return temporaryObjectUrl(await readChunksAsBlob(fileRef, data.chunkCount, data.contentType || 'application/octet-stream'));
}
