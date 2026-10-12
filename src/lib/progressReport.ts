// Downloadable progress report: the same public summary as the profile's Progress report
// panel, as a PDF any signed-in student can save. Partners and reviewers are never named.
import type { ProfileStats } from '../types';

export interface ReportPerson {
  displayName: string;
  university?: string;
}

export interface ReportContent {
  title: string;
  subtitle: string;
  level: string;
  levelDetail: string;
  percent: number;
  rows: [string, string][];
  monthly: [string, string][];
  topSkills: string;
  activity: [string, string][];
  footer: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;
const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${Math.round(value)}%`);
const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

const ACTIVITY: Record<ProfileStats['recentActivity'][number]['type'], (skill: string, rating?: number) => string> = {
  // Matches are stored as "what they teach ↔ what they learn".
  matched: skill => {
    const [teaches, learns] = skill.split('↔').map(part => part.trim());
    return learns !== undefined ? `Started a skill exchange: teaches ${teaches || '—'}, learns ${learns || '—'}` : `Started a skill exchange: ${skill}`;
  },
  taught: skill => `Taught a ${skill} session`,
  learned: skill => `Learned ${skill} in a session`,
  reviewed: (skill, rating) => `Received a ${rating ?? ''}-star review for ${skill}`,
};

/** Everything the PDF shows, worked out from the student's public statistics. */
export function progressReportContent(person: ReportPerson, stats: ProfileStats | null, generatedAt = new Date()): ReportContent {
  const progress = stats?.progress ?? { level: 'New member', levelNumber: 1, percent: 0, nextLevel: 'Getting started', sessionsToNextLevel: 1 };
  const reviews = stats?.reviewsReceived ?? 0;
  return {
    title: `${person.displayName || 'EduSwap student'}: progress report`,
    subtitle: [person.university, `Generated ${generatedAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`].filter(Boolean).join(' · '),
    level: `Level ${progress.levelNumber}: ${progress.level}`,
    levelDetail: progress.nextLevel
      ? `${progress.sessionsToNextLevel} more completed session${progress.sessionsToNextLevel === 1 ? '' : 's'} to reach ${progress.nextLevel}`
      : 'Highest level reached',
    percent: progress.percent,
    rows: [
      ['Partners matched', String(stats?.partners ?? 0)],
      ['Match requests accepted', percent(stats?.matchAcceptanceRate)],
      ['Sessions completed', `${stats?.sessionsCompleted ?? 0} (${stats?.sessionsTaught ?? 0} taught, ${stats?.sessionsLearned ?? 0} learned)`],
      ['Hours taught / learned', `${stats?.hoursTaught ?? 0} / ${stats?.hoursLearned ?? 0}`],
      ['Completion rate', percent(stats?.completionRate)],
      ['Cancelled / upcoming sessions', `${stats?.sessionsCancelled ?? 0} / ${stats?.sessionsUpcoming ?? 0}`],
      ['Average rating', stats?.averageRating ? `${stats.averageRating.toFixed(1)} out of 5 (${reviews} review${reviews === 1 ? '' : 's'})` : 'No reviews yet'],
      ['Reviews given', String(stats?.reviewsGiven ?? 0)],
      ['Last active', stats?.lastActiveAt ? dateText(stats.lastActiveAt) : '—'],
    ],
    monthly: (stats?.monthly ?? []).map(m => [monthName(m.month), String(m.sessions)]),
    topSkills: stats?.topSkills?.length ? stats.topSkills.map(s => `${s.skill} (${s.count})`).join(', ') : 'None yet',
    activity: (stats?.recentActivity ?? []).map(a => [dateText(a.at), ACTIVITY[a.type](a.skill, a.rating)]),
    footer: 'EduSwap updates this report automatically after every match, session and review. Partners and reviewers are not named.',
  };
}

/**
 * The PDF's built-in font covers Latin-1 and common punctuation only; anything else (arrows,
 * emoji, other scripts) would garble the whole line, so it is replaced with "?".
 */
export function pdfSafeText(text: string): string {
  return text.replace(/[^ -ÿ–—‘’“”…•]/gu, '?');
}

/** A safe file name, for example "Stacy-Mokgohloa-progress-report.pdf". */
export function progressReportFileName(person: ReportPerson): string {
  const base = (person.displayName || 'eduswap-student').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `${base || 'eduswap-student'}-progress-report.pdf`;
}

/** Builds the PDF and saves it in the browser. jsPDF loads only when this runs. */
export async function downloadProgressReport(person: ReportPerson, stats: ProfileStats | null): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const raw = progressReportContent(person, stats);
  const safeRows = (rows: [string, string][]) => rows.map(([a, b]) => [pdfSafeText(a), pdfSafeText(b)] as [string, string]);
  const c: ReportContent = {
    ...raw,
    title: pdfSafeText(raw.title), subtitle: pdfSafeText(raw.subtitle), topSkills: pdfSafeText(raw.topSkills),
    rows: safeRows(raw.rows), monthly: safeRows(raw.monthly), activity: safeRows(raw.activity),
  };
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18, right = 192, width = right - left;
  const indigo: [number, number, number] = [79, 70, 229];
  const navy: [number, number, number] = [30, 27, 75];
  const grey: [number, number, number] = [100, 116, 139];
  let y = 22;

  const ensureSpace = (needed: number) => { if (y + needed > 280) { pdf.addPage(); y = 20; } };
  const heading = (text: string) => {
    ensureSpace(14);
    y += 4;
    pdf.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...navy).text(text, left, y);
    y += 6;
  };
  const table = (rows: [string, string][], labelWidth: number) => {
    pdf.setFontSize(10.5);
    rows.forEach(([label, value], i) => {
      const lines = pdf.splitTextToSize(value, width - labelWidth - 4) as string[];
      const h = Math.max(7, lines.length * 5 + 2);
      ensureSpace(h);
      if (i % 2 === 0) pdf.setFillColor(241, 242, 250).rect(left, y - 5, width, h, 'F');
      pdf.setFont('helvetica', 'bold').setTextColor(...navy).text(label, left + 2, y);
      pdf.setFont('helvetica', 'normal').setTextColor(17, 24, 39).text(lines, left + labelWidth, y);
      y += h;
    });
  };

  pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...indigo).text('EDUSWAP · PROGRESS REPORT', left, y);
  y += 9;
  pdf.setFontSize(18).setTextColor(...navy).text(pdf.splitTextToSize(c.title, width) as string[], left, y);
  y += 8;
  pdf.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...grey).text(c.subtitle, left, y);
  y += 10;

  pdf.setFillColor(238, 242, 255).roundedRect(left, y - 6, width, 22, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...navy).text(c.level, left + 5, y + 1);
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...grey).text(c.levelDetail, left + 5, y + 7);
  pdf.setFillColor(255, 255, 255).roundedRect(left + 5, y + 10, width - 10, 3, 1.5, 1.5, 'F');
  if (c.percent > 0) pdf.setFillColor(...indigo).roundedRect(left + 5, y + 10, Math.max(3, (width - 10) * c.percent / 100), 3, 1.5, 1.5, 'F');
  y += 24;

  heading('Summary');
  table(c.rows, 62);
  heading('Sessions completed per month');
  table(c.monthly, 62);
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...grey);
  ensureSpace(8);
  pdf.text(`Most taught: ${c.topSkills}`, left, y + 1);
  y += 6;
  heading('Recent activity');
  if (c.activity.length) table(c.activity, 34);
  else { pdf.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...grey).text('No matches, completed sessions or reviews yet.', left, y); y += 7; }

  ensureSpace(14);
  y += 6;
  pdf.setDrawColor(203, 213, 225).line(left, y - 4, right, y - 4);
  pdf.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...grey).text(pdf.splitTextToSize(c.footer, width) as string[], left, y);
  pdf.save(progressReportFileName(person));
}
