// Firestore security rules tests. Run with `npm run test:rules`, which starts
// the Firestore emulator under a demo project, so no real data is touched.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';

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
  it('blocks users from creating notifications', async () => {
    await assertFails(addDoc(collection(as('alice'), 'notifications'), { userId: 'bob', title: 'Fake alert', read: false }));
  });

  it('blocks users from changing their own credits or rating', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { credits: 5000 }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { rating: 5 }));
  });
});
