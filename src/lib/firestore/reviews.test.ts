import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./admin', () => ({ writeAuditLog: vi.fn() }));

// Each query records its filter; getDocs answers with one review per requested id.
const queries: { field: string; op: string; value: unknown }[] = [];
vi.mock('firebase/firestore', async importOriginal => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: vi.fn(() => ({})),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  query: vi.fn((_collection: unknown, filter: { field: string; op: string; value: unknown }) => { queries.push(filter); return filter; }),
  getDocs: vi.fn(async (filter: { op: string; value: unknown }) => {
    const ids = filter.op === 'in' ? (filter.value as string[]) : [String(filter.value)];
    return {
      docs: ids.flatMap(id => [
        { id: `review-of-${id}`, data: () => ({ targetUserId: id, userId: id, text: 'Clear and patient', rating: 5 }) },
        { id: `removed-${id}`, data: () => ({ targetUserId: id, userId: id, moderationStatus: 'removed' }) },
      ]),
    };
  }),
}));

const { getReviewsAbout, getReviewsBy } = await import('./reviews');

beforeEach(() => { queries.length = 0; });

describe('targeted review reads', () => {
  it('reads reviews about the given students only, skipping removed ones and duplicates', async () => {
    const reviews = await getReviewsAbout(['me', 'partner', 'me', '']);
    expect(queries).toEqual([{ field: 'targetUserId', op: 'in', value: ['me', 'partner'] }]);
    expect(reviews.map(review => review.id)).toEqual(['review-of-me', 'review-of-partner']);
  });

  it('splits long lists into groups of 30, the most an `in` filter allows', async () => {
    const ids = Array.from({ length: 65 }, (_, i) => `student-${i}`);
    const reviews = await getReviewsAbout(ids);
    expect(queries.map(q => (q.value as string[]).length)).toEqual([30, 30, 5]);
    expect(reviews).toHaveLength(65);
  });

  it('makes no query when there is nobody to look up', async () => {
    expect(await getReviewsAbout([])).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it('reads the reviews a student wrote', async () => {
    const reviews = await getReviewsBy('me');
    expect(queries).toEqual([{ field: 'userId', op: '==', value: 'me' }]);
    expect(reviews.map(review => review.id)).toEqual(['review-of-me']);
  });
});
