import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import {
  SessionRuleError,
  averageRating,
  planCompletion,
  resolveCreditAmount,
  validateCancellation,
  type SessionSnapshot,
} from './sessionRules.js';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();

export const onChatMessageCreated = onDocumentCreated('chatRooms/{roomId}/messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message || typeof message.senderId !== 'string') return;
  const roomSnapshot = await db.doc(`chatRooms/${event.params.roomId}`).get();
  const participants = roomSnapshot.data()?.participants;
  if (!Array.isArray(participants) || !participants.includes(message.senderId)) return;
  const recipientId = participants.find((participantId: unknown) => participantId !== message.senderId);
  if (typeof recipientId !== 'string') return;

  await db.collection('notifications').doc(`message-${event.params.messageId}`).set({
    userId: recipientId,
    type: 'message',
    title: 'New message',
    body: String(message.text || 'You received a new message').slice(0, 120),
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    link: `/chat?room=${event.params.roomId}`,
  }, { merge: true });
});

// Notifications are written here, not in the browser: the rules only let
// trusted code create them, so users cannot send fake alerts to each other.
// Document ids are derived from the source document so retried triggers
// overwrite instead of duplicating.

export const onMatchCreated = onDocumentCreated('matches/{matchId}', async (event) => {
  const match = event.data?.data();
  if (!match || typeof match.user2Id !== 'string' || !match.user2Id) return;

  await db.collection('notifications').doc(`match-${event.params.matchId}`).set({
    userId: match.user2Id,
    type: 'match_request',
    title: 'New match request',
    body: 'Someone would like to exchange skills with you.',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    link: '/matches',
  });
});

export const onSessionCreated = onDocumentCreated('sessions/{sessionId}', async (event) => {
  const session = event.data?.data();
  if (!session) return;
  const recipientId = session.createdBy === session.teacherId ? session.learnerId : session.teacherId;
  if (typeof recipientId !== 'string' || !recipientId) return;
  const scheduledAt = session.scheduledAt instanceof Timestamp ? session.scheduledAt.toDate() : null;

  await db.collection('notifications').doc(`session-${event.params.sessionId}`).set({
    userId: recipientId,
    type: 'session_upcoming',
    title: 'Session scheduled',
    body: `${String(session.skill || 'A session')} is scheduled${scheduledAt ? ` for ${scheduledAt.toUTCString()}` : ''}.`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    link: '/sessions',
  });
});

export const onGroupCallRoomCreated = onDocumentCreated('groupCallRooms/{roomId}', async (event) => {
  const room = event.data?.data();
  if (!room || !Array.isArray(room.participants)) return;
  const title = String(room.title || 'An EduSwap group call').slice(0, 120);
  const batch = db.batch();
  for (const userId of new Set(room.participants)) {
    if (typeof userId !== 'string' || userId === room.hostId) continue;
    batch.set(db.collection('notifications').doc(`group-${event.params.roomId}-${userId}`), {
      userId,
      type: 'system',
      title: 'Group call invitation',
      body: `${title} is ready to join.`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      link: `/group-call?room=${encodeURIComponent(event.params.roomId)}&title=${encodeURIComponent(title)}`,
    });
  }
  await batch.commit();
});

/** Keep a user's average rating in sync when a review is added or removed by moderation. */
export const onCommentWritten = onDocumentWritten('comments/{commentId}', async (event) => {
  const targetIds = new Set<string>();
  for (const data of [event.data?.before.data(), event.data?.after.data()]) {
    if (typeof data?.targetUserId === 'string' && data.targetUserId) targetIds.add(data.targetUserId);
  }

  for (const targetUserId of targetIds) {
    const reviews = await db.collection('comments').where('targetUserId', '==', targetUserId).get();
    const rating = averageRating(reviews.docs
      .filter(review => review.data().moderationStatus !== 'removed')
      .map(review => review.data().rating));
    await db.doc(`users/${targetUserId}`).update({ rating });
    const profileRef = db.doc(`publicProfiles/${targetUserId}`);
    if ((await profileRef.get()).exists) await profileRef.update({ rating });
  }
});

function requireUid(request: CallableRequest): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Please sign in first.');
  return request.auth.uid;
}

function requireSessionId(data: unknown): string {
  const sessionId = (data as { sessionId?: unknown } | null)?.sessionId;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new HttpsError('invalid-argument', 'A valid sessionId is required.');
  }
  return sessionId;
}

function toSnapshot(data: FirebaseFirestore.DocumentData): SessionSnapshot {
  const scheduledAt = data.scheduledAt instanceof Timestamp ? data.scheduledAt.toDate() : new Date(data.scheduledAt);
  return {
    teacherId: String(data.teacherId || ''),
    learnerId: String(data.learnerId || ''),
    status: String(data.status || ''),
    scheduledAt,
  };
}

function toHttpsError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof SessionRuleError) throw new HttpsError(error.code, error.message);
  console.error(error);
  throw new HttpsError('internal', 'Something went wrong. Please try again.');
}

/**
 * Complete a session and transfer credits from learner to teacher.
 * Idempotent: repeated calls for a completed session return without changing balances.
 */
export const completeSession = onCall(async (request) => {
  const uid = requireUid(request);
  const sessionId = requireSessionId(request.data);
  const sessionRef = db.doc(`sessions/${sessionId}`);

  try {
    return await db.runTransaction(async (tx) => {
      const sessionDoc = await tx.get(sessionRef);
      if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found.');
      const sessionData = sessionDoc.data()!;
      const session = toSnapshot(sessionData);

      if (session.status === 'completed') {
        if (session.teacherId !== uid && session.learnerId !== uid) {
          throw new HttpsError('permission-denied', 'Only a session participant can perform this action.');
        }
        return { status: 'already_completed' as const };
      }

      const teacherRef = db.doc(`users/${session.teacherId}`);
      const learnerRef = db.doc(`users/${session.learnerId}`);
      const teacherProfileRef = db.doc(`publicProfiles/${session.teacherId}`);
      const learnerProfileRef = db.doc(`publicProfiles/${session.learnerId}`);
      const settingsRef = db.doc('settings/platform');
      const [teacherDoc, learnerDoc, settingsDoc, teacherProfileDoc, learnerProfileDoc] = await tx.getAll(
        teacherRef,
        learnerRef,
        settingsRef,
        teacherProfileRef,
        learnerProfileRef,
      );
      if (!teacherDoc.exists || !learnerDoc.exists) {
        throw new HttpsError('failed-precondition', 'User profile missing for credit transfer.');
      }

      const teacher = teacherDoc.data()!;
      const learner = learnerDoc.data()!;
      // The amount comes from admin settings, never from the client-written session document.
      const amount = resolveCreditAmount(settingsDoc.data()?.creditsPerSession);
      const plan = planCompletion(
        session,
        uid,
        typeof teacher.credits === 'number' ? teacher.credits : 0,
        typeof learner.credits === 'number' ? learner.credits : 0,
        amount,
      );

      const skill = String(sessionData.skill || 'session');
      const now = FieldValue.serverTimestamp();

      tx.update(sessionRef, {
        status: 'completed',
        creditsExchanged: plan.amount,
        completedBy: uid,
        completedAt: now,
      });
      tx.set(db.doc(`transactions/tx-${sessionId}-teacher`), {
        userId: session.teacherId,
        amount: plan.amount,
        type: 'earned_teaching',
        sessionId,
        timestamp: now,
        description: `Taught ${skill} to ${String(sessionData.learnerName || 'learner')}`,
      });
      tx.set(db.doc(`transactions/tx-${sessionId}-learner`), {
        userId: session.learnerId,
        amount: -plan.amount,
        type: 'spent_learning',
        sessionId,
        timestamp: now,
        description: `Learned ${skill} from ${String(sessionData.teacherName || 'teacher')}`,
      });
      tx.update(teacherRef, { credits: plan.teacherCredits, totalSessions: FieldValue.increment(1) });
      tx.update(learnerRef, { credits: plan.learnerCredits, totalSessions: FieldValue.increment(1) });
      if (teacherProfileDoc.exists) tx.update(teacherProfileRef, { totalSessions: FieldValue.increment(1) });
      if (learnerProfileDoc.exists) tx.update(learnerProfileRef, { totalSessions: FieldValue.increment(1) });

      return { status: 'completed' as const, amount: plan.amount };
    });
  } catch (error) {
    toHttpsError(error);
  }
});

/** Cancel a scheduled session and notify the other participant. */
export const cancelSession = onCall(async (request) => {
  const uid = requireUid(request);
  const sessionId = requireSessionId(request.data);
  const sessionRef = db.doc(`sessions/${sessionId}`);

  try {
    return await db.runTransaction(async (tx) => {
      const sessionDoc = await tx.get(sessionRef);
      if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found.');
      const sessionData = sessionDoc.data()!;
      const session = toSnapshot(sessionData);
      const reason = validateCancellation(session, uid, (request.data as { reason?: unknown }).reason);

      tx.update(sessionRef, {
        status: 'cancelled',
        cancelledBy: uid,
        cancellationReason: reason,
        cancelledAt: FieldValue.serverTimestamp(),
      });
      const recipientId = session.teacherId === uid ? session.learnerId : session.teacherId;
      tx.set(db.collection('notifications').doc(), {
        userId: recipientId,
        type: 'session_cancelled',
        title: 'Session cancelled',
        body: `${String(sessionData.skill || 'Your')} session cancelled: ${reason}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        link: '/sessions',
      });

      return { status: 'cancelled' as const };
    });
  } catch (error) {
    toHttpsError(error);
  }
});
