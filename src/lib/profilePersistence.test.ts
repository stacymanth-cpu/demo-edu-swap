import { describe, it, expect } from 'vitest';
import { normalizeUserProfile, applyProfilePatch } from './profilePersistence';

describe('profile persistence', () => {
  it('normalizes legacy or partial user documents for retrieval', () => {
    const profile = normalizeUserProfile('user-123', {
      displayName: 'Ada',
      email: 'ada@example.com',
      university: 'University of Cape Town',
      skillsTeach: ['React'],
      skillsLearn: ['Node'],
      bio: 'Learning',
      credits: '10',
      rating: 4.5,
      totalSessions: 2,
      joinedAt: '2024-01-01T00:00:00.000Z',
      isOnline: true,
      lastSeen: null,
    });

    expect(profile.uid).toBe('user-123');
    expect(profile.displayName).toBe('Ada');
    expect(profile.email).toBe('ada@example.com');
    expect(profile.skillsTeach).toEqual(['React']);
    expect(profile.skillsLearn).toEqual(['Node']);
    expect(profile.bio).toBe('Learning');
    expect(profile.university).toBe('University of Cape Town');
    expect(profile.credits).toBe(0);
    expect(profile.rating).toBe(4.5);
    expect(profile.totalSessions).toBe(2);
    expect(profile.joinedAt).toBeInstanceOf(Date);
    expect(profile.isOnline).toBe(true);
  });

  it('allows profile patches to merge cleanly while preserving defaults', () => {
    const updated = applyProfilePatch({
      uid: 'user-1',
      displayName: 'Old Name',
      email: 'old@example.com',
      photoUrl: '',
      university: '',
      bio: '',
      skillsTeach: [],
      skillsLearn: [],
      credits: 50,
      rating: 0,
      totalSessions: 0,
      joinedAt: new Date('2024-01-01T00:00:00.000Z'),
      isOnline: false,
      lastSeen: null,
    }, {
      displayName: 'New Name',
      bio: 'Updated bio',
      skillsTeach: ['Python'],
      skillsLearn: ['Design'],
      photoUrl: 'https://cdn.example.com/a.png',
    });

    expect(updated.displayName).toBe('New Name');
    expect(updated.bio).toBe('Updated bio');
    expect(updated.skillsTeach).toEqual(['Python']);
    expect(updated.skillsLearn).toEqual(['Design']);
    expect(updated.photoUrl).toBe('https://cdn.example.com/a.png');
    expect(updated.credits).toBe(50);
  });
});
