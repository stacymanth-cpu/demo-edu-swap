import { describe, expect, it } from 'vitest';
import {
  extractCallInvite, formatFileSize, formatLastSeen, getInitials, getMessageStatus,
  isPlainTextMessage, isValidUrl, messageMatchesSearch,
} from './chatUtils';
import type { ChatMessage } from '../types';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1', senderId: 'alice', text: 'Hello', timestamp: new Date(), isRead: false, ...overrides,
});

describe('chat helpers', () => {
  it('builds initials from a name', () => {
    expect(getInitials('Thandi Nkosi')).toBe('TN');
  });

  it('accepts only http and https links', () => {
    expect(isValidUrl('https://eduswap.app')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('  ')).toBe(false);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('finds call invites in links or text', () => {
    expect(extractCallInvite({ text: 'Join https://eduswap.app/video-call?room=abc&callType=audio' }))
      .toEqual({ roomId: 'abc', callType: 'audio' });
    expect(extractCallInvite({ text: '', linkUrl: 'https://eduswap.app/video-call?room=xyz' }))
      .toEqual({ roomId: 'xyz', callType: 'video' });
    expect(extractCallInvite({ text: 'https://eduswap.app/chat?room=abc' })).toBeNull();
    expect(extractCallInvite({ text: 'no link here' })).toBeNull();
  });

  it('describes last-seen times', () => {
    const now = new Date('2026-09-30T12:00:00');
    expect(formatLastSeen(null, now)).toBe('Offline');
    expect(formatLastSeen(new Date('2026-09-30T11:59:40'), now)).toBe('Last seen just now');
    expect(formatLastSeen(new Date('2026-09-30T11:59:00'), now)).toBe('Last seen 1 min ago');
    expect(formatLastSeen(new Date('2026-09-30T11:15:00'), now)).toBe('Last seen 45 mins ago');
  });

  it('reports delivery status only for the sender', () => {
    expect(getMessageStatus(message(), 'bob')).toBeNull();
    expect(getMessageStatus(message(), 'alice')).toBe('sent');
    expect(getMessageStatus(message({ deliveredAt: new Date() }), 'alice')).toBe('delivered');
    expect(getMessageStatus(message({ isRead: true }), 'alice')).toBe('read');
  });

  it('searches text, links, files and notes case-insensitively', () => {
    expect(messageMatchesSearch(message({ text: 'Calculus notes' }), 'calculus')).toBe(true);
    expect(messageMatchesSearch(message({ fileName: 'Week3.PDF' }), 'week3.pdf')).toBe(true);
    expect(messageMatchesSearch(message({ sharedNote: { title: 'Loops', content: 'for and while' } }), 'while')).toBe(true);
    expect(messageMatchesSearch(message(), 'python')).toBe(false);
  });

  it('treats only messages without attachments as editable text', () => {
    expect(isPlainTextMessage(message())).toBe(true);
    expect(isPlainTextMessage(message({ linkUrl: 'https://x.dev' }))).toBe(false);
  });
});
