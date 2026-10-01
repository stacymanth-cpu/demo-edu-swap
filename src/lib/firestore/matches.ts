// Skill-exchange match requests.
import { collection, doc, getDocs, updateDoc, addDoc, query, where, onSnapshot, Timestamp, type DocumentData, type Unsubscribe, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { User, SkillMatch } from '../../types';
import { sanitizeForFirestore, toDate } from './shared';
import { getAllUsers } from './users';
import { notifyUser } from './notifications';

export async function getMatches(uid: string): Promise<SkillMatch[]> {
  // Get matches where user is either user1 or user2
  const q1 = query(collection(db, 'matches'), where('user1Id', '==', uid));
  const q2 = query(collection(db, 'matches'), where('user2Id', '==', uid));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const allDocs = [...snap1.docs, ...snap2.docs];
  const allUsers = await getAllUsers();
  const userMap = new Map(allUsers.map(u => [u.uid, u]));

  return allDocs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      user1: userMap.get(data.user1Id) || {} as User,
      user2: userMap.get(data.user2Id) || {} as User,
      createdAt: toDate(data.createdAt),
      learnerId: data.learnerId,
      teacherId: data.teacherId,
      requestedAt: data.requestedAt ? toDate(data.requestedAt) : undefined,
      requestedSkill: data.requestedSkill,
      offeredSkill: data.offeredSkill,
      learningGoal: data.learningGoal,
      meetingLink: data.meetingLink,
      requestNotes: data.requestNotes,
    } as SkillMatch;
  });
}

/** Keep a user's match list current when either participant accepts or declines a request. */
export function subscribeMatches(uid: string, callback: (matches: SkillMatch[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q1 = query(collection(db, 'matches'), where('user1Id', '==', uid));
  const q2 = query(collection(db, 'matches'), where('user2Id', '==', uid));
  let firstDocs: QueryDocumentSnapshot[] = [];
  let secondDocs: QueryDocumentSnapshot[] = [];
  let disposed = false;

  const publish = async () => {
    const users = await getAllUsers();
    if (disposed) return;
    const usersById = new Map(users.map(user => [user.uid, user]));
    callback([...firstDocs, ...secondDocs].map(matchDoc => {
      const data = matchDoc.data();
      return {
        ...data,
        id: matchDoc.id,
        user1: usersById.get(data.user1Id) || {} as User,
        user2: usersById.get(data.user2Id) || {} as User,
        createdAt: toDate(data.createdAt),
        requestedAt: data.requestedAt ? toDate(data.requestedAt) : undefined,
      } as SkillMatch;
    }));
  };

  const handleError = (error: Error) => onError?.(error);
  const stopFirst = onSnapshot(q1, snapshot => { firstDocs = snapshot.docs; void publish(); }, handleError);
  const stopSecond = onSnapshot(q2, snapshot => { secondDocs = snapshot.docs; void publish(); }, handleError);
  return () => { disposed = true; stopFirst(); stopSecond(); };
}

export async function getAllMatches(): Promise<SkillMatch[]> {
  const snap = await getDocs(collection(db, 'matches'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as SkillMatch));
}

export async function createMatch(data: Omit<SkillMatch, 'id' | 'user1' | 'user2'>): Promise<string> {
  const normalized = {
    user1Id: data.user1Id || '',
    user2Id: data.user2Id || '',
    user1Teaches: data.user1Teaches || '',
    user2Teaches: data.user2Teaches || '',
    status: data.status || 'pending',
    createdAt: Timestamp.fromDate(data.createdAt instanceof Date ? data.createdAt : new Date()),
    requestedAt: data.requestedAt ? Timestamp.fromDate(data.requestedAt instanceof Date ? data.requestedAt : new Date(data.requestedAt)) : undefined,
    learnerId: data.learnerId,
    teacherId: data.teacherId,
    requestedSkill: data.requestedSkill,
    offeredSkill: data.offeredSkill,
    learningGoal: data.learningGoal,
    meetingLink: data.meetingLink,
    requestNotes: data.requestNotes,
  };

  const payload = sanitizeForFirestore(normalized) as DocumentData;

  if (!payload.user1Id || !payload.user2Id || !payload.user1Teaches || !payload.user2Teaches) {
    throw new Error('Match request is missing required fields.');
  }

  const docRef = await addDoc(collection(db, 'matches'), payload);
  await notifyUser({
    id: `match-${docRef.id}`,
    userId: payload.user2Id,
    type: 'match_request',
    title: 'New match request',
    body: payload.requestedSkill ? `Someone would like to learn ${payload.requestedSkill} with you.` : 'Someone would like to exchange skills with you.',
    link: '/matches',
    source: { matchId: docRef.id },
  });
  return docRef.id;
}

export async function updateMatchStatus(matchId: string, status: SkillMatch['status']): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId), { status });
}
