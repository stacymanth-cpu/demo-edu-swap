import type { AiMatchRecommendation, AiSkillSuggestion, User } from '../types';

function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function getKeywordOverlapScore(skillName: string, current: User): number {
  const skillTokens = new Set(tokenize(skillName));
  const profileTokens = new Set([
    ...tokenize(current.bio || ''),
    ...current.skillsTeach.flatMap(tokenize),
    ...current.skillsLearn.flatMap(tokenize),
  ]);

  if (skillTokens.size === 0) return 0;

  let overlap = 0;
  skillTokens.forEach(token => {
    if (profileTokens.has(token)) overlap += 1;
  });
  return overlap / skillTokens.size;
}

function getPopularityScore(userCount: number, maxUserCount: number): number {
  if (maxUserCount <= 0) return 0;
  return Math.min(1, Math.max(0, userCount / maxUserCount));
}

function getAdjacentSkillScore(skillName: string, current: User): number {
  const target = normalizeSkill(skillName);
  const allKnown = current.skillsTeach.concat(current.skillsLearn).map(normalizeSkill);
  if (allKnown.length === 0) return 0;

  const hasProgramming = allKnown.some(s => /python|javascript|typescript|java|c\+\+|c#|react|web|data|machine/.test(s));
  const targetProgramming = /python|javascript|typescript|java|c\+\+|c#|react|web|data|machine|blockchain/.test(target);

  // Simple adjacency heuristic: if user is already in similar domain, boost.
  if (hasProgramming && targetProgramming) return 1;
  return 0.25;
}

export function getCompatibleTeachSkills(myTeach: string[], targetLearn: string[]): string[] {
  const normalizedTarget = targetLearn.map(normalizeSkill);
  return myTeach.filter(skill => normalizedTarget.includes(normalizeSkill(skill)));
}

export function getCompatibleLearnSkills(myLearn: string[], targetTeach: string[]): string[] {
  const normalizedTarget = targetTeach.map(normalizeSkill);
  return myLearn.filter(skill => normalizedTarget.includes(normalizeSkill(skill)));
}

function hasOverlappingAvailability(current: User, candidate: User): boolean {
  return (current.weeklyAvailability || []).some(currentSlot =>
    (candidate.weeklyAvailability || []).some(candidateSlot =>
      currentSlot.day === candidateSlot.day && currentSlot.start < candidateSlot.end && candidateSlot.start < currentSlot.end
    ),
  );
}

function hasLearningGoalOverlap(current: User, candidate: User): boolean {
  const currentGoals = new Set(tokenize(current.learningGoals || ''));
  return tokenize(candidate.learningGoals || '').some(token => currentGoals.has(token));
}

export function getMatchScore(current: User, candidate: User): number {
  const teachOverlap = getCompatibleTeachSkills(current.skillsTeach, candidate.skillsLearn).length;
  const learnOverlap = getCompatibleLearnSkills(current.skillsLearn, candidate.skillsTeach).length;
  if (teachOverlap === 0 || learnOverlap === 0) return 0;

  const skillScore = Math.min(60, 45 + Math.max(0, teachOverlap + learnOverlap - 2) * 5);
  const availabilityScore = candidate.availability === 'available' ? 12 : candidate.isOnline ? 6 : 0;
  const ratingScore = candidate.rating > 0 ? Math.max(0, Math.min(10, ((candidate.rating - 3) / 2) * 10)) : 0;
  const experienceScore = Math.min(8, Math.max(0, candidate.totalSessions) * 0.8);
  const verificationScore = candidate.studentVerified ? 6 : 0;
  const universityScore = current.university.trim().toLowerCase() === candidate.university.trim().toLowerCase() ? 2 : 0;
  const profileScore = (candidate.bio?.trim() ? 1 : 0) + (candidate.photoUrl ? 1 : 0);
  const preferenceScore = current.sessionPreference && candidate.sessionPreference && (current.sessionPreference === 'either' || candidate.sessionPreference === 'either' || current.sessionPreference === candidate.sessionPreference) ? 3 : 0;
  const languageScore = current.languages?.some(language => candidate.languages?.map(item => item.toLowerCase()).includes(language.toLowerCase())) ? 2 : 0;
  const candidateTeaches = getCompatibleLearnSkills(current.skillsLearn, candidate.skillsTeach);
  const skillLevelScore = candidateTeaches.some(skill => Boolean(candidate.skillLevels?.[skill])) ? 3 : 0;
  const availabilityOverlapScore = hasOverlappingAvailability(current, candidate) ? 6 : 0;
  const learningGoalScore = hasLearningGoalOverlap(current, candidate) ? 4 : 0;

  return Math.round(Math.min(100, skillScore + availabilityScore + ratingScore + experienceScore + verificationScore + universityScore + profileScore + preferenceScore + languageScore + skillLevelScore + availabilityOverlapScore + learningGoalScore));
}

export function getAiRecommendations(current: User, allUsers: User[]): AiMatchRecommendation[] {
  return allUsers
    .filter(u => u.uid !== current.uid)
    .filter(u => u.accountStatus !== 'deactivated' && u.accountStatus !== 'suspended')
    .filter(u => !current.blockedUserIds?.includes(u.uid) && !u.blockedUserIds?.includes(current.uid))
    .map(user => {
      const commonTeach = getCompatibleTeachSkills(current.skillsTeach, user.skillsLearn);
      const commonLearn = getCompatibleLearnSkills(current.skillsLearn, user.skillsTeach);
      const candidateTeaches = getCompatibleLearnSkills(current.skillsLearn, user.skillsTeach);
      const score = getMatchScore(current, user);
      const summaryParts: string[] = [];
      const reasons: string[] = [];
      if (commonTeach.length) summaryParts.push(`You can teach ${commonTeach.join(', ')}`);
      if (commonLearn.length) summaryParts.push(`They can teach you ${commonLearn.join(', ')}`);
      reasons.push(`${commonTeach.length + commonLearn.length} reciprocal skill connection${commonTeach.length + commonLearn.length === 1 ? '' : 's'}`);
      if (user.availability === 'available') reasons.push('Available to exchange');
      else if (user.isOnline) reasons.push('Online now');
      if (user.studentVerified) reasons.push('Verified student');
      if (user.rating >= 4.5 && user.totalSessions > 0) reasons.push('Strong session rating');
      if (current.university.trim().toLowerCase() === user.university.trim().toLowerCase()) reasons.push('Same university');
      if (current.sessionPreference === user.sessionPreference) reasons.push(`Both prefer ${user.sessionPreference === 'in_person' ? 'in-person' : user.sessionPreference} sessions`);
      if (hasOverlappingAvailability(current, user)) reasons.unshift('Shared study hours');
      if (hasLearningGoalOverlap(current, user)) reasons.unshift('Similar learning goals');
      if (candidateTeaches.length && candidateTeaches.some(skill => Boolean(user.skillLevels?.[skill]))) reasons.push('Teaching levels listed');
      return {
        user,
        score,
        commonTeach,
        commonLearn,
        summary: summaryParts.join(' • '),
        reasons: reasons.slice(0, 3),
      };
    })
    .filter(recommendation => recommendation.commonTeach.length > 0 && recommendation.commonLearn.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

type SkillCandidateInput = string | { name: string; userCount?: number };

export function getSmartSkillSuggestions(current: User, skillInputs: SkillCandidateInput[]): AiSkillSuggestion[] {
  const knownSkills = new Set(current.skillsLearn.map(normalizeSkill).concat(current.skillsTeach.map(normalizeSkill)));

  const candidates = skillInputs
    .map(input => {
      if (typeof input === 'string') {
        return { name: input, userCount: 0 };
      }
      return { name: input.name, userCount: input.userCount ?? 0 };
    })
    .filter(item => !knownSkills.has(normalizeSkill(item.name)));

  const maxUserCount = Math.max(1, ...candidates.map(candidate => candidate.userCount || 0));

  return candidates
    .map(candidate => {
      const overlapScore = getKeywordOverlapScore(candidate.name, current); // 0..1
      const popularityScore = getPopularityScore(candidate.userCount, maxUserCount); // 0..1
      const adjacentSkillScore = getAdjacentSkillScore(candidate.name, current); // 0..1

      // Weighted linear model then sigmoid for calibrated 0..100 confidence.
      const z =
        -0.6 +
        2.0 * overlapScore +
        1.1 * popularityScore +
        1.0 * adjacentSkillScore;

      const confidence = Math.round(Math.min(99, Math.max(35, sigmoid(z) * 100)));

      const reasonParts: string[] = [];
      if (overlapScore >= 0.34) reasonParts.push('aligns with your current profile goals');
      if (adjacentSkillScore >= 0.8) reasonParts.push('is close to skills you already have');
      if (popularityScore >= 0.5) reasonParts.push('has strong learner demand');

      const reason = reasonParts.length
        ? `Predicted fit because it ${reasonParts.join(', ')}.`
        : 'Predicted fit based on profile alignment and platform demand.';

      return {
        name: candidate.name,
        reason,
        confidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

export function userMatchesSearch(user: User, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    user.displayName.toLowerCase().includes(normalized) ||
    user.university.toLowerCase().includes(normalized) ||
    user.bio.toLowerCase().includes(normalized) ||
    user.skillsTeach.some(skill => skill.toLowerCase().includes(normalized)) ||
    user.skillsLearn.some(skill => skill.toLowerCase().includes(normalized))
  );
}
