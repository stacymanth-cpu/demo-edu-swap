// Scheduled learning sessions.
import { collection, doc, getDocs, updateDoc, addDoc, query, where, onSnapshot, Timestamp, type DocumentData, type Unsubscribe, type QueryDocumentSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import type { Session } from '../../types';
import { toDate } from './shared';

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
  // The onSessionCreated Cloud Function notifies the other participant.
  const docRef = await addDoc(collection(db, 'sessions'), {
    ...data,
    createdBy: auth.currentUser.uid,
    scheduledAt: Timestamp.fromDate(data.scheduledAt instanceof Date ? data.scheduledAt : new Date()),
    beforeSessionChecklist: data.beforeSessionChecklist ?? defaultBeforeSessionChecklist,
  });
  return docRef.id;
}

/** Cancel via a trusted Cloud Function, which also notifies the other participant. */
export async function cancelSession(session: Session, _cancelledBy: string, reason: string): Promise<void> {
  const cancel = httpsCallable<{ sessionId: string; reason: string }, { status: 'cancelled' }>(functions, 'cancelSession');
  await cancel({ sessionId: session.id, reason: reason.trim() });
}
