// In-app notifications.
import { collection, doc, getDocs, updateDoc, addDoc, query, where, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Notification } from '../../types';
import { toDate } from './shared';

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
