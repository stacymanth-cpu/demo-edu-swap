export function validateEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9]+(?:[._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

export function getPasswordRequirements(password: string): { label: string; message: string; met: boolean }[] {
  return [
    { label: 'At least 10 characters', message: 'Password must be at least 10 characters long', met: password.length >= 10 },
    { label: 'No invalid characters', message: 'Password contains invalid characters', met: ![...password].some(character => character.charCodeAt(0) === 0) },
    { label: 'No spaces', message: 'Password cannot contain whitespace characters', met: !/\s/.test(password) },
    { label: 'A lowercase letter', message: 'Password must include a lowercase letter', met: /[a-z]/.test(password) },
    { label: 'An uppercase letter', message: 'Password must include an uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'A number', message: 'Password must include a number', met: /[0-9]/.test(password) },
    { label: 'A special character', message: 'Password must include at least one special character', met: /[!@#$%^&*(),.?":{}|<>[\]/`~_\-+'=]/.test(password) },
  ];
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  const unmetRequirement = getPasswordRequirements(password).find(requirement => !requirement.met);
  if (unmetRequirement) {
    return { valid: false, message: unmetRequirement.message };
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
