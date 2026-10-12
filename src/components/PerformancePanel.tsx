import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, BookOpen, CheckCircle2, Download, GraduationCap, Handshake, Loader2, Star, TrendingUp, Users } from 'lucide-react';
import { subscribeProfileStats } from '../lib/firestoreService';
import { downloadProgressReport, type ReportPerson } from '../lib/progressReport';
import type { ProfileStats } from '../types';
import './PerformancePanel.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (key: string) => MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);
const reviewCount = (n: number) => `${n} review${n === 1 ? '' : 's'}`;

const ACTIVITY_TEXT = {
  matched: { icon: Handshake, text: (skill: string) => `Started a skill exchange: ${skill}` },
  taught: { icon: GraduationCap, text: (skill: string) => `Taught a ${skill} session` },
  learned: { icon: BookOpen, text: (skill: string) => `Learned ${skill} in a session` },
  reviewed: { icon: Star, text: (skill: string, rating?: number) => `Received a ${rating ?? ''}-star review for ${skill}` },
} as const;

/**
 * A student's progress report on EduSwap: level, partners, sessions, reviews, completion,
 * monthly sessions and recent activity. Computed by the EduSwap server after every match,
 * session and review; partners and reviewers are never named. Every signed-in student can see it.
 */
export function PerformancePanel({ uid, person, ownProfile = false, className = '' }: { uid: string; person: ReportPerson; ownProfile?: boolean; className?: string }) {
  const [stats, setStats] = useState<ProfileStats | null | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => subscribeProfileStats(uid, setStats), [uid]);

  if (stats === undefined) return null;

  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadProgressReport(person, stats);
    } catch (error) {
      console.error('Could not create the progress report:', error);
      setDownloadError('The report could not be downloaded. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const tiles = [
    { icon: Users, label: 'Partners matched', value: String(stats?.partners ?? 0), detail: stats?.matchAcceptanceRate === null || !stats ? 'No requests answered yet' : `${percent(stats.matchAcceptanceRate)} of requests accepted` },
    { icon: CheckCircle2, label: 'Sessions completed', value: String(stats?.sessionsCompleted ?? 0), detail: `${stats?.sessionsTaught ?? 0} taught · ${stats?.sessionsLearned ?? 0} learned` },
    { icon: Star, label: 'Average rating', value: stats?.averageRating ? `${stats.averageRating.toFixed(1)}★` : '—', detail: `${reviewCount(stats?.reviewsReceived ?? 0)} received · ${stats?.reviewsGiven ?? 0} given` },
    { icon: GraduationCap, label: 'Hours taught', value: String(stats?.hoursTaught ?? 0), detail: `${stats?.hoursLearned ?? 0} hours learned` },
    { icon: Activity, label: 'Completion rate', value: percent(stats?.completionRate ?? null), detail: `${stats?.sessionsCancelled ?? 0} cancelled · ${stats?.sessionsUpcoming ?? 0} upcoming` },
  ];
  const monthly = stats?.monthly ?? [];
  const max = Math.max(1, ...monthly.map(m => m.sessions));
  const latest = monthly[monthly.length - 1];
  const progress = stats?.progress ?? { level: 'New member', levelNumber: 1, percent: 0, nextLevel: 'Getting started', sessionsToNextLevel: 1 };
  const nextStep = progress.nextLevel
    ? `${progress.sessionsToNextLevel} more completed session${progress.sessionsToNextLevel === 1 ? '' : 's'} to reach ${progress.nextLevel}`
    : 'Highest level reached';

  return (
    <section className={`performance-panel ${className}`.trim()} aria-labelledby="performance-title">
      <div className="performance-heading">
        <div>
          <h2 id="performance-title">Progress report</h2>
          <p>{ownProfile ? 'Your report as other students see it. It updates automatically after every match, session and review.' : 'Updated automatically after every match, session and review.'}</p>
        </div>
        <div className="performance-heading-actions">
          {stats?.lastActiveAt && <span className="performance-last-active">Last active {formatDistanceToNow(new Date(stats.lastActiveAt), { addSuffix: true })}</span>}
          <button type="button" className="performance-download" id="btn-download-report" onClick={() => void download()} disabled={downloading}>
            {downloading ? <Loader2 size={15} className="spinner" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
            {downloading ? 'Preparing…' : 'Download report'}
          </button>
        </div>
      </div>
      {downloadError && <p className="performance-download-error" role="alert">{downloadError}</p>}

      <div className="performance-progress">
        <span className="performance-tile-icon"><TrendingUp size={16} aria-hidden="true" /></span>
        <div className="performance-progress-text">
          <strong>Level {progress.levelNumber}: {progress.level}</strong>
          <small>{nextStep}</small>
        </div>
        <div className="performance-progress-track" role="progressbar" aria-label={`Progress to ${progress.nextLevel ?? 'the highest level'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div className="performance-progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="performance-tiles">
        {tiles.map(({ icon: Icon, label, value, detail }) => (
          <div className="performance-tile" key={label}>
            <span className="performance-tile-icon"><Icon size={16} aria-hidden="true" /></span>
            <strong>{value}</strong>
            <span className="performance-tile-label">{label}</span>
            <small>{detail}</small>
          </div>
        ))}
      </div>

      <div className="performance-body">
        <figure className="performance-chart">
          <figcaption>Sessions completed per month</figcaption>
          <div className="performance-bars" role="img" aria-label={`Sessions completed per month: ${monthly.map(m => `${monthLabel(m.month)} ${m.sessions}`).join(', ')}`}>
            {monthly.map(m => (
              <div className="performance-bar-slot" key={m.month}>
                <div className="performance-bar-track">
                  {m === latest && m.sessions > 0 && <span className="performance-bar-value">{m.sessions}</span>}
                  <div
                    className="performance-bar"
                    style={{ height: `${(m.sessions / max) * 100}%` }}
                    data-tooltip={`${monthLabel(m.month)}: ${m.sessions} session${m.sessions === 1 ? '' : 's'}`}
                    tabIndex={0}
                    aria-label={`${monthLabel(m.month)}: ${m.sessions} sessions`}
                  />
                </div>
                <span className="performance-bar-label">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
          {stats?.topSkills?.length ? (
            <p className="performance-top-skills">Most taught: {stats.topSkills.map(s => `${s.skill} (${s.count})`).join(', ')}</p>
          ) : null}
        </figure>

        <div className="performance-activity">
          <h3>Recent activity</h3>
          {stats?.recentActivity?.length ? (
            <ul>
              {stats.recentActivity.map((item, i) => {
                const { icon: Icon, text } = ACTIVITY_TEXT[item.type];
                return (
                  <li key={`${item.at}-${i}`}>
                    <Icon size={15} aria-hidden="true" />
                    <span>{text(item.skill, item.rating)}</span>
                    <time dateTime={item.at}>{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="performance-empty">{ownProfile ? 'Your matches, completed sessions and reviews will appear here.' : 'No matches, completed sessions or reviews yet.'}</p>
          )}
        </div>
      </div>
    </section>
  );
}
