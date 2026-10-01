// Pure validation rules for session completion and cancellation.
// Kept free of Firebase imports so they can be unit tested directly.

export const DEFAULT_CREDITS_PER_SESSION = 10;
export const MAX_CANCELLATION_REASON_LENGTH = 500;

export interface SessionSnapshot {
  teacherId: string;
  learnerId: string;
  status: string;
  scheduledAt: Date;
}

export class SessionRuleError extends Error {
  constructor(
    readonly code: 'permission-denied' | 'failed-precondition' | 'invalid-argument',
    message: string,
  ) {
    super(message);
  }
}

export function assertParticipant(session: SessionSnapshot, uid: string): void {
  if (session.teacherId !== uid && session.learnerId !== uid) {
    throw new SessionRuleError('permission-denied', 'Only a session participant can perform this action.');
  }
  if (!session.teacherId || !session.learnerId || session.teacherId === session.learnerId) {
    throw new SessionRuleError('failed-precondition', 'This session has invalid participants.');
  }
}

export function resolveCreditAmount(settingsValue: unknown): number {
  if (typeof settingsValue === 'number' && Number.isInteger(settingsValue) && settingsValue > 0) {
    return settingsValue;
  }
  return DEFAULT_CREDITS_PER_SESSION;
}

export interface CompletionPlan {
  amount: number;
  teacherCredits: number;
  learnerCredits: number;
}

/**
 * Validate a completion request and compute new balances.
 * Unlike the old client version, a learner who cannot afford the session is
 * rejected rather than clamped to zero, so credits are never created from nothing.
 */
export function planCompletion(
  session: SessionSnapshot,
  uid: string,
  teacherBalance: number,
  learnerBalance: number,
  amount: number,
  now = new Date(),
): CompletionPlan {
  assertParticipant(session, uid);
  // The learner pays, so only the learner can confirm the session took place.
  // Otherwise a teacher could mark an unattended session complete and collect credits.
  if (uid !== session.learnerId) {
    throw new SessionRuleError('permission-denied', 'Only the learner can confirm this session is complete.');
  }
  if (session.status !== 'scheduled') {
    throw new SessionRuleError('failed-precondition', 'This session is no longer available for completion.');
  }
  if (session.scheduledAt.getTime() > now.getTime()) {
    throw new SessionRuleError('failed-precondition', 'You can complete a session after its scheduled time.');
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new SessionRuleError('failed-precondition', 'Credit amount must be a positive whole number.');
  }
  if (!Number.isFinite(teacherBalance) || !Number.isFinite(learnerBalance) || teacherBalance < 0 || learnerBalance < 0) {
    throw new SessionRuleError('failed-precondition', 'A participant has an invalid credit balance.');
  }
  if (learnerBalance < amount) {
    throw new SessionRuleError('failed-precondition', 'The learner does not have enough credits for this session.');
  }
  return {
    amount,
    teacherCredits: teacherBalance + amount,
    learnerCredits: learnerBalance - amount,
  };
}

/** Average of 1-5 star ratings, rounded to two decimals; 0 when there are none. */
export function averageRating(ratings: unknown[]): number {
  const valid = ratings.filter((rating): rating is number =>
    typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5);
  if (valid.length === 0) return 0;
  return Number((valid.reduce((total, value) => total + value, 0) / valid.length).toFixed(2));
}

export function validateCancellation(session: SessionSnapshot, uid: string, reason: unknown, now = new Date()): string {
  assertParticipant(session, uid);
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmed) {
    throw new SessionRuleError('invalid-argument', 'Please provide a cancellation reason.');
  }
  if (trimmed.length > MAX_CANCELLATION_REASON_LENGTH) {
    throw new SessionRuleError('invalid-argument', `Cancellation reason must be ${MAX_CANCELLATION_REASON_LENGTH} characters or fewer.`);
  }
  if (session.status !== 'scheduled') {
    throw new SessionRuleError('failed-precondition', 'This session can no longer be cancelled.');
  }
  if (session.scheduledAt.getTime() <= now.getTime()) {
    throw new SessionRuleError('failed-precondition', 'This session has expired. Schedule a new session instead.');
  }
  return trimmed;
}
