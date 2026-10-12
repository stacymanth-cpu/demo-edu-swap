import { describe, expect, it } from 'vitest';
import { computeProfileStats, progressLevel, type MatchRecord, type ReviewRecord, type SessionRecord } from './profileStatsRules';

const now = new Date('2026-10-10T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const match = (over: Partial<MatchRecord>): MatchRecord => ({ user1Id: 'me', user2Id: 'a', user1Teaches: 'Python', user2Teaches: 'Guitar', status: 'accepted', createdAt: daysAgo(10), ...over });
const session = (over: Partial<SessionRecord>): SessionRecord => ({ teacherId: 'me', learnerId: 'a', skill: 'Python', status: 'completed', scheduledAt: daysAgo(3), completedAt: daysAgo(3), durationMinutes: 60, ...over });
const review = (over: Partial<ReviewRecord>): ReviewRecord => ({ userId: 'a', targetUserId: 'me', rating: 5, skill: 'Python', at: daysAgo(2), ...over });

describe('public profile statistics', () => {
  it('counts distinct partners from accepted matches only', () => {
    const stats = computeProfileStats('me', [
      match({}), match({ user2Id: 'a' }), match({ user1Id: 'b', user2Id: 'me' }), match({ user2Id: 'c', status: 'pending' }), match({ user2Id: 'd', status: 'declined' }),
      match({ user1Id: 'x', user2Id: 'y' }),
    ], [], [], now);
    expect(stats.partners).toBe(2);
  });

  it('measures how often requests to this student are accepted', () => {
    const stats = computeProfileStats('me', [
      match({ user1Id: 'a', user2Id: 'me', status: 'accepted' }),
      match({ user1Id: 'b', user2Id: 'me', status: 'accepted' }),
      match({ user1Id: 'c', user2Id: 'me', status: 'declined' }),
      match({ user1Id: 'd', user2Id: 'me', status: 'pending' }),
    ], [], [], now);
    expect(stats.matchRequestsReceived).toBe(4);
    expect(stats.matchAcceptanceRate).toBe(66.7);
  });

  it('splits completed sessions into taught and learned, with hours and completion rate', () => {
    const stats = computeProfileStats('me', [], [
      session({}), session({ durationMinutes: 90 }), session({ teacherId: 'a', learnerId: 'me', skill: 'Guitar' }),
      session({ status: 'cancelled', completedAt: undefined }),
      session({ status: 'scheduled', scheduledAt: daysAgo(-2), completedAt: undefined }),
      session({ teacherId: 'x', learnerId: 'y' }),
    ], [], now);
    expect(stats).toMatchObject({ sessionsCompleted: 3, sessionsTaught: 2, sessionsLearned: 1, sessionsCancelled: 1, sessionsUpcoming: 1, hoursTaught: 2.5, hoursLearned: 1, completionRate: 75 });
    expect(stats.topSkills).toEqual([{ skill: 'Python', count: 2 }]);
  });

  it('reports the last six months, oldest first, counting completed sessions by month', () => {
    const stats = computeProfileStats('me', [], [session({ completedAt: daysAgo(2) }), session({ completedAt: new Date('2026-08-15T10:00:00Z') }), session({ completedAt: new Date('2025-01-01T10:00:00Z') })], [], now);
    expect(stats.monthly.map(m => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(stats.monthly.map(m => m.sessions)).toEqual([0, 0, 0, 1, 0, 1]);
  });

  it('lists recent activity newest first without naming partners', () => {
    const stats = computeProfileStats('me', [match({ createdAt: daysAgo(10) })], [session({ completedAt: daysAgo(1) }), session({ teacherId: 'a', learnerId: 'me', skill: 'Guitar', completedAt: daysAgo(5) })], [], now);
    expect(stats.recentActivity.map(a => [a.type, a.skill])).toEqual([['taught', 'Python'], ['learned', 'Guitar'], ['matched', 'Python ↔ Guitar']]);
    expect(JSON.stringify(stats.recentActivity)).not.toContain('"a"');
    expect(stats.lastActiveAt).toBe(daysAgo(1).toISOString());
  });

  it('gives empty statistics to a new student', () => {
    const stats = computeProfileStats('me', [], [], [], now);
    expect(stats).toMatchObject({ partners: 0, sessionsCompleted: 0, matchAcceptanceRate: null, completionRate: null, reviewsReceived: 0, averageRating: null, reviewsGiven: 0, recentActivity: [], lastActiveAt: null });
    expect(stats.progress).toEqual({ level: 'New member', levelNumber: 1, percent: 0, nextLevel: 'Getting started', sessionsToNextLevel: 1 });
  });

  it('counts visible reviews received and given, and averages the stars received', () => {
    const stats = computeProfileStats('me', [], [], [
      review({ rating: 5 }), review({ userId: 'b', rating: 4 }),
      review({ userId: 'c', rating: 1, removed: true }),
      review({ userId: 'me', targetUserId: 'a', rating: 3 }),
      review({ userId: 'x', targetUserId: 'y' }),
    ], now);
    expect(stats).toMatchObject({ reviewsReceived: 2, averageRating: 4.5, reviewsGiven: 1 });
  });

  it('lists reviews received in recent activity with their stars, without naming the reviewer', () => {
    const stats = computeProfileStats('me', [], [session({ completedAt: daysAgo(3) })], [review({ rating: 5, at: daysAgo(2) })], now);
    expect(stats.recentActivity[0]).toEqual({ type: 'reviewed', skill: 'Python', rating: 5, at: daysAgo(2).toISOString() });
    expect(JSON.stringify(stats.recentActivity)).not.toContain('"a"');
  });
});

describe('overall progress level', () => {
  it('moves through the levels as sessions are completed', () => {
    expect(progressLevel(1)).toEqual({ level: 'Getting started', levelNumber: 2, percent: 0, nextLevel: 'Active swapper', sessionsToNextLevel: 4 });
    expect(progressLevel(3)).toMatchObject({ level: 'Getting started', percent: 50, sessionsToNextLevel: 2 });
    expect(progressLevel(15)).toMatchObject({ level: 'Experienced', levelNumber: 4, nextLevel: 'Mentor' });
  });

  it('stops at the top level', () => {
    expect(progressLevel(42)).toEqual({ level: 'Mentor', levelNumber: 5, percent: 100, nextLevel: null, sessionsToNextLevel: 0 });
  });

  it('is based on completed sessions, taught or learned', () => {
    const stats = computeProfileStats('me', [], [session({}), session({ teacherId: 'a', learnerId: 'me' }), session({ status: 'cancelled' })], [], now);
    expect(stats.progress).toMatchObject({ level: 'Getting started', sessionsToNextLevel: 3 });
  });
});
