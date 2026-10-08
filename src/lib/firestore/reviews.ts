// Session reviews.
import { collection, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc, query, where, onSnapshot, Timestamp, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Session, Comment } from '../../types';
import { writeAuditLog } from './admin';
import { toDate } from './shared';

function toComments(docs: QueryDocumentSnapshot[]): Comment[] {
  return docs.filter(d => d.data().moderationStatus !== 'removed').map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      timestamp: toDate(data.timestamp),
    } as Comment;
  });
}

/** Every review in the app. Only admin moderation needs this; pages use the targeted reads below. */
export async function getComments(): Promise<Comment[]> {
  const snap = await getDocs(collection(db, 'comments'));
  return toComments(snap.docs);
}

// Firestore accepts at most 30 values in an `in` filter.
const IN_FILTER_LIMIT = 30;

/** Reviews written about any of these students. */
export async function getReviewsAbout(userIds: string[]): Promise<Comment[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_LIMIT) batches.push(ids.slice(i, i + IN_FILTER_LIMIT));
  const snaps = await Promise.all(batches.map(batch =>
    getDocs(query(collection(db, 'comments'), where('targetUserId', 'in', batch)))));
  return snaps.flatMap(snap => toComments(snap.docs));
}

/** Reviews this student has written. */
export async function getReviewsBy(userId: string): Promise<Comment[]> {
  const snap = await getDocs(query(collection(db, 'comments'), where('userId', '==', userId)));
  return toComments(snap.docs);
}

/** Subscribe to reviews received by a specific student. */
export function subscribeUserReviews(userId: string, callback: (comments: Comment[]) => void): Unsubscribe {
  const q = query(collection(db, 'comments'), where('targetUserId', '==', userId));
  return onSnapshot(q, snapshot => {
    const comments = snapshot.docs
      .filter(d => d.data().moderationStatus !== 'removed')
      .map(d => ({ ...d.data(), id: d.id, timestamp: toDate(d.data().timestamp) } as Comment))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    callback(comments);
  });
}

export async function getAdminComments(): Promise<Comment[]> {
  return getComments();
}

export async function removeComment(adminId: string, commentId: string): Promise<void> {
  const commentRef = doc(db, 'comments', commentId);
  const targetUserId = (await getDoc(commentRef)).data()?.targetUserId;
  await updateDoc(commentRef, {
    moderationStatus: 'removed',
    moderatedAt: Timestamp.fromDate(new Date()),
  });
  await writeAuditLog({ adminId, action: 'review_removed', targetId: commentId, details: 'Review hidden by administrator' });
  // A hidden review no longer counts towards the student's rating.
  if (typeof targetUserId === 'string' && targetUserId) await recalculateRating(targetUserId);
}
export async function createComment(data: Omit<Comment, 'id'> & { sessionId: string }): Promise<string> {
  const text = data.text.trim();
  if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be a whole number from 1 to 5.');
  }
  if (text.length < 8 || text.length > 1000) {
    throw new Error('Review must be between 8 and 1000 characters.');
  }

  const sessionSnapshot = await getDoc(doc(db, 'sessions', data.sessionId));
  if (!sessionSnapshot.exists()) throw new Error('The reviewed session does not exist.');
  const session = sessionSnapshot.data() as Session;
  if (session.status !== 'completed') throw new Error('Reviews are only available after completed sessions.');
  const participantIds = [session.teacherId, session.learnerId];
  if (!participantIds.includes(data.userId) || !participantIds.includes(data.targetUserId || '') || data.userId === data.targetUserId) {
    throw new Error('Only session participants can review each other.');
  }

  const existingSnapshot = await getDocs(query(collection(db, 'comments'), where('sessionId', '==', data.sessionId)));
  const alreadyReviewed = existingSnapshot.docs.some(review => review.data().userId === data.userId && review.data().moderationStatus !== 'removed');
  if (alreadyReviewed) throw new Error('You have already reviewed this session.');

  // The id makes the review unique per reviewer and session; the rules enforce it.
  // The review, the reviewed student's running totals and their average rating are written
  // together; the rules accept the totals only if they add exactly this review's stars.
  const reviewId = `${data.sessionId}_${data.userId}`;
  const targetUserId = data.targetUserId || '';
  const summaryRef = doc(db, 'ratingSummaries', targetUserId);
  const rating = await runTransaction(db, async transaction => {
    const summary = await transaction.get(summaryRef);
    const count = (summary.data()?.count ?? 0) + 1;
    const total = (summary.data()?.total ?? 0) + data.rating;
    transaction.set(doc(db, 'comments', reviewId), {
      ...data,
      text,
      verifiedSession: true,
      skill: data.skill || session.skill,
      timestamp: Timestamp.fromDate(data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp)),
    });
    transaction.set(summaryRef, { count, total, lastCommentId: reviewId });
    const average = averageFromTotals(count, total);
    transaction.update(doc(db, 'users', targetUserId), { rating: average });
    return average;
  });
  // The public copy may only hold the private value, so a stale profile simply keeps its old rating.
  await updateDoc(doc(db, 'publicProfiles', targetUserId), { rating }).catch(() => undefined);
  return reviewId;
}

/** Average rating rounded to two decimals; must match ratingFromSummary in firestore.rules. */
export function averageFromTotals(count: number, total: number): number {
  return count > 0 ? Math.round((total * 100) / count) / 100 : 0;
}

/** Admin: rebuild a student's rating from their visible reviews (used after moderation). */
export async function recalculateRating(userId: string): Promise<void> {
  const reviews = await getDocs(query(collection(db, 'comments'), where('targetUserId', '==', userId)));
  const ratings = reviews.docs
    .filter(review => review.data().moderationStatus !== 'removed')
    .map(review => review.data().rating)
    .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 5);
  const count = ratings.length;
  const total = ratings.reduce((sum, value) => sum + value, 0);
  const rating = averageFromTotals(count, total);
  await setDoc(doc(db, 'ratingSummaries', userId), { count, total, lastCommentId: '' });
  await updateDoc(doc(db, 'users', userId), { rating });
  await updateDoc(doc(db, 'publicProfiles', userId), { rating }).catch(() => undefined);
}
