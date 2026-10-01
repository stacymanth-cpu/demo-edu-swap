// Firestore security rules tests. Run with `npm run test:rules`, which starts
// the Firestore emulator under a demo project, so no real data is touched.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const hoursFromNow = (hours: number) => Timestamp.fromDate(new Date(Date.now() + hours * 3_600_000));
const as = (uid: string) => testEnv.authenticatedContext(uid).firestore();

function sessionData(overrides: Record<string, unknown> = {}) {
  return {
    matchId: 'accepted',
    createdBy: 'alice',
    teacherId: 'alice',
    learnerId: 'bob',
    skill: 'Python',
    scheduledAt: hoursFromNow(24),
    durationMinutes: 60,
    status: 'scheduled',
    creditsExchanged: 10,
    ...overrides,
  };
}

function reviewData(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'bob',
    targetUserId: 'alice',
    sessionId: 'done',
    rating: 5,
    text: 'Clear and patient teacher.',
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-eduswap',
    firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/alice'), { uid: 'alice', credits: 50 });
    await setDoc(doc(db, 'matches/accepted'), { user1Id: 'alice', user2Id: 'bob', status: 'accepted' });
    await setDoc(doc(db, 'matches/pending'), { user1Id: 'alice', user2Id: 'bob', status: 'pending' });
    await setDoc(doc(db, 'sessions/upcoming'), sessionData());
    await setDoc(doc(db, 'sessions/done'), sessionData({ status: 'completed', scheduledAt: hoursFromNow(-24) }));
    await setDoc(doc(db, 'chatRooms/room'), { matchId: 'accepted', participants: ['alice', 'bob'] });
    // Free-plan flows: bob (learner) owes alice (teacher) for a session that has started.
    await setDoc(doc(db, 'users/alice'), { uid: 'alice', credits: 50, totalSessions: 3, rating: 0 });
    await setDoc(doc(db, 'users/bob'), { uid: 'bob', credits: 40, totalSessions: 1, rating: 0 });
    await setDoc(doc(db, 'publicProfiles/alice'), { uid: 'alice', totalSessions: 3, rating: 0 });
    await setDoc(doc(db, 'sessions/due'), sessionData({ scheduledAt: hoursFromNow(-1) }));
    await setDoc(doc(db, 'settings/platform'), { creditsPerSession: 10 });
    await setDoc(doc(db, 'groupCallRooms/group'), { hostId: 'alice', participants: ['alice', 'bob'], status: 'open' });
  });
});

/** The batch the app sends when a learner confirms a session (see completeSessionWithCreditsById). */
function completionBatch(db: Firestore, sessionId: string, overrides: { teacherCredits?: number; learnerCredits?: number; amount?: number } = {}) {
  const amount = overrides.amount ?? 10;
  const batch = writeBatch(db);
  batch.update(doc(db, 'sessions', sessionId), { status: 'completed', creditsExchanged: amount, completedBy: 'bob', completedAt: serverTimestamp() });
  batch.update(doc(db, 'users/alice'), { credits: increment(overrides.teacherCredits ?? amount), totalSessions: increment(1), lastCreditSessionId: sessionId });
  batch.update(doc(db, 'users/bob'), { credits: increment(-(overrides.learnerCredits ?? amount)), totalSessions: increment(1), lastCreditSessionId: sessionId });
  batch.set(doc(db, 'transactions', `tx-${sessionId}-teacher`), { userId: 'alice', amount, type: 'earned_teaching', sessionId, timestamp: serverTimestamp(), description: 'Taught Python' });
  batch.set(doc(db, 'transactions', `tx-${sessionId}-learner`), { userId: 'bob', amount: -amount, type: 'spent_learning', sessionId, timestamp: serverTimestamp(), description: 'Learned Python' });
  return batch;
}

describe('session completion without Cloud Functions', () => {
  it('lets the learner complete a started session, moving exactly the configured credits', async () => {
    await assertSucceeds(completionBatch(as('bob'), 'due').commit());
    let alice: Record<string, unknown> | undefined;
    let bob: Record<string, unknown> | undefined;
    await testEnv.withSecurityRulesDisabled(async context => {
      alice = (await getDoc(doc(context.firestore(), 'users/alice'))).data();
      bob = (await getDoc(doc(context.firestore(), 'users/bob'))).data();
    });
    expect(alice).toMatchObject({ credits: 60, totalSessions: 4 });
    expect(bob).toMatchObject({ credits: 30, totalSessions: 2 });
  });

  it('blocks completing twice, so credits cannot be collected again', async () => {
    await assertSucceeds(completionBatch(as('bob'), 'due').commit());
    await assertFails(completionBatch(as('bob'), 'due').commit());
  });

  it('blocks the teacher, outsiders and sessions that have not started', async () => {
    await assertFails(completionBatch(as('alice'), 'due').commit());
    await assertFails(completionBatch(as('mallory'), 'due').commit());
    await assertFails(completionBatch(as('bob'), 'upcoming').commit());
  });

  it('blocks paying less, minting extra credits, or changing the amount', async () => {
    await assertFails(completionBatch(as('bob'), 'due', { learnerCredits: 1 }).commit());
    await assertFails(completionBatch(as('bob'), 'due', { teacherCredits: 500 }).commit());
    await assertFails(completionBatch(as('bob'), 'due', { amount: 1 }).commit());
  });

  it('blocks a learner who cannot afford the session', async () => {
    await testEnv.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), 'users/bob'), { credits: 5 }));
    await assertFails(completionBatch(as('bob'), 'due').commit());
  });

  it('blocks credit or ledger changes outside a completion', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'users/alice'), { credits: increment(10), totalSessions: increment(1), lastCreditSessionId: 'done' }));
    await assertFails(setDoc(doc(as('bob'), 'transactions/tx-due-teacher'), { userId: 'alice', amount: 10, type: 'earned_teaching', sessionId: 'due', timestamp: serverTimestamp(), description: 'x' }));
  });
});

describe('session cancellation without Cloud Functions', () => {
  const cancel = (reason = 'Clash with an exam') => ({ status: 'cancelled', cancelledBy: 'alice', cancellationReason: reason, cancelledAt: serverTimestamp() });

  it('lets a participant cancel before the start with a reason', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'sessions/upcoming'), cancel()));
  });

  it('blocks cancelling started sessions, without a reason, or as an outsider', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'sessions/due'), cancel()));
    await assertFails(updateDoc(doc(as('alice'), 'sessions/upcoming'), cancel('')));
    await assertFails(updateDoc(doc(as('mallory'), 'sessions/upcoming'), { ...cancel(), cancelledBy: 'mallory' }));
  });
});

describe('notifications written by the browser', () => {
  const note = (overrides: Record<string, unknown>) => ({
    userId: 'bob', senderId: 'alice', title: 'Hello', body: 'Body', read: false, createdAt: serverTimestamp(), link: '/chat', ...overrides,
  });

  it('allows notifying the other person in a chat, match, session or group call', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'notifications'), note({ type: 'message', roomId: 'room' })));
    await assertSucceeds(addDoc(collection(as('alice'), 'notifications'), note({ type: 'match_request', matchId: 'pending' })));
    await assertSucceeds(addDoc(collection(as('alice'), 'notifications'), note({ type: 'session_upcoming', sessionId: 'upcoming' })));
    await assertSucceeds(addDoc(collection(as('alice'), 'notifications'), note({ type: 'system', groupRoomId: 'group' })));
  });

  it('blocks spamming strangers, faking the sender or skipping the source', async () => {
    await assertFails(addDoc(collection(as('alice'), 'notifications'), note({ type: 'message', roomId: 'room', userId: 'carol' })));
    await assertFails(addDoc(collection(as('mallory'), 'notifications'), note({ type: 'message', roomId: 'room', senderId: 'mallory' })));
    await assertFails(addDoc(collection(as('mallory'), 'notifications'), note({ type: 'message', roomId: 'room' })));
    await assertFails(addDoc(collection(as('alice'), 'notifications'), note({ type: 'system' })));
    await assertFails(addDoc(collection(as('bob'), 'notifications'), note({ type: 'match_request', matchId: 'pending', userId: 'alice', senderId: 'bob' })));
  });
});

describe('ratings without Cloud Functions', () => {
  /** The batch the app sends with a review (see createComment). */
  function reviewBatch(db: Firestore, overrides: { count?: number; total?: number; rating?: number; skipComment?: boolean } = {}) {
    const batch = writeBatch(db);
    if (!overrides.skipComment) batch.set(doc(db, 'comments/done_bob'), reviewData({ rating: 4 }));
    batch.set(doc(db, 'ratingSummaries/alice'), { count: overrides.count ?? 1, total: overrides.total ?? 4, lastCommentId: 'done_bob' });
    batch.update(doc(db, 'users/alice'), { rating: overrides.rating ?? 4 });
    return batch;
  }

  it('lets a reviewer update the rating to match the new review', async () => {
    await assertSucceeds(reviewBatch(as('bob')).commit());
    await assertSucceeds(updateDoc(doc(as('bob'), 'publicProfiles/alice'), { rating: 4 }));
  });

  it('blocks inflating the total, faking the rating, or skipping the review', async () => {
    await assertFails(reviewBatch(as('bob'), { total: 50 }).commit());
    await assertFails(reviewBatch(as('bob'), { rating: 5 }).commit());
    await assertFails(reviewBatch(as('bob'), { count: 5 }).commit());
    await assertFails(reviewBatch(as('bob'), { skipComment: true }).commit());
  });

  it('blocks setting a public rating that differs from the private record', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'publicProfiles/alice'), { rating: 5 }));
  });
});

describe('platform settings', () => {
  it('lets signed-in users read the platform document only', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'settings/platform')));
    await assertFails(getDoc(doc(as('bob'), 'settings/secret')));
    await assertFails(setDoc(doc(as('bob'), 'settings/platform'), { creditsPerSession: 1 }));
  });
});

describe('sessions', () => {
  it('allows scheduling a future session for an accepted match', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'sessions'), sessionData()));
  });

  it('blocks inventing a past session with a stranger to take their credits', async () => {
    await assertFails(addDoc(collection(as('mallory'), 'sessions'), sessionData({
      createdBy: 'mallory', teacherId: 'mallory', scheduledAt: hoursFromNow(-2),
    })));
  });

  it('blocks reusing a match the caller is not part of', async () => {
    await assertFails(addDoc(collection(as('mallory'), 'sessions'), sessionData({
      createdBy: 'mallory', teacherId: 'mallory',
    })));
  });

  it('blocks sessions in the past, for pending matches, or created on behalf of someone else', async () => {
    await assertFails(addDoc(collection(as('alice'), 'sessions'), sessionData({ scheduledAt: hoursFromNow(-1) })));
    await assertFails(addDoc(collection(as('alice'), 'sessions'), sessionData({ matchId: 'pending' })));
    await assertFails(addDoc(collection(as('alice'), 'sessions'), sessionData({ createdBy: 'bob' })));
  });

  it('allows rescheduling to the future but not the past', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), 'sessions/upcoming'), { scheduledAt: hoursFromNow(48) }));
    await assertFails(updateDoc(doc(as('bob'), 'sessions/upcoming'), { scheduledAt: hoursFromNow(-1) }));
  });

  it('blocks participants from completing a session directly', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'sessions/upcoming'), { status: 'completed' }));
  });
});

describe('matches', () => {
  it('lets only the recipient accept a request', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'matches/pending'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(as('bob'), 'matches/pending'), { status: 'accepted' }));
  });

  it('lets the sender withdraw a pending request', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'matches/pending'), { status: 'declined' }));
  });

  it('blocks creating a match that is already accepted', async () => {
    await assertFails(addDoc(collection(as('alice'), 'matches'), { user1Id: 'alice', user2Id: 'carol', status: 'accepted' }));
  });
});

describe('chat', () => {
  it('allows a room between matched students', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'chatRooms'), { matchId: 'accepted', participants: ['alice', 'bob'] }));
  });

  it('blocks a room with someone the user has not matched with', async () => {
    await assertFails(addDoc(collection(as('mallory'), 'chatRooms'), { matchId: 'accepted', participants: ['mallory', 'bob'] }));
  });

  it('allows normal messages and Firebase Storage file links', async () => {
    const messages = collection(as('alice'), 'chatRooms/room/messages');
    await assertSucceeds(addDoc(messages, { senderId: 'alice', text: 'Hi', timestamp: Timestamp.now(), isRead: false }));
    await assertSucceeds(addDoc(messages, {
      senderId: 'alice', text: 'notes.pdf', timestamp: Timestamp.now(), isRead: false,
      fileUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/notes.pdf', fileName: 'notes.pdf',
    }));
  });

  it('blocks unknown fields, outside file links and non-participants', async () => {
    await assertFails(addDoc(collection(as('alice'), 'chatRooms/room/messages'), {
      senderId: 'alice', text: 'Hi', timestamp: Timestamp.now(), isRead: false, deletedAt: Timestamp.now(),
    }));
    await assertFails(addDoc(collection(as('alice'), 'chatRooms/room/messages'), {
      senderId: 'alice', text: 'file', timestamp: Timestamp.now(), isRead: false, fileUrl: 'https://evil.example/file.exe',
    }));
    await assertFails(addDoc(collection(as('mallory'), 'chatRooms/room/messages'), {
      senderId: 'mallory', text: 'Hi', timestamp: Timestamp.now(), isRead: false,
    }));
  });
});

describe('reviews', () => {
  it('allows one review of the other participant after a completed session', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'comments/done_bob'), reviewData()));
  });

  it('blocks a second review for the same session', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'comments/done_bob'), reviewData()));
    await assertFails(setDoc(doc(as('bob'), 'comments/done_bob'), reviewData({ rating: 1 })));
  });

  it('blocks reviews from outsiders, for unfinished sessions, or with bad ratings', async () => {
    await assertFails(setDoc(doc(as('mallory'), 'comments/done_mallory'), reviewData({ userId: 'mallory' })));
    await assertFails(setDoc(doc(as('bob'), 'comments/upcoming_bob'), reviewData({ sessionId: 'upcoming' })));
    await assertFails(setDoc(doc(as('bob'), 'comments/done_bob'), reviewData({ rating: 6 })));
    await assertFails(setDoc(doc(as('bob'), 'comments/random-id'), reviewData()));
  });
});

describe('trusted-only data', () => {
  it('blocks users from creating unlinked notifications', async () => {
    await assertFails(addDoc(collection(as('alice'), 'notifications'), { userId: 'bob', title: 'Fake alert', read: false }));
  });

  it('blocks users from changing their own credits or rating', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { credits: 5000 }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { rating: 5 }));
  });
});
