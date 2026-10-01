import type { User } from '../types';

const publicProfileFields = [
  'uid',
  'displayName',
  'photoUrl',
  'university',
  'bio',
  'skillsTeach',
  'skillsLearn',
  'rating',
  'totalSessions',
  'joinedAt',
  'isOnline',
  'lastSeen',
  'availability',
  'verifiedSkills',
  'studentVerified',
  'accountStatus',
  'skillLevels',
  'introductionVideoUrl',
  'introductionVideoVisibility',
  'learningGoals',
  'preferredTeachingStyle',
  'languages',
  'sessionPreference',
  'weeklyAvailability',
] satisfies readonly (keyof User)[];

export function toPublicUserProfile(data: Partial<User>): Partial<User> {
  const source = data as Record<string, unknown>;
  const profile = Object.fromEntries(
    publicProfileFields
      .filter(field => source[field] !== undefined)
      .map(field => [field, source[field]])
  ) as Partial<User>;
  if ((data.introductionVideoVisibility || 'members') !== 'members') {
    delete profile.introductionVideoUrl;
  }
  return profile;
}