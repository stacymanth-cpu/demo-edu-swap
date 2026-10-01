import { describe, expect, it } from 'vitest';
import { calculateCreditTransfer } from './creditUtils';

describe('calculateCreditTransfer', () => {
  it('rewards the teacher and charges the learner', () => {
    expect(calculateCreditTransfer(20, 30, 10)).toEqual({ teacherCredits: 30, learnerCredits: 20, amount: 10 });
  });

  it('never creates a negative learner balance', () => {
    expect(calculateCreditTransfer(5, 4, 10).learnerCredits).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects an invalid transfer amount: %s', amount => {
    expect(() => calculateCreditTransfer(10, 10, amount)).toThrow();
  });
});
