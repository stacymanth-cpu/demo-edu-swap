// Scheduled learning sessions.
import { collection, doc, getDocs, updateDoc, addDoc, query, where, onSnapshot, serverTimestamp, Timestamp, type DocumentData, type Unsubscribe, type QueryDocumentSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { auth, db } from '../firebase';
import type { Session } from '../../types';
import { toDate } from './shared';
import { notifyUser } from './notifications';

export async function getSessions(uid: string): Promise<Session[]> {
  const q1 = query(collection(db, 'sessions'), where('teacherId', '==', uid));
  const q2 = query(collection(db, 'sessions'), where('learnerId', '==', uid));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const allDocs = [...snap1.docs, ...snap2.docs];
  // Deduplicate by id
  const seen = new Set<string>();
  return allDocs
    .filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    })
    .map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        scheduledAt: toDate(data.scheduledAt),
      } as Session;
    });
}

/** Subscribe to sessions where the student is teaching or learning. */
export function subscribeSessions(uid: string, callback: (sessions: Session[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const teacherQuery = query(collection(db, 'sessions'), where('teacherId', '==', uid));
  const learnerQuery = query(collection(db, 'sessions'), where('learnerId', '==', uid));
  let teacherDocs: QueryDocumentSnapshot[] = [];
  let learnerDocs: QueryDocumentSnapshot[] = [];

  const publish = () => {
    const seen = new Set<string>();
    const sessions = [...teacherDocs, ...learnerDocs]
      .filter(d => !seen.has(d.id) && Boolean(seen.add(d.id)))
      .map(d => ({ ...d.data(), id: d.id, scheduledAt: toDate(d.data().scheduledAt) } as Session))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    callback(sessions);
  };

  const handleError = (error: Error) => onError?.(error);
  const stopTeacher = onSnapshot(teacherQuery, snapshot => { teacherDocs = snapshot.docs; publish(); }, handleError);
  const stopLearner = onSnapshot(learnerQuery, snapshot => { learnerDocs = snapshot.docs; publish(); }, handleError);
  return () => { stopTeacher(); stopLearner(); };
}

export async function getAllSessions(): Promise<Session[]> {
  const snap = await getDocs(collection(db, 'sessions'));
  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    scheduledAt: toDate(d.data().scheduledAt),
  } as Session));
}

export async function updateSession(sessionId: string, data: Partial<Session>): Promise<void> {
  const updateData: DocumentData = { ...data };
  if (data.scheduledAt) {
    updateData.scheduledAt = Timestamp.fromDate(data.scheduledAt);
  }
  await updateDoc(doc(db, 'sessions', sessionId), updateData);
}

const defaultBeforeSessionChecklist = {
  scheduling: false,
  reminders: false,
  goals: false,
  profiles: false,
  confirmation: false,
};

export async function createSession(data: Omit<Session, 'id'>): Promise<string> {
  if (!auth.currentUser) throw new Error('Please sign in to schedule a session.');
  const creatorId = auth.currentUser.uid;
  const scheduledAt = data.scheduledAt instanceof Date ? data.scheduledAt : new Date();
  const docRef = await addDoc(collection(db, 'sessions'), {
    ...data,
    createdBy: creatorId,
    scheduledAt: Timestamp.fromDate(scheduledAt),
    beforeSessionChecklist: data.beforeSessionChecklist ?? defaultBeforeSessionChecklist,
  });
  await notifyUser({
    id: `session-${docRef.id}`,
    userId: data.teacherId === creatorId ? data.learnerId : data.teacherId,
    type: 'session_upcoming',
    title: 'Session scheduled',
    body: `${data.skill || 'A session'} is scheduled for ${format(scheduledAt, 'EEE d MMM, h:mm a')}.`,
    link: '/sessions',
    source: { sessionId: docRef.id },
  });
  return docRef.id;
}

export const MAX_CANCELLATION_REASON_LENGTH = 500;

/**
 * Cancel a scheduled session before it starts and tell the other participant.
 * The rules allow only participants, only before the start time, and require a reason.
 */
export async function cancelSession(session: Session, cancelledBy: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('Please provide a cancellation reason.');
  if (trimmed.length > MAX_CANCELLATION_REASON_LENGTH) throw new Error(`Cancellation reason must be ${MAX_CANCELLATION_REASON_LENGTH} characters or fewer.`);
  if (session.status !== 'scheduled') throw new Error('This session can no longer be cancelled.');
  if (session.scheduledAt.getTime() <= Date.now()) throw new Error('This session has already started. Schedule a new session instead.');

  await updateDoc(doc(db, 'sessions', session.id), {
    status: 'cancelled',
    cancelledBy,
    cancellationReason: trimmed,
    cancelledAt: serverTimestamp(),
  });
  await notifyUser({
    userId: session.teacherId === cancelledBy ? session.learnerId : session.teacherId,
    type: 'session_cancelled',
    title: 'Session cancelled',
    body: `${session.skill || 'Your'} session was cancelled: ${trimmed}`,
    link: '/sessions',
    source: { sessionId: session.id },
  });
}
