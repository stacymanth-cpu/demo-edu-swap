// Session reviews.
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Session, Comment } from '../../types';
import { writeAuditLog } from './admin';
import { toDate } from './shared';

export async function getComments(): Promise<Comment[]> {
  const snap = await getDocs(collection(db, 'comments'));
  return snap.docs.filter(d => d.data().moderationStatus !== 'removed').map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      timestamp: toDate(data.timestamp),
    } as Comment;
  });
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
  await updateDoc(doc(db, 'comments', commentId), {
    moderationStatus: 'removed',
    moderatedAt: Timestamp.fromDate(new Date()),
  });
  await writeAuditLog({ adminId, action: 'review_removed', targetId: commentId, details: 'Review hidden by administrator' });
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
  // The onCommentWritten Cloud Function recalculates the target's rating.
  const reviewId = `${data.sessionId}_${data.userId}`;
  await setDoc(doc(db, 'comments', reviewId), {
    ...data,
    text,
    verifiedSession: true,
    skill: data.skill || session.skill,
    timestamp: Timestamp.fromDate(data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp)),
  });
  return reviewId;
}
