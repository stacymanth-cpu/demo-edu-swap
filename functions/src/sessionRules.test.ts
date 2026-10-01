import { describe, expect, it } from 'vitest';
import { averageRating, planCompletion, resolveCreditAmount, validateCancellation, type SessionSnapshot } from './sessionRules';

const now = new Date('2026-09-27T12:00:00Z');
const past = new Date('2026-09-27T10:00:00Z');
const future = new Date('2026-09-28T10:00:00Z');

function session(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return { teacherId: 'teacher', learnerId: 'learner', status: 'scheduled', scheduledAt: past, ...overrides };
}

describe('planCompletion', () => {
  it('moves credits from learner to teacher', () => {
    expect(planCompletion(session(), 'learner', 20, 30, 10, now)).toEqual({ amount: 10, teacherCredits: 30, learnerCredits: 20 });
  });

  it('rejects the teacher completing on their own', () => {
    expect(() => planCompletion(session(), 'teacher', 20, 30, 10, now)).toThrow('Only the learner');
  });

  it('rejects non-participants', () => {
    expect(() => planCompletion(session(), 'stranger', 20, 30, 10, now)).toThrow('participant');
  });

  it('rejects sessions that have not started', () => {
    expect(() => planCompletion(session({ scheduledAt: future }), 'learner', 20, 30, 10, now)).toThrow('after its scheduled time');
  });

  it('rejects sessions that are not scheduled', () => {
    expect(() => planCompletion(session({ status: 'cancelled' }), 'learner', 20, 30, 10, now)).toThrow('no longer available');
  });

  it('rejects learners without enough credits instead of minting', () => {
    expect(() => planCompletion(session(), 'learner', 20, 5, 10, now)).toThrow('enough credits');
  });

  it('rejects self-sessions', () => {
    expect(() => planCompletion(session({ learnerId: 'teacher' }), 'teacher', 20, 30, 10, now)).toThrow('invalid participants');
  });
});

describe('resolveCreditAmount', () => {
  it('uses a valid admin setting', () => expect(resolveCreditAmount(15)).toBe(15));
  it('falls back for missing or invalid values', () => {
    expect(resolveCreditAmount(undefined)).toBe(10);
    expect(resolveCreditAmount(-3)).toBe(10);
    expect(resolveCreditAmount(2.5)).toBe(10);
  });
});

describe('validateCancellation', () => {
  it('returns the trimmed reason', () => {
    expect(validateCancellation(session({ scheduledAt: future }), 'teacher', '  sick  ', now)).toBe('sick');
  });

  it('requires a reason', () => {
    expect(() => validateCancellation(session({ scheduledAt: future }), 'teacher', '   ', now)).toThrow('reason');
  });

  it('rejects expired sessions', () => {
    expect(() => validateCancellation(session(), 'teacher', 'busy', now)).toThrow('expired');
  });

  it('rejects non-participants', () => {
    expect(() => validateCancellation(session({ scheduledAt: future }), 'stranger', 'busy', now)).toThrow('participant');
  });
});

describe('averageRating', () => {
  it('averages valid ratings to two decimals', () => expect(averageRating([5, 4, 4])).toBe(4.33));
  it('ignores invalid ratings', () => expect(averageRating([5, 0, 9, 2.5, '5', null])).toBe(5));
  it('returns 0 with no ratings', () => expect(averageRating([])).toBe(0));
});
