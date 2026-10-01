import { describe, it, expect } from 'vitest';
import { getAiRecommendations, getCompatibleTeachSkills, getCompatibleLearnSkills, getMatchScore, getSmartSkillSuggestions, userMatchesSearch } from './matchUtils';
import type { User } from '../types';

describe('matchUtils', () => {
  const user: User = {
    uid: 'u1',
    displayName: 'Test User',
    email: 'test@example.com',
    photoUrl: '',
    university: 'Test University',
    bio: 'Loves teaching coding and math',
    skillsTeach: ['React', 'Python', 'Mathematics'],
    skillsLearn: ['Public Speaking', 'Spanish'],
    credits: 100,
    rating: 4.5,
    totalSessions: 10,
    joinedAt: new Date(),
    isOnline: true,
  };

  it('finds compatible teach skills', () => {
    expect(getCompatibleTeachSkills(['React', 'Python', 'Mathematics'], ['Python', 'Spanish'])).toEqual(['Python']);
    expect(getCompatibleTeachSkills(['React'], ['Python'])).toEqual([]);
  });

  it('finds compatible learn skills', () => {
    expect(getCompatibleLearnSkills(['Public Speaking', 'Spanish'], ['Spanish', 'React'])).toEqual(['Spanish']);
    expect(getCompatibleLearnSkills(['Public Speaking'], ['React'])).toEqual([]);
  });

  it('matches user search across fields', () => {
    expect(userMatchesSearch(user, 'react')).toBe(true);
    expect(userMatchesSearch(user, 'spanish')).toBe(true);
    expect(userMatchesSearch(user, 'Test University')).toBe(true);
    expect(userMatchesSearch(user, 'math')).toBe(true);
    expect(userMatchesSearch(user, 'unsupported')).toBe(false);
    expect(userMatchesSearch(user, '')).toBe(true);
  });

  it('returns bounded, sorted ML-style skill suggestion confidence', () => {
    const suggestions = getSmartSkillSuggestions(user, [
      { name: 'Blockchain', userCount: 34 },
      { name: 'Data Science', userCount: 76 },
      { name: 'C++', userCount: 102 },
      { name: 'C#', userCount: 94 },
      { name: 'Python', userCount: 156 }, // should be filtered because user already teaches it
    ]);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every(s => s.confidence >= 35 && s.confidence <= 99)).toBe(true);

    for (let i = 1; i < suggestions.length; i += 1) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }

    expect(suggestions.some(s => s.name === 'Python')).toBe(false);
  });

  it('scores only reciprocal matches on a 0–100 scale', () => {
    const reciprocalCandidate = { ...user, uid: 'u2', skillsTeach: ['Spanish'], skillsLearn: ['React'], rating: 5, studentVerified: true };
    const oneWayCandidate = { ...user, uid: 'u3', skillsTeach: ['Spanish'], skillsLearn: ['Cooking'] };

    expect(getMatchScore(user, reciprocalCandidate)).toBeGreaterThan(0);
    expect(getMatchScore(user, reciprocalCandidate)).toBeLessThanOrEqual(100);
    expect(getMatchScore(user, oneWayCandidate)).toBe(0);
  });

  it('filters blocked and one-way candidates and explains recommendations', () => {
    const reciprocalCandidate = { ...user, uid: 'u2', displayName: 'Match', skillsTeach: ['Spanish'], skillsLearn: ['React'], availability: 'available' as const };
    const oneWayCandidate = { ...user, uid: 'u3', skillsTeach: ['Spanish'], skillsLearn: ['Cooking'] };
    const blockedCandidate = { ...reciprocalCandidate, uid: 'u4', blockedUserIds: [user.uid] };
    const recommendations = getAiRecommendations(user, [reciprocalCandidate, oneWayCandidate, blockedCandidate]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].user.uid).toBe('u2');
    expect(recommendations[0].reasons.length).toBeGreaterThan(0);
  });

  it('boosts matches with compatible study times, listed teaching levels, and aligned goals', () => {
    const basic = { ...user, uid: 'u2', skillsTeach: ['Spanish'], skillsLearn: ['React'] };
    const enriched = {
      ...basic,
      learningGoals: 'Build confidence for public speaking',
      skillLevels: { React: 'Advanced' as const },
      weeklyAvailability: [{ day: 2 as const, start: '10:00', end: '12:00' }],
    };
    const current = {
      ...user,
      learningGoals: 'Practice public speaking with confidence',
      weeklyAvailability: [{ day: 2 as const, start: '11:00', end: '13:00' }],
    };

    expect(getMatchScore(current, enriched)).toBeGreaterThan(getMatchScore(current, basic));
    expect(getAiRecommendations(current, [enriched])[0].reasons).toContain('Shared study hours');
    expect(getAiRecommendations(current, [enriched])[0].reasons).toContain('Similar learning goals');
  });
});
