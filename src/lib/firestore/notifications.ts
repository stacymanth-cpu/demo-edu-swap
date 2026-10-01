// In-app notifications.
import { collection, doc, getDocs, updateDoc, addDoc, query, where, onSnapshot, serverTimestamp, setDoc, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Notification, NotificationType } from '../../types';
import { toDate } from './shared';

/** The record a browser-sent notification must point at, so the rules can check sender and recipient are linked. */
export type NotificationSource =
  | { roomId: string }
  | { matchId: string }
  | { sessionId: string }
  | { groupRoomId: string };

/**
 * Notify another student from the browser (the project runs without Cloud Functions).
 * Best effort: the action that triggered it has already succeeded, so failures are only logged.
 * Pass `id` to make the notification unique per source (e.g. one per message).
 */
export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  source: NotificationSource;
  id?: string;
}): Promise<void> {
  const senderId = auth.currentUser?.uid;
  if (!senderId || !params.userId || params.userId === senderId) return;
  const payload = {
    userId: params.userId,
    senderId,
    type: params.type,
    title: params.title.slice(0, 120),
    body: params.body.slice(0, 300),
    read: false,
    createdAt: serverTimestamp(),
    ...(params.link ? { link: params.link.slice(0, 300) } : {}),
    ...params.source,
  };
  try {
    if (params.id) await setDoc(doc(db, 'notifications', params.id), payload);
    else await addDoc(collection(db, 'notifications'), payload);
  } catch (error) {
    console.warn('Could not send notification:', error);
  }
}

export async function createNotification(data: Omit<Notification, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'notifications'), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
  });
  return docRef.id;
}

export async function getNotifications(uid: string): Promise<Notification[]> {
  const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid)));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Notification))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function subscribeNotifications(uid: string, callback: (notifications: Notification[]) => void): Unsubscribe {
  const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(notificationsQuery, snapshot => {
    callback(snapshot.docs
      .map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Notification))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}
