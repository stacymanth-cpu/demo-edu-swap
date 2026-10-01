// Shared converters used by every Firestore module.
import { Timestamp, type DocumentData } from 'firebase/firestore';
import { toPublicUserProfile } from '../publicUserProfile';
import type { User } from '../../types';

/**
 * Turn a Firebase Storage upload failure into a message a student can act on.
 * A missing bucket (Storage never enabled for the project) surfaces as unknown/not-found codes.
 */
export function toStorageUploadError(error: unknown): Error {
  const code = (error as { code?: string })?.code || '';
  console.error('Storage upload failed:', code, error);
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return new Error('You do not have permission to upload this file. Sign out, sign back in, and try again.');
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') {
    return new Error('The upload could not finish. Check your internet connection and try again.');
  }
  if (['storage/bucket-not-found', 'storage/project-not-found', 'storage/object-not-found', 'storage/quota-exceeded', 'storage/unknown'].includes(code)) {
    return new Error('File uploads are not available right now because file storage is not set up on the server. Please contact the EduSwap team.');
  }
  return error instanceof Error ? error : new Error('The upload failed. Please try again.');
}

export function sanitizeForFirestore<T>(value: T): T {
  if (value === null || value === undefined) {
    return undefined as T;
  }

  if (value instanceof Date || value instanceof Timestamp) {
    return value as T;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as T;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, sanitizeForFirestore(entryValue)] as const);
    return Object.fromEntries(entries) as T;
  }

  return value;
}


export function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
}

export function mapUserData(data: DocumentData, uid: string, includePrivateFields: boolean): User {
  const profile = includePrivateFields
    ? data
    : toPublicUserProfile(data as Partial<User>);
  return {
    ...profile,
    uid,
    email: includePrivateFields && typeof data.email === 'string' ? data.email : '',
    university: profile.university || '',
    bio: profile.bio || '',
    skillsTeach: Array.isArray(profile.skillsTeach) ? profile.skillsTeach : [],
    skillsLearn: Array.isArray(profile.skillsLearn) ? profile.skillsLearn : [],
    credits: includePrivateFields && typeof data.credits === 'number' ? data.credits : 0,
    rating: typeof profile.rating === 'number' ? profile.rating : 0,
    totalSessions: typeof profile.totalSessions === 'number' ? profile.totalSessions : 0,
    joinedAt: toDate(profile.joinedAt),
    isOnline: typeof profile.isOnline === 'boolean' ? profile.isOnline : false,
    lastSeen: profile.lastSeen ? toDate(profile.lastSeen) : null,
    isAdmin: includePrivateFields && data.isAdmin === true,
    accountStatus: profile.accountStatus || 'active',
    studentVerified: profile.studentVerified === true,
    availability: profile.availability || (profile.isOnline ? 'available' : 'offline'),
    skillLevels: profile.skillLevels || {},
    introductionVideoUrl: profile.introductionVideoUrl || '',
    registrationVerificationStatus: includePrivateFields
      ? data.registrationVerificationStatus || 'not_submitted'
      : 'not_submitted',
    learningGoals: profile.learningGoals || '',
    preferredTeachingStyle: profile.preferredTeachingStyle || 'practical',
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    sessionPreference: profile.sessionPreference || 'either',
    savedUserIds: includePrivateFields && Array.isArray(data.savedUserIds) ? data.savedUserIds : [],
    hiddenUserIds: includePrivateFields && Array.isArray(data.hiddenUserIds) ? data.hiddenUserIds : [],
    introductionVideoVisibility: profile.introductionVideoVisibility || 'members',
  } as User;
}

export function publicProfilePayload(data: Partial<User>): DocumentData {
  const profile: DocumentData = { ...toPublicUserProfile(data) };
  if (data.joinedAt instanceof Date) profile.joinedAt = Timestamp.fromDate(data.joinedAt);
  if (data.lastSeen instanceof Date) profile.lastSeen = Timestamp.fromDate(data.lastSeen);
  return profile;
}
