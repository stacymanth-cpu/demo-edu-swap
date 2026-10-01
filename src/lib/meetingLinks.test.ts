import { describe, it, expect } from 'vitest';
import { isValidTeamsLink, resolveMeetingJoinTarget } from './meetingLinks';

describe('isValidTeamsLink', () => {
  it('accepts Microsoft Teams URLs', () => {
    expect(isValidTeamsLink('https://teams.microsoft.com/l/meetup-join/abc123')).toBe(true);
  });

  it('rejects non-Teams URLs', () => {
    expect(isValidTeamsLink('https://zoom.us/j/123')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isValidTeamsLink('')).toBe(false);
  });

  it('resolves Teams links as external joins', () => {
    expect(resolveMeetingJoinTarget('https://teams.microsoft.com/l/meetup-join/abc123', 'http://localhost:5173')).toEqual({
      kind: 'external',
      href: 'https://teams.microsoft.com/l/meetup-join/abc123',
    });
  });

  it('resolves in-app video links as internal joins', () => {
    expect(resolveMeetingJoinTarget('http://localhost:5173/video-call?room=abc123', 'http://localhost:5173')).toEqual({
      kind: 'internal',
      href: '/video-call?room=abc123',
    });
  });
});
