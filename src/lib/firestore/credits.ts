// Credit transactions and session completion.
import { collection, getDocs, addDoc, query, where, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import type { Session, CreditTransaction } from '../../types';
import { toDate } from './shared';

export async function getTransactions(uid: string): Promise<CreditTransaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      timestamp: toDate(data.timestamp),
    } as CreditTransaction;
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Subscribe to a student's credit activity for live profile updates. */
export function subscribeTransactions(uid: string, callback: (transactions: CreditTransaction[]) => void): Unsubscribe {
  const q = query(collection(db, 'transactions'), where('userId', '==', uid));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs
      .map(d => ({ ...d.data(), id: d.id, timestamp: toDate(d.data().timestamp) } as CreditTransaction))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  });
}

export async function getAllTransactions(): Promise<CreditTransaction[]> {
  const snap = await getDocs(collection(db, 'transactions'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: toDate(d.data().timestamp) } as CreditTransaction));
}

export async function createTransaction(data: Omit<CreditTransaction, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'transactions'), {
    ...data,
    timestamp: Timestamp.fromDate(data.timestamp instanceof Date ? data.timestamp : new Date()),
  });
  return docRef.id;
}

/**
 * Complete a session via a trusted Cloud Function, which validates the session,
 * transfers credits, writes the ledger entries and updates session counts.
 */
export async function completeSessionWithCredits(session: Session): Promise<void> {
  await completeSessionWithCreditsById(session.id);
}

export async function completeSessionWithCreditsById(sessionId: string): Promise<void> {
  const complete = httpsCallable<{ sessionId: string }, { status: 'completed' | 'already_completed'; amount?: number }>(functions, 'completeSession');
  await complete({ sessionId });
}
