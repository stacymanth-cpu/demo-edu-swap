// Skills catalog and universities.
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { SkillInfo, University } from '../../types';
import { writeAuditLog } from './admin';
import { getPublicUsers } from './users';

export async function getSkillsCatalog(): Promise<SkillInfo[]> {
  const [skillsSnap, users] = await Promise.all([
    getDocs(collection(db, 'skillsCatalog')),
    getPublicUsers(),
  ]);

  const learnerCounts = new Map<string, number>();
  users.forEach((user) => {
    const skillsLearn = Array.isArray(user.skillsLearn) ? user.skillsLearn : [];
    const uniqueSkills = new Set(
      skillsLearn
        .filter((skill): skill is string => typeof skill === 'string')
        .map(skill => skill.trim().toLowerCase())
        .filter(Boolean)
    );

    uniqueSkills.forEach((skill) => {
      learnerCounts.set(skill, (learnerCounts.get(skill) || 0) + 1);
    });
  });

  return toStudentCatalog(skillsSnap.docs.map(d => d.data() as SkillInfo), learnerCounts);
}

/** Skills students can pick: every category, archived skills hidden, sorted by name. */
export function toStudentCatalog(skills: SkillInfo[], learnerCounts: Map<string, number>): SkillInfo[] {
  return skills
    .filter(skill => !skill.isArchived && typeof skill.name === 'string' && skill.name.trim())
    .map(skill => ({
      ...skill,
      userCount: learnerCounts.get(skill.name.trim().toLowerCase()) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAdminSkills(): Promise<(SkillInfo & { id: string })[]> {
  const snap = await getDocs(collection(db, 'skillsCatalog'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as SkillInfo & { id: string }));
}

export async function saveAdminSkill(adminId: string, skill: SkillInfo, skillId?: string): Promise<string> {
  const skillRef = skillId ? doc(db, 'skillsCatalog', skillId) : doc(collection(db, 'skillsCatalog'));
  await setDoc(skillRef, skill);
  await writeAuditLog({ adminId, action: skillId ? 'skill_updated' : 'skill_created', targetId: skillRef.id, details: skill.name });
  return skillRef.id;
}

export async function deleteAdminSkill(adminId: string, skillId: string): Promise<void> {
  const skillRef = doc(db, 'skillsCatalog', skillId);
  await updateDoc(skillRef, { isArchived: true });
  await writeAuditLog({ adminId, action: 'skill_archived', targetId: skillId, details: 'Skill archived from catalog' });
}

export async function getUniversities(): Promise<University[]> {
  const snap = await getDocs(collection(db, 'universities'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as University));
}
