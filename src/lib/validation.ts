export function validateEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9]+(?:[._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long' };
  }
  if ([...password].some(character => character.charCodeAt(0) === 0)) {
    return { valid: false, message: 'Password contains invalid characters' };
  }
  if (/\s/.test(password)) {
    return { valid: false, message: 'Password cannot contain whitespace characters' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include a lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include an uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include a number' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>[\]/`~_\-+'=]/.test(password)) {
    return { valid: false, message: 'Password must include at least one special character' };
  }
  return { valid: true };
}

export interface ProfileValidationInput {
  displayName: string;
  bio: string;
  skillsTeach: string[];
  skillsLearn: string[];
  learningGoals: string;
  languages: string[];
}

export function validateProfile(input: ProfileValidationInput): string | null {
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  const learningGoals = input.learningGoals.trim();

  if (displayName.length < 2 || displayName.length > 80) {
    return 'Your name must be between 2 and 80 characters.';
  }
  if (bio.length > 500) return 'Your bio must be 500 characters or fewer.';
  if (learningGoals.length > 500) return 'Learning goals must be 500 characters or fewer.';
  if (input.skillsTeach.length > 20 || input.skillsLearn.length > 20) {
    return 'You can add up to 20 skills in each list.';
  }
  if (input.skillsTeach.some(skill => !skill.trim() || skill.trim().length > 60) || input.skillsLearn.some(skill => !skill.trim() || skill.trim().length > 60)) {
    return 'Each skill must be between 1 and 60 characters.';
  }
  if (input.languages.length > 12 || input.languages.some(language => !language.trim() || language.trim().length > 40)) {
    return 'Add up to 12 languages, with no language longer than 40 characters.';
  }
  return null;
}
