import type { User } from '../types';

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function normalizeUserProfile(uid: string, raw: unknown): User {
  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

  return {
    uid,
    displayName: toSafeString(source.displayName),
    email: toSafeString(source.email),
    photoUrl: toSafeString(source.photoUrl),
    university: toSafeString(source.university),
    bio: toSafeString(source.bio),
    skillsTeach: toStringArray(source.skillsTeach),
    skillsLearn: toStringArray(source.skillsLearn),
    credits: toNumber(source.credits),
    rating: toNumber(source.rating),
    totalSessions: toNumber(source.totalSessions),
    joinedAt: toDate(source.joinedAt),
    isOnline: typeof source.isOnline === 'boolean' ? source.isOnline : false,
    lastSeen: toNullableDate(source.lastSeen),
  };
}

export function applyProfilePatch(current: User, patch: Partial<User>): User {
  return {
    ...current,
    ...patch,
    uid: current.uid,
    displayName: patch.displayName !== undefined ? toSafeString(patch.displayName) : current.displayName,
    email: patch.email !== undefined ? toSafeString(patch.email) : current.email,
    photoUrl: patch.photoUrl !== undefined ? toSafeString(patch.photoUrl) : current.photoUrl,
    university: patch.university !== undefined ? toSafeString(patch.university) : current.university,
    bio: patch.bio !== undefined ? toSafeString(patch.bio) : current.bio,
    skillsTeach: patch.skillsTeach !== undefined ? toStringArray(patch.skillsTeach) : current.skillsTeach,
    skillsLearn: patch.skillsLearn !== undefined ? toStringArray(patch.skillsLearn) : current.skillsLearn,
    credits: patch.credits !== undefined ? toNumber(patch.credits, current.credits) : current.credits,
    rating: patch.rating !== undefined ? toNumber(patch.rating, current.rating) : current.rating,
    totalSessions: patch.totalSessions !== undefined ? toNumber(patch.totalSessions, current.totalSessions) : current.totalSessions,
    joinedAt: patch.joinedAt !== undefined ? toDate(patch.joinedAt) : current.joinedAt,
    isOnline: patch.isOnline !== undefined ? Boolean(patch.isOnline) : current.isOnline,
    lastSeen: patch.lastSeen !== undefined ? toNullableDate(patch.lastSeen) : current.lastSeen ?? null,
  };
}
