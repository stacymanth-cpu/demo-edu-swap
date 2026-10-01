import { format, isToday, isYesterday } from 'date-fns';
import type { ChatMessage } from '../types';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

export function formatChatTime(date: Date): string {
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

export function isValidUrl(value: string): boolean {
  try {
    const normalized = value.trim();
    if (!normalized) return false;
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Find a video-call invite link in a chat message, if it has one. */
export function extractCallInvite(msg: Pick<ChatMessage, 'linkUrl' | 'text'>): { roomId: string; callType: 'audio' | 'video' } | null {
  const rawLink = msg.linkUrl || msg.text;
  if (!rawLink) return null;

  const urlMatch = rawLink.match(/https?:\/\/\S+/i);
  const parsedRaw = (urlMatch ? urlMatch[0] : rawLink).trim();

  try {
    const parsedUrl = new URL(parsedRaw);
    if (!parsedUrl.pathname.includes('/video-call')) return null;
    const room = parsedUrl.searchParams.get('room');
    if (!room) return null;
    return { roomId: room.trim(), callType: parsedUrl.searchParams.get('callType') === 'audio' ? 'audio' : 'video' };
  } catch {
    return null;
  }
}

export function formatLastSeen(date: Date | null, now = new Date()): string {
  if (!date) return 'Offline';
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} min${minutes === 1 ? '' : 's'} ago`;
  if (isToday(date)) return `Last seen today at ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Last seen yesterday at ${format(date, 'h:mm a')}`;
  return `Last seen ${format(date, 'MMM d, h:mm a')}`;
}

/** Delivery status of a message the current user sent; null for received messages. */
export function getMessageStatus(msg: Pick<ChatMessage, 'senderId' | 'isRead' | 'deliveredAt'>, currentUserId: string | undefined): MessageStatus | null {
  if (msg.senderId !== currentUserId) return null;
  return msg.isRead ? 'read' : msg.deliveredAt ? 'delivered' : 'sent';
}

/** Case-insensitive search over a message's text, link, file and note fields. */
export function messageMatchesSearch(msg: ChatMessage, normalizedQuery: string): boolean {
  return [msg.text, msg.linkTitle, msg.linkUrl, msg.fileName, msg.sharedNote?.title, msg.sharedNote?.content]
    .some(value => value?.toLowerCase().includes(normalizedQuery));
}

export const isPlainTextMessage = (msg: Pick<ChatMessage, 'linkUrl' | 'fileUrl' | 'sharedNote'>) =>
  !msg.linkUrl && !msg.fileUrl && !msg.sharedNote;
