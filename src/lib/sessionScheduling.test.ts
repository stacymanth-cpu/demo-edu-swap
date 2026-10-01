import { describe, it, expect } from 'vitest';
import { canScheduleSession, getScheduleValidationError, getSessionActionError, hasSchedulingConflict } from './sessionScheduling';

describe('session scheduling helpers', () => {
  it('allows scheduling when the core fields are filled in', () => {
    expect(canScheduleSession({
      user: { uid: 'u1' },
      scheduleMatch: { id: 'm1' },
      scheduleDate: '2026-08-06',
      scheduleTime: '10:00',
      areAllPreSessionAnswersComplete: true,
      meetingMode: 'eduswap',
      scheduleLink: '',
      isTeamsLinkValid: () => false,
    })).toBe(true);
  });

  it('returns a Teams-specific error when Teams mode is selected without a link', () => {
    expect(getScheduleValidationError({
      user: { uid: 'u1' },
      scheduleMatch: { id: 'm1' },
      scheduleDate: '2026-08-06',
      scheduleTime: '10:00',
      areAllPreSessionAnswersComplete: true,
      meetingMode: 'teams',
      scheduleLink: '',
      isTeamsLinkValid: () => false,
    })).toBe('Please enter a Teams meeting link.');
  });

  it('detects overlapping sessions while allowing adjacent times', () => {
    const sessions = [{ id: 's1', scheduledAt: new Date('2026-08-06T10:00:00'), durationMinutes: 60, status: 'scheduled' }];
    expect(hasSchedulingConflict(sessions, new Date('2026-08-06T10:30:00'), 30)).toBe(true);
    expect(hasSchedulingConflict(sessions, new Date('2026-08-06T11:00:00'), 30)).toBe(false);
    expect(hasSchedulingConflict(sessions, new Date('2026-08-06T10:30:00'), 30, 's1')).toBe(false);
  });

  it('guards session actions by participant, status, and time', () => {
    const scheduledSession = {
      teacherId: 'teacher',
      learnerId: 'learner',
      status: 'scheduled',
      scheduledAt: new Date('2026-08-06T10:00:00'),
    };
    const afterSession = new Date('2026-08-06T11:00:00');

    expect(getSessionActionError(scheduledSession, 'other', 'complete', afterSession)).toContain('participant');
    expect(getSessionActionError(scheduledSession, 'learner', 'complete', new Date('2026-08-06T09:00:00'))).toContain('after');
    expect(getSessionActionError(scheduledSession, 'learner', 'cancel', afterSession)).toContain('expired');
    expect(getSessionActionError(scheduledSession, 'learner', 'complete', afterSession)).toBeNull();
    expect(getSessionActionError(scheduledSession, 'teacher', 'complete', afterSession)).toContain('Only the learner');
    expect(getSessionActionError({ ...scheduledSession, status: 'completed' }, 'learner', 'complete', afterSession)).toContain('no longer');
  });
});
