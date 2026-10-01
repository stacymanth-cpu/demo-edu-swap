import { describe, expect, it } from 'vitest';
import { toPublicUserProfile } from './publicUserProfile';

describe('toPublicUserProfile', () => {
  it('keeps profile fields needed for student discovery', () => {
    const profile = toPublicUserProfile({
      uid: 'student-1',
      displayName: 'Student One',
      university: 'University of Example',
      skillsTeach: ['Python'],
      skillsLearn: ['Design'],
      studentVerified: true,
      rating: 4.8,
    });

    expect(profile).toMatchObject({
      uid: 'student-1',
      displayName: 'Student One',
      university: 'University of Example',
      skillsTeach: ['Python'],
      skillsLearn: ['Design'],
      studentVerified: true,
      rating: 4.8,
    });
  });

  it('excludes contact, identity, and account data', () => {
    const profile = toPublicUserProfile({
      uid: 'student-1',
      displayName: 'Student One',
      email: 'student@example.edu',
      mobileNumber: '+27000000000',
      studentNumber: '12345678',
      credits: 50,
      isAdmin: true,
      blockedUserIds: ['student-2'],
      registrationVerificationStatus: 'approved',
      notificationPreferences: { inApp: true, email: false, sessionReminders: true, messages: true },
    });

    expect(profile).toEqual({ uid: 'student-1', displayName: 'Student One' });
  });

  it('does not publish restricted introduction-video URLs', () => {
    const profile = toPublicUserProfile({
      uid: 'student-1',
      displayName: 'Student One',
      introductionVideoUrl: 'https://example.com/private-video',
      introductionVideoVisibility: 'matches',
    });

    expect(profile.introductionVideoVisibility).toBe('matches');
    expect(profile).not.toHaveProperty('introductionVideoUrl');
  });
});