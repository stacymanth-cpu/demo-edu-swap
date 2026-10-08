// Seeds the emulators with the test accounts and the data the tests start from.
import { Timestamp } from 'firebase-admin/firestore';
import { toPublicUserProfile } from '../src/lib/publicUserProfile';
import type { User } from '../src/types';
import { emulatorAdmin } from './admin';
import { CREDITS_PER_SESSION, PASSWORD, PAST_SESSION_ID, STARTING_CREDITS, STUDENTS, displayName, type TestStudent } from './fixtures';

function profile(s: TestStudent): User {
  return {
    uid: s.uid,
    displayName: displayName(s),
    firstName: s.firstName,
    lastName: s.lastName,
    studentNumber: '202400001',
    mobileNumber: '',
    studentStatusConfirmed: true,
    termsAcceptedAt: new Date(),
    email: s.email,
    photoUrl: '',
    university: 'University of Mpumalanga',
    bio: `${s.firstName} is an EduSwap test student.`,
    skillsTeach: s.teaches,
    skillsLearn: s.learns,
    credits: STARTING_CREDITS,
    rating: 0,
    totalSessions: 0,
    studentVerified: true,
    accountStatus: s.accountStatus ?? 'active',
    isAdmin: s.isAdmin ?? false,
    joinedAt: new Date(),
    isOnline: false,
    lastSeen: null,
  } as User;
}

const withTimestamps = (data: Record<string, unknown>) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value instanceof Date ? Timestamp.fromDate(value) : value]),
);

export default async function globalSetup() {
  const { auth, db } = emulatorAdmin();

  await db.doc('settings/platform').set({
    creditsPerSession: CREDITS_PER_SESSION,
    cancellationWindowHours: 2,
    verifiedEmailDomains: ['ump.ac.za'],
    verificationRequired: false,
  });

  for (const s of Object.values(STUDENTS)) {
    await auth.createUser({ uid: s.uid, email: s.email, password: PASSWORD, displayName: displayName(s), emailVerified: true });
    if (s.isAdmin) await auth.setCustomUserClaims(s.uid, { admin: true });
    const user = profile(s);
    await db.doc(`users/${s.uid}`).set(withTimestamps(user as unknown as Record<string, unknown>));
    await db.doc(`publicProfiles/${s.uid}`).set(withTimestamps(toPublicUserProfile(user) as Record<string, unknown>));
  }

  // Lerato (learner) and Thabo (teacher) already matched, with a session that started an hour ago.
  const { lerato, thabo } = STUDENTS;
  const matchId = 'e2e-match-lerato-thabo';
  await db.doc(`matches/${matchId}`).set({
    user1Id: lerato.uid, user2Id: thabo.uid, user1Teaches: 'Physics', user2Teaches: 'Statistics',
    status: 'accepted', createdAt: Timestamp.now(),
  });
  await db.doc(`sessions/${PAST_SESSION_ID}`).set({
    matchId,
    teacherId: thabo.uid, learnerId: lerato.uid,
    teacherName: displayName(thabo), learnerName: displayName(lerato),
    skill: 'Statistics',
    scheduledAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
    durationMinutes: 60,
    status: 'scheduled',
    creditsExchanged: CREDITS_PER_SESSION,
    createdBy: lerato.uid,
    notes: 'Hypothesis testing',
  });
}
