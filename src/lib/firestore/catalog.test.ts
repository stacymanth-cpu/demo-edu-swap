import { describe, expect, it, vi } from 'vitest';
import type { SkillInfo } from '../../types';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./admin', () => ({ writeAuditLog: vi.fn() }));
vi.mock('./users', () => ({ getPublicUsers: vi.fn() }));

const { toStudentCatalog } = await import('./catalog');

const skill = (name: string, category: SkillInfo['category'], isArchived?: boolean): SkillInfo => ({ name, category, userCount: 0, icon: 'BookOpen', isArchived });

describe('student skill catalogue', () => {
  it('includes every category, not only Technology', () => {
    const result = toStudentCatalog([skill('React', 'Technology'), skill('Guitar', 'Creative'), skill('isiZulu', 'Languages')], new Map());
    expect(result.map(item => item.category)).toEqual(expect.arrayContaining(['Technology', 'Creative', 'Languages']));
  });

  it('hides archived skills', () => {
    const result = toStudentCatalog([skill('React', 'Technology'), skill('Old skill', 'Academic', true)], new Map());
    expect(result.map(item => item.name)).toEqual(['React']);
  });

  it('counts learners case-insensitively and sorts by name', () => {
    const result = toStudentCatalog([skill('Python', 'Technology'), skill('Excel', 'Business')], new Map([['python', 3]]));
    expect(result.map(item => [item.name, item.userCount])).toEqual([['Excel', 0], ['Python', 3]]);
  });
});
