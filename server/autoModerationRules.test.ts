import { describe, expect, it } from 'vitest';
import { AUTO_HIDE_WINDOW_DAYS, decideAutoHide, type OpenReport, type Standing } from './autoModerationRules';

const now = new Date('2026-10-08T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const target = { uid: 'target', isAdmin: false, active: true, hidden: false };
const good: Standing = { verified: true, goodStanding: true };
const reporters: Record<string, Standing> = {
  a: good, b: good, c: good, d: good,
  unverified: { verified: false, goodStanding: true },
  suspendedOrHidden: { verified: true, goodStanding: false },
};

let nextId = 0;
const report = (reporterId: string, createdAt = daysAgo(1), targetUserId = 'target'): OpenReport => ({ id: `r${nextId++}`, reporterId, targetUserId, createdAt });

describe('automatic hiding from reports', () => {
  it('hides after reports from three different verified students', () => {
    const decision = decideAutoHide(target, [report('a'), report('b'), report('c')], reporters, now);
    expect(decision.hide).toBe(true);
    expect(decision.reporterIds).toEqual(['a', 'b', 'c']);
    expect(decision.reportIds).toHaveLength(3);
  });

  it('does not hide after two students, however many times they report', () => {
    const decision = decideAutoHide(target, [report('a'), report('a'), report('a'), report('b')], reporters, now);
    expect(decision.hide).toBe(false);
    expect(decision.reporterIds).toEqual(['a', 'b']);
  });

  it('ignores reports from unverified, suspended or hidden, and unknown accounts', () => {
    const decision = decideAutoHide(target, [report('a'), report('b'), report('unverified'), report('suspendedOrHidden'), report('stranger')], reporters, now);
    expect(decision.hide).toBe(false);
  });

  it('ignores self-reports and reports about someone else', () => {
    const decision = decideAutoHide(target, [report('a'), report('b'), report('target'), report('c', daysAgo(1), 'other')], { ...reporters, target: good }, now);
    expect(decision.hide).toBe(false);
  });

  it(`only counts reports from the last ${AUTO_HIDE_WINDOW_DAYS} days`, () => {
    const old = decideAutoHide(target, [report('a'), report('b'), report('c', daysAgo(AUTO_HIDE_WINDOW_DAYS + 1))], reporters, now);
    expect(old.hide).toBe(false);
    const edge = decideAutoHide(target, [report('a'), report('b'), report('c', daysAgo(AUTO_HIDE_WINDOW_DAYS))], reporters, now);
    expect(edge.hide).toBe(true);
  });

  it('leaves admins, closed accounts and already hidden students alone', () => {
    const reports = [report('a'), report('b'), report('c')];
    expect(decideAutoHide({ ...target, isAdmin: true }, reports, reporters, now).hide).toBe(false);
    expect(decideAutoHide({ ...target, active: false }, reports, reporters, now).hide).toBe(false);
    expect(decideAutoHide({ ...target, hidden: true }, reports, reporters, now).hide).toBe(false);
  });
});
