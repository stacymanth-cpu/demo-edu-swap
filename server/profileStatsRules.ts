// Public progress report for a student's profile: matches, sessions, reviews and level. Pure logic, no Firebase,
// so it is unit-tested on its own (profileStatsRules.test.ts); profileStats.ts stores the
// result in publicStats/{uid}. Partner identities are never included.

export interface MatchRecord {
  user1Id: string;
  user2Id: string;
  user1Teaches?: string;
  user2Teaches?: string;
  status: string;
  createdAt: Date;
}

export interface SessionRecord {
  teacherId: string;
  learnerId: string;
  skill?: string;
  status: string;
  scheduledAt: Date;
  completedAt?: Date;
  durationMinutes?: number;
}

export interface ReviewRecord {
  userId: string;
  targetUserId: string;
  rating: number;
  skill?: string;
  at: Date;
  /** Hidden by an admin; no longer counts. */
  removed?: boolean;
}

export type ActivityType = 'matched' | 'taught' | 'learned' | 'reviewed';

export interface ActivityItem {
  type: ActivityType;
  /** "Python" for sessions and reviews; "Python ↔ Guitar" (what this student teaches ↔ learns) for matches. */
  skill: string;
  at: string;
  /** Stars, for a review this student received. */
  rating?: number;
}

/** Overall progress levels, by completed sessions (taught or learned). */
export const LEVELS = [
  { name: 'New member', sessions: 0 },
  { name: 'Getting started', sessions: 1 },
  { name: 'Active swapper', sessions: 5 },
  { name: 'Experienced', sessions: 15 },
  { name: 'Mentor', sessions: 30 },
] as const;

export interface ProgressLevel {
  level: string;
  /** 1 for the first level. */
  levelNumber: number;
  /** Progress from this level to the next, 0–100; 100 at the top level. */
  percent: number;
  nextLevel: string | null;
  sessionsToNextLevel: number;
}

export interface ProfileStats {
  partners: number;
  matchRequestsReceived: number;
  /** Accepted ÷ answered requests this student received; null until one was answered. */
  matchAcceptanceRate: number | null;
  sessionsCompleted: number;
  sessionsTaught: number;
  sessionsLearned: number;
  sessionsCancelled: number;
  sessionsUpcoming: number;
  /** Completed ÷ (completed + cancelled); null until a session finished either way. */
  completionRate: number | null;
  hoursTaught: number;
  hoursLearned: number;
  topSkills: { skill: string; count: number }[];
  /** Completed sessions in each of the last 6 months, oldest first ("2026-10"). */
  monthly: { month: string; sessions: number }[];
  reviewsReceived: number;
  /** Average stars of visible reviews received, one decimal; null until the first review. */
  averageRating: number | null;
  reviewsGiven: number;
  progress: ProgressLevel;
  recentActivity: ActivityItem[];
  lastActiveAt: string | null;
}

export function progressLevel(sessionsCompleted: number): ProgressLevel {
  let index = 0;
  LEVELS.forEach((level, i) => { if (sessionsCompleted >= level.sessions) index = i; });
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  if (!next) return { level: current.name, levelNumber: index + 1, percent: 100, nextLevel: null, sessionsToNextLevel: 0 };
  return {
    level: current.name,
    levelNumber: index + 1,
    percent: Math.round(((sessionsCompleted - current.sessions) / (next.sessions - current.sessions)) * 100),
    nextLevel: next.name,
    sessionsToNextLevel: next.sessions - sessionsCompleted,
  };
}

export const MONTHS_SHOWN = 6;
export const ACTIVITY_SHOWN = 8;

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeProfileStats(uid: string, matches: MatchRecord[], sessions: SessionRecord[], reviews: ReviewRecord[] = [], now = new Date()): ProfileStats {
  const mine = matches.filter(m => m.user1Id === uid || m.user2Id === uid);
  const accepted = mine.filter(m => m.status === 'accepted');
  const partners = new Set(accepted.map(m => (m.user1Id === uid ? m.user2Id : m.user1Id))).size;
  const received = mine.filter(m => m.user2Id === uid);
  const answered = received.filter(m => m.status === 'accepted' || m.status === 'declined');
  const acceptedReceived = answered.filter(m => m.status === 'accepted').length;

  const own = sessions.filter(s => s.teacherId === uid || s.learnerId === uid);
  const completed = own.filter(s => s.status === 'completed');
  const taught = completed.filter(s => s.teacherId === uid);
  const learned = completed.filter(s => s.learnerId === uid);
  const cancelled = own.filter(s => s.status === 'cancelled').length;
  const upcoming = own.filter(s => s.status === 'scheduled' && s.scheduledAt.getTime() > now.getTime()).length;
  const hours = (list: SessionRecord[]) => round1(list.reduce((sum, s) => sum + (s.durationMinutes ?? 60), 0) / 60);
  const doneAt = (s: SessionRecord) => s.completedAt ?? s.scheduledAt;

  const skillCounts = new Map<string, number>();
  taught.forEach(s => { const k = (s.skill || 'Session').trim(); skillCounts.set(k, (skillCounts.get(k) ?? 0) + 1); });
  const topSkills = [...skillCounts].map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)).slice(0, 3);

  const monthly: { month: string; sessions: number }[] = [];
  for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    monthly.push({ month: key, sessions: completed.filter(s => monthKey(doneAt(s)) === key).length });
  }

  const visible = reviews.filter(r => !r.removed && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
  const reviewsIn = visible.filter(r => r.targetUserId === uid && r.userId !== uid);
  const reviewsOut = visible.filter(r => r.userId === uid && r.targetUserId !== uid);

  const activity: (Omit<ActivityItem, 'at'> & { at: Date })[] = [
    ...accepted.map(m => ({
      type: 'matched' as const,
      skill: m.user1Id === uid ? `${m.user1Teaches ?? ''} ↔ ${m.user2Teaches ?? ''}` : `${m.user2Teaches ?? ''} ↔ ${m.user1Teaches ?? ''}`,
      at: m.createdAt,
    })),
    ...taught.map(s => ({ type: 'taught' as const, skill: s.skill || 'Session', at: doneAt(s) })),
    ...learned.map(s => ({ type: 'learned' as const, skill: s.skill || 'Session', at: doneAt(s) })),
    ...reviewsIn.map(r => ({ type: 'reviewed' as const, skill: r.skill || 'Session', at: r.at, rating: r.rating })),
  ].filter(a => a.at.getTime() <= now.getTime())
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    partners,
    matchRequestsReceived: received.length,
    matchAcceptanceRate: answered.length ? round1((acceptedReceived / answered.length) * 100) : null,
    sessionsCompleted: completed.length,
    sessionsTaught: taught.length,
    sessionsLearned: learned.length,
    sessionsCancelled: cancelled,
    sessionsUpcoming: upcoming,
    completionRate: completed.length + cancelled ? round1((completed.length / (completed.length + cancelled)) * 100) : null,
    hoursTaught: hours(taught),
    hoursLearned: hours(learned),
    topSkills,
    monthly,
    reviewsReceived: reviewsIn.length,
    averageRating: reviewsIn.length ? round1(reviewsIn.reduce((sum, r) => sum + r.rating, 0) / reviewsIn.length) : null,
    reviewsGiven: reviewsOut.length,
    progress: progressLevel(completed.length),
    recentActivity: activity.slice(0, ACTIVITY_SHOWN).map(a => ({ ...a, at: a.at.toISOString() })),
    lastActiveAt: activity.length ? activity[0].at.toISOString() : null,
  };
}
