import { describe, it, expect } from 'vitest';
import { getPasswordRequirements, validateEmail, validatePassword, validateProfile } from './validation';

describe('validation utilities', () => {
  it('validateEmail accepts valid emails and rejects invalid ones', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('user@@example.com')).toBe(false);
    expect(validateEmail('.user@example.com')).toBe(false);
    expect(validateEmail('user@example..com')).toBe(false);
    expect(validateEmail('user@localhost')).toBe(false);
  });

  it('validatePassword enforces rules', () => {
    const short = validatePassword('Ab1!');
    expect(short.valid).toBe(false);

    const noLower = validatePassword('ABCDEFG1!');
    expect(noLower.valid).toBe(false);

    const noUpper = validatePassword('abcdefg1!');
    expect(noUpper.valid).toBe(false);

    const noNumber = validatePassword('Abcdefg!!');
    expect(noNumber.valid).toBe(false);

    const noSpecial = validatePassword('Abcdefg12');
    expect(noSpecial.valid).toBe(false);

    const whitespace = validatePassword('Abcd 3fgh!');
    expect(whitespace.valid).toBe(false);

    const good = validatePassword('Abcd3fgh!@');
    expect(good.valid).toBe(true);
  });

  it('reports password requirement status for live guidance', () => {
    const requirements = getPasswordRequirements('Abcd3fgh!@');

    expect(requirements).toHaveLength(7);
    expect(requirements.every(requirement => requirement.met)).toBe(true);
    expect(getPasswordRequirements('Abcd 3fgh!@').find(requirement => requirement.label === 'No spaces')?.met).toBe(false);
    expect(getPasswordRequirements('short').find(requirement => requirement.label === 'At least 10 characters')?.met).toBe(false);
  });

  it('validateProfile rejects oversized or incomplete profile data', () => {
    const validProfile = {
      displayName: 'Stacy Mokgohloa',
      bio: 'A short introduction',
      skillsTeach: ['Python'],
      skillsLearn: ['Design'],
      learningGoals: 'Improve my portfolio',
      languages: ['English'],
    };

    expect(validateProfile(validProfile)).toBeNull();
    expect(validateProfile({ ...validProfile, displayName: 'A' })).toContain('name');
    expect(validateProfile({ ...validProfile, bio: 'x'.repeat(501) })).toContain('bio');
    expect(validateProfile({ ...validProfile, skillsTeach: Array.from({ length: 21 }, () => 'Skill') })).toContain('20 skills');
    expect(validateProfile({ ...validProfile, languages: [''] })).toContain('languages');
  });
});
