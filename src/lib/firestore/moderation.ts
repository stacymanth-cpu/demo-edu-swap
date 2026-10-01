// Reports, blocking and skill verification requests.
import { collection, doc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserReport, SkillVerification } from '../../types';
import { updateUser } from './users';

export async function submitReport(data: Omit<UserReport, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'reports'), {
    ...data,
    status: 'open',
    createdAt: Timestamp.fromDate(new Date()),
  });
  return docRef.id;
}

export async function blockUser(userId: string, blockedUserId: string): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', userId));
  const blocked = Array.isArray(userSnap.data()?.blockedUserIds) ? userSnap.data()?.blockedUserIds : [];
  if (!blocked.includes(blockedUserId)) {
    await updateUser(userId, { blockedUserIds: [...blocked, blockedUserId] });
  }
}

export async function requestSkillVerification(data: Omit<SkillVerification, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'skillVerifications'), {
    ...data,
    status: 'pending',
    createdAt: Timestamp.fromDate(new Date()),
  });
  return docRef.id;
}
