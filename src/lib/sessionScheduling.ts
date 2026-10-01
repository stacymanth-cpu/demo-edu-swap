export interface ScheduleValidationInput {
  user: { uid: string } | null | undefined;
  scheduleMatch: { id: string } | null;
  scheduleDate: string;
  scheduleTime: string;
  areAllPreSessionAnswersComplete: boolean;
  meetingMode: 'eduswap' | 'teams';
  scheduleLink: string;
  isTeamsLinkValid: (link: string) => boolean;
}

export function canScheduleSession(input: ScheduleValidationInput): boolean {
  const hasCoreFields = Boolean(
    input.user &&
    input.scheduleMatch &&
    input.scheduleDate &&
    input.scheduleTime &&
    input.areAllPreSessionAnswersComplete
  );

  if (!hasCoreFields) return false;

  if (input.meetingMode === 'teams') {
    return Boolean(input.scheduleLink.trim() && input.isTeamsLinkValid(input.scheduleLink));
  }

  return true;
}

export function getScheduleValidationError(input: ScheduleValidationInput): string | null {
  if (!input.user || !input.scheduleMatch || !input.scheduleDate || !input.scheduleTime) {
    return 'Please fill in date and time.';
  }

  if (!input.areAllPreSessionAnswersComplete) {
    return 'Please answer all pre-session questions before scheduling.';
  }

  if (input.meetingMode === 'teams') {
    if (!input.scheduleLink.trim()) return 'Please enter a Teams meeting link.';
    if (!input.isTeamsLinkValid(input.scheduleLink)) return 'Please enter a valid Teams meeting link.';
  }

  return null;
}

export interface ScheduledWindow {
  id?: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
}

export type SessionAction = 'complete' | 'cancel' | 'reschedule';

export function getSessionActionError(
  session: { teacherId: string; learnerId: string; status: string; scheduledAt: Date },
  actorId: string,
  action: SessionAction,
  now = new Date(),
): string | null {
  if (session.teacherId !== actorId && session.learnerId !== actorId) {
    return 'Only a session participant can perform this action.';
  }
  if (session.status !== 'scheduled') {
    return 'This session is no longer available for changes.';
  }
  if (action === 'complete' && actorId !== session.learnerId) {
    return 'Only the learner can confirm this session is complete.';
  }
  if (action === 'complete' && session.scheduledAt.getTime() > now.getTime()) {
    return 'You can complete a session after its scheduled time.';
  }
  if ((action === 'cancel' || action === 'reschedule') && session.scheduledAt.getTime() <= now.getTime()) {
    return 'This session has expired. Schedule a new session instead.';
  }
  return null;
}

export function hasSchedulingConflict(sessions: ScheduledWindow[], startsAt: Date, durationMinutes: number, excludeSessionId?: string): boolean {
  if (Number.isNaN(startsAt.getTime()) || durationMinutes <= 0) return false;
  const candidateEnd = startsAt.getTime() + durationMinutes * 60_000;
  return sessions.some(session => {
    if (session.id === excludeSessionId || session.status !== 'scheduled') return false;
    const sessionStart = session.scheduledAt.getTime();
    const sessionEnd = sessionStart + session.durationMinutes * 60_000;
    return startsAt.getTime() < sessionEnd && candidateEnd > sessionStart;
  });
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
}

export function formatTimeZoneLabel(date: Date): string {
  const zoneName = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value;
  return `${getLocalTimeZone()}${zoneName ? ` (${zoneName})` : ''}`;
}
