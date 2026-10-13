import { describe, expect, it } from 'vitest';
import type { ProfileStats } from '../types';
import { overallSummary, pdfSafeText, progressReportContent, progressReportFileName } from './progressReport';

const stats: ProfileStats = {
  partners: 7, matchRequestsReceived: 4, matchAcceptanceRate: 75,
  sessionsCompleted: 6, sessionsTaught: 4, sessionsLearned: 2, sessionsCancelled: 0, sessionsUpcoming: 1,
  completionRate: 100, hoursTaught: 3.5, hoursLearned: 1,
  topSkills: [{ skill: 'Maths', count: 4 }],
  monthly: [{ month: '2026-09', sessions: 2 }, { month: '2026-10', sessions: 4 }],
  reviewsReceived: 2, averageRating: 4.5, reviewsGiven: 2,
  progress: { level: 'Active swapper', levelNumber: 3, percent: 10, nextLevel: 'Experienced', sessionsToNextLevel: 9 },
  recentActivity: [{ type: 'reviewed', skill: 'Maths', rating: 5, at: '2026-10-08T10:00:00.000Z' }, { type: 'taught', skill: 'Maths', at: '2026-10-07T10:00:00.000Z' }],
  lastActiveAt: '2026-10-08T10:00:00.000Z',
};
const person = { displayName: 'Stacy Mokgohloa', university: 'University of Mpumalanga' };

describe('downloadable progress report', () => {
  it('shows the level, the summary and the activity from the public statistics', () => {
    const c = progressReportContent(person, stats, new Date('2026-10-12T09:00:00Z'));
    expect(c.title).toBe('Stacy Mokgohloa: progress report');
    expect(c.subtitle).toContain('University of Mpumalanga');
    expect(c.level).toBe('Level 3: Active swapper');
    expect(c.levelDetail).toBe('9 more completed sessions to reach Experienced');
    expect(Object.fromEntries(c.rows)).toMatchObject({
      'Partners matched': '7',
      'Sessions completed': '6 (4 taught, 2 learned)',
      'Average rating': '4.5 out of 5 (2 reviews)',
      'Completion rate': '100%',
    });
    expect(c.overall).toBe('6 sessions completed (4 taught, 2 learned) with 7 partners over 4.5 hours; rated 4.5 out of 5 from 2 reviews.');
    expect(c).not.toHaveProperty('monthly');
    expect(c.topSkills).toBe('Maths (4)');
    expect(c.activity.map(([, text]) => text)).toEqual(['Received a 5-star review for Maths', 'Taught a Maths session']);
  });

  it('gives a sensible report for a student with no activity yet', () => {
    const c = progressReportContent({ displayName: 'New Student' }, null);
    expect(c.level).toBe('Level 1: New member');
    expect(c.overall).toBe('No matches or completed sessions yet.');
    expect(Object.fromEntries(c.rows)).toMatchObject({ 'Partners matched': '0', 'Average rating': 'No reviews yet', 'Completion rate': '—' });
    expect(c.activity).toEqual([]);
  });

  it('writes a match as what the student teaches and learns, in characters the PDF font has', () => {
    const c = progressReportContent(person, { ...stats, recentActivity: [{ type: 'matched', skill: 'Statistics ↔ Physics', at: '2026-10-08T10:00:00.000Z' }] });
    expect(c.activity[0][1]).toBe('Started a skill exchange: teaches Statistics, learns Physics');
    expect(pdfSafeText('Thandi 🎓 → Zoë — “ok”')).toBe('Thandi ? ? Zoë — “ok”');
  });

  it('sums up a student who has matched but not finished a session, in singular where needed', () => {
    expect(overallSummary({ ...stats, sessionsCompleted: 0, sessionsTaught: 0, sessionsLearned: 0, partners: 1, hoursTaught: 0, hoursLearned: 0, averageRating: null, reviewsReceived: 0 }))
      .toBe('No sessions completed yet with 1 partner; no reviews yet.');
    expect(overallSummary({ ...stats, sessionsCompleted: 1, sessionsTaught: 1, sessionsLearned: 0, partners: 1, hoursTaught: 1, hoursLearned: 0, averageRating: 5, reviewsReceived: 1 }))
      .toBe('1 session completed (1 taught, 0 learned) with 1 partner over 1 hour; rated 5.0 out of 5 from 1 review.');
  });

  it('names the file after the student, safely', () => {
    expect(progressReportFileName(person)).toBe('Stacy-Mokgohloa-progress-report.pdf');
    expect(progressReportFileName({ displayName: 'Zoë / O\'Neil' })).toBe('Zoe-ONeil-progress-report.pdf');
    expect(progressReportFileName({ displayName: '' })).toBe('eduswap-student-progress-report.pdf');
  });
});
