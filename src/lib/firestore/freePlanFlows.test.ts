import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: {}, db: {} }));
vi.mock('./admin', () => ({ writeAuditLog: vi.fn() }));
vi.mock('./users', () => ({ getAllUsers: vi.fn(), updateUser: vi.fn() }));

const { resolveCreditAmount, DEFAULT_CREDITS_PER_SESSION } = await import('./credits');
const { averageFromTotals } = await import('./reviews');

describe('credits per session', () => {
  it('uses the admin setting when it is a positive whole number', () => {
    expect(resolveCreditAmount(15)).toBe(15);
  });

  it('falls back to the default for missing or invalid settings', () => {
    for (const value of [undefined, null, 0, -5, 2.5, '10']) {
      expect(resolveCreditAmount(value)).toBe(DEFAULT_CREDITS_PER_SESSION);
    }
  });
});

describe('average rating from running totals', () => {
  it('rounds to two decimals the same way the security rules do', () => {
    expect(averageFromTotals(3, 14)).toBe(4.67);
    expect(averageFromTotals(2, 9)).toBe(4.5);
    expect(averageFromTotals(1, 5)).toBe(5);
  });

  it('is zero when there are no reviews', () => {
    expect(averageFromTotals(0, 0)).toBe(0);
  });
});
