import { describe, expect, it } from 'vitest';
import {
  buildCallInviteLink, buildIceServers, formatDuration, getCallPartnerName, getConnectionPhase,
  getDisplayedConnectionLabel, getMediaErrorMessage, getScreenShareErrorMessage, getScreenShareSupportIssue,
} from './callUtils';

const idle = { hasError: false, hasRemoteStream: false, inRoom: false, isRinging: false, isLocalMediaReady: false };

describe('call helpers', () => {
  it('derives the connection phase in priority order', () => {
    expect(getConnectionPhase(idle)).toBe('setup');
    expect(getConnectionPhase({ ...idle, isLocalMediaReady: true })).toBe('ready');
    expect(getConnectionPhase({ ...idle, inRoom: true })).toBe('connecting');
    expect(getConnectionPhase({ ...idle, inRoom: true, isRinging: true })).toBe('ringing');
    expect(getConnectionPhase({ ...idle, inRoom: true, hasRemoteStream: true })).toBe('connected');
    expect(getConnectionPhase({ ...idle, hasRemoteStream: true, hasError: true })).toBe('error');
  });

  it('lets connection problems override the phase label', () => {
    expect(getDisplayedConnectionLabel('connected', 'good')).toBe('Connected');
    expect(getDisplayedConnectionLabel('connected', 'reconnecting')).toBe('Reconnecting');
    expect(getDisplayedConnectionLabel('connecting', 'failed')).toBe('Connection failed');
  });

  it('explains media permission errors', () => {
    expect(getMediaErrorMessage({ name: 'NotAllowedError' })).toContain('blocked');
    expect(getMediaErrorMessage({ name: 'NotFoundError' })).toContain('No camera');
    expect(getMediaErrorMessage({ name: 'NotReadableError' })).toContain('in use');
    expect(getMediaErrorMessage(new Error('other'))).toContain('could not access');
  });

  it('formats durations as mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(75)).toBe('01:15');
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('builds invite links with optional chat and session context', () => {
    expect(buildCallInviteLink('https://eduswap.app', 'r1')).toBe('https://eduswap.app/video-call?room=r1');
    expect(buildCallInviteLink('https://eduswap.app', 'r1', 'c1', 's1'))
      .toBe('https://eduswap.app/video-call?room=r1&chatRoomId=c1&sessionId=s1');
  });

  it('adds a TURN relay only when fully configured', () => {
    expect(buildIceServers({}).iceServers).toHaveLength(2);
    expect(buildIceServers({ VITE_TURN_URLS: 'turn:relay.example:80' }).iceServers).toHaveLength(2);
    const withTurn = buildIceServers({
      VITE_TURN_URLS: 'turn:relay.example:80, turns:relay.example:443?transport=tcp',
      VITE_TURN_USERNAME: 'user',
      VITE_TURN_CREDENTIAL: 'secret',
    }).iceServers || [];
    expect(withTurn).toHaveLength(3);
    expect(withTurn[2]).toEqual({
      urls: ['turn:relay.example:80', 'turns:relay.example:443?transport=tcp'],
      username: 'user',
      credential: 'secret',
    });
  });

  it('explains screen sharing failures', () => {
    expect(getScreenShareErrorMessage({ name: 'NotAllowedError', message: 'Permission denied' })).toBeNull();
    expect(getScreenShareErrorMessage({ name: 'NotAllowedError', message: 'Permission denied by system' })).toContain('Screen Recording');
    expect(getScreenShareErrorMessage({ name: 'NotReadableError' })).toContain('could not be captured');
    expect(getScreenShareErrorMessage({ name: 'NotSupportedError' })).toContain('not available on this device');
    expect(getScreenShareErrorMessage({ name: 'TypeError', message: 'bad' })).toContain('(TypeError: bad)');
  });

  it('identifies why screen sharing is unavailable', () => {
    const desktop = { hasGetDisplayMedia: true, isSecureContext: true, isEmbedded: false, isMobile: false };
    expect(getScreenShareSupportIssue(desktop)).toBeNull();
    expect(getScreenShareSupportIssue({ ...desktop, isMobile: true })).toContain('Phones and tablets');
    expect(getScreenShareSupportIssue({ ...desktop, isSecureContext: false, hasGetDisplayMedia: false })).toContain('secure address');
    expect(getScreenShareSupportIssue({ ...desktop, isEmbedded: true })).toContain('embedded previews');
    expect(getScreenShareSupportIssue({ ...desktop, hasGetDisplayMedia: false })).toContain('does not support');
  });

  it('names the other person in a call', () => {
    expect(getCallPartnerName({ participantNames: { alice: 'Alice', bob: 'Bob' } }, 'alice')).toBe('Bob');
    expect(getCallPartnerName({ participantNames: { alice: 'Alice' } }, 'alice')).toBe('Call partner');
  });
});
