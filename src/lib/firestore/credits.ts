// Credit transactions and session completion.
import { collection, doc, getDocs, addDoc, increment, query, runTransaction, serverTimestamp, updateDoc, where, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Session, CreditTransaction } from '../../types';
import { toDate } from './shared';
import { notifyUser } from './notifications';

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

export const DEFAULT_CREDITS_PER_SESSION = 10;

/** Credits per session from the admin setting, or the default when unset or invalid. */
export function resolveCreditAmount(settingsValue: unknown): number {
  return typeof settingsValue === 'number' && Number.isInteger(settingsValue) && settingsValue > 0
    ? settingsValue
    : DEFAULT_CREDITS_PER_SESSION;
}

export async function completeSessionWithCredits(session: Session): Promise<void> {
  await completeSessionWithCreditsById(session.id);
}

/**
 * Complete a session and move credits from the learner to the teacher, in one transaction.
 *
 * The project runs without Cloud Functions, so this happens in the browser and
 * firestore.rules check every write: only the learner (who pays), only after the start
 * time, exactly the configured amount, once. Increments are used so the learner never
 * needs to read the teacher's private balance.
 */
export async function completeSessionWithCreditsById(sessionId: string): Promise<{ status: 'completed' | 'already_completed'; amount?: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in again.');
  const sessionRef = doc(db, 'sessions', sessionId);

  const result = await runTransaction(db, async transaction => {
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists()) throw new Error('Session not found.');
    const session = sessionSnapshot.data();
    if (session.status === 'completed') return { status: 'already_completed' as const };
    if (uid !== session.learnerId) throw new Error('Only the learner can confirm this session is complete.');
    if (session.status !== 'scheduled') throw new Error('This session is no longer available for completion.');
    if (toDate(session.scheduledAt).getTime() > Date.now()) throw new Error('You can complete a session after its scheduled time.');

    const settings = await transaction.get(doc(db, 'settings', 'platform'));
    const amount = resolveCreditAmount(settings.data()?.creditsPerSession);
    const learner = await transaction.get(doc(db, 'users', uid));
    const learnerCredits = typeof learner.data()?.credits === 'number' ? learner.data()!.credits : 0;
    if (learnerCredits < amount) throw new Error(`You need ${amount} credits to complete this session, but you have ${learnerCredits}.`);

    const skill = String(session.skill || 'session');
    transaction.update(sessionRef, { status: 'completed', creditsExchanged: amount, completedBy: uid, completedAt: serverTimestamp() });
    transaction.update(doc(db, 'users', session.teacherId), { credits: increment(amount), totalSessions: increment(1), lastCreditSessionId: sessionId });
    transaction.update(doc(db, 'users', uid), { credits: increment(-amount), totalSessions: increment(1), lastCreditSessionId: sessionId });
    transaction.set(doc(db, 'transactions', `tx-${sessionId}-teacher`), {
      userId: session.teacherId, amount, type: 'earned_teaching', sessionId, timestamp: serverTimestamp(),
      description: `Taught ${skill} to ${String(session.learnerName || 'learner')}`.slice(0, 200),
    });
    transaction.set(doc(db, 'transactions', `tx-${sessionId}-learner`), {
      userId: uid, amount: -amount, type: 'spent_learning', sessionId, timestamp: serverTimestamp(),
      description: `Learned ${skill} from ${String(session.teacherName || 'teacher')}`.slice(0, 200),
    });
    return { status: 'completed' as const, amount, teacherId: String(session.teacherId), skill };
  });

  if (result.status === 'completed') {
    // Keep the public session counts in step (best effort; the rules only accept the private value).
    await Promise.all([result.teacherId, uid].map(userId =>
      updateDoc(doc(db, 'publicProfiles', userId), { totalSessions: increment(1) }).catch(() => undefined)));
    await notifyUser({
      userId: result.teacherId,
      type: 'session_completed',
      title: 'Session completed',
      body: `Your ${result.skill} session was completed. You earned ${result.amount} credits.`,
      link: '/profile',
      source: { sessionId },
    });
    return { status: 'completed', amount: result.amount };
  }
  return result;
}
