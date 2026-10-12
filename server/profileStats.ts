// Keeps publicStats/{uid} (the progress report on each profile) up to date.
// Matches and sessions are private to their participants, so other students cannot count
// them; the server, with Firebase Admin, recomputes a student's report whenever one of their
// matches, sessions or reviews changes. The rules let students read publicStats but never write it.
import { FieldValue, getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { computeProfileStats, type MatchRecord, type ReviewRecord, type SessionRecord } from './profileStatsRules';

const toDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date(0));

const toMatch = (d: DocumentData): MatchRecord => ({
  user1Id: String(d.user1Id ?? ''), user2Id: String(d.user2Id ?? ''),
  user1Teaches: d.user1Teaches, user2Teaches: d.user2Teaches,
  status: String(d.status ?? ''), createdAt: toDate(d.createdAt),
});
const toSession = (d: DocumentData): SessionRecord => ({
  teacherId: String(d.teacherId ?? ''), learnerId: String(d.learnerId ?? ''), skill: d.skill,
  status: String(d.status ?? ''), scheduledAt: toDate(d.scheduledAt),
  completedAt: d.completedAt ? toDate(d.completedAt) : undefined,
  durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : undefined,
});
const toReview = (d: DocumentData): ReviewRecord => ({
  userId: String(d.userId ?? ''), targetUserId: String(d.targetUserId ?? ''),
  rating: Number(d.rating), skill: d.skill, at: toDate(d.timestamp),
  removed: d.moderationStatus === 'removed',
});

export async function refreshProfileStats(uid: string): Promise<void> {
  const db = getFirestore();
  const [m1, m2, s1, s2, r1, r2] = await Promise.all([
    db.collection('matches').where('user1Id', '==', uid).get(),
    db.collection('matches').where('user2Id', '==', uid).get(),
    db.collection('sessions').where('teacherId', '==', uid).get(),
    db.collection('sessions').where('learnerId', '==', uid).get(),
    db.collection('comments').where('targetUserId', '==', uid).get(),
    db.collection('comments').where('userId', '==', uid).get(),
  ]);
  const matches = [...m1.docs, ...m2.docs].map(doc => toMatch(doc.data()));
  const sessions = [...new Map([...s1.docs, ...s2.docs].map(doc => [doc.id, doc])).values()].map(doc => toSession(doc.data()));
  const reviews = [...r1.docs, ...r2.docs].map(doc => toReview(doc.data()));
  const stats = computeProfileStats(uid, matches, sessions, reviews);
  await db.collection('publicStats').doc(uid).set({ ...stats, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Watches matches, sessions and reviews and refreshes the summary of every student involved in a
 * change, batching bursts with a short delay. The first snapshots include every document, so
 * all summaries are rebuilt when the server starts. Returns a function that stops watching.
 */
export function startProfileStats(): () => void {
  const db = getFirestore();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const flush = async () => {
    timer = null;
    if (running) { schedule(); return; }
    running = true;
    const uids = [...pending];
    pending.clear();
    for (const uid of uids) {
      try { await refreshProfileStats(uid); } catch (error) { console.error(`[profile-stats] could not refresh ${uid}:`, error); }
    }
    running = false;
  };
  const schedule = () => { if (!timer) timer = setTimeout(() => void flush(), 500); };
  const touch = (ids: unknown[]) => { ids.forEach(id => { if (typeof id === 'string' && id) pending.add(id); }); schedule(); };

  const stopMatches = db.collection('matches').onSnapshot(
    snap => snap.docChanges().forEach(ch => touch([ch.doc.get('user1Id'), ch.doc.get('user2Id')])),
    error => console.error('[profile-stats] stopped watching matches:', error));
  const stopSessions = db.collection('sessions').onSnapshot(
    snap => snap.docChanges().forEach(ch => touch([ch.doc.get('teacherId'), ch.doc.get('learnerId')])),
    error => console.error('[profile-stats] stopped watching sessions:', error));
  const stopReviews = db.collection('comments').onSnapshot(
    snap => snap.docChanges().forEach(ch => touch([ch.doc.get('targetUserId'), ch.doc.get('userId')])),
    error => console.error('[profile-stats] stopped watching reviews:', error));

  console.log('[profile-stats] watching matches, sessions and reviews');
  return () => { stopMatches(); stopSessions(); stopReviews(); if (timer) clearTimeout(timer); };
}
