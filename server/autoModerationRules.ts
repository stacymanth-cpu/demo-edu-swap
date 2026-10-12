// When reports hide a student automatically. Pure logic, no Firebase, so it is unit-tested on
// its own (autoModerationRules.test.ts); autoModeration.ts applies the decision.

/** Different students who must report someone before their profile is hidden. */
export const AUTO_HIDE_REPORTERS = 3;
/** Only reports from this many recent days count. */
export const AUTO_HIDE_WINDOW_DAYS = 30;

export interface OpenReport {
  id: string;
  reporterId: string;
  targetUserId: string;
  createdAt: Date;
}

export interface Standing {
  /** Verified student (confirmed university email). */
  verified: boolean;
  /** In good standing: not suspended, deactivated or hidden after reports. */
  goodStanding: boolean;
}

export interface Target {
  uid: string;
  isAdmin: boolean;
  /** Not suspended or deactivated. */
  active: boolean;
  /** Already hidden after reports. */
  hidden: boolean;
}

export interface HideDecision {
  hide: boolean;
  /** The distinct students whose reports counted. */
  reporterIds: string[];
  /** The reports that counted, to be marked as handled when the profile is hidden. */
  reportIds: string[];
}

/**
 * Hide when at least AUTO_HIDE_REPORTERS different verified students in good standing have
 * open reports about the target from the last AUTO_HIDE_WINDOW_DAYS days. A student reporting
 * the same person many times counts once; reports by suspended, hidden, unverified or unknown
 * accounts and self-reports never count; admins, closed accounts and already hidden students
 * are left alone.
 */
export function decideAutoHide(
  target: Target,
  openReports: OpenReport[],
  reporters: Record<string, Standing>,
  now = new Date(),
): HideDecision {
  const since = now.getTime() - AUTO_HIDE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const counted = openReports.filter(report =>
    report.targetUserId === target.uid
    && report.reporterId !== target.uid
    && report.createdAt.getTime() >= since
    && report.createdAt.getTime() <= now.getTime()
    && reporters[report.reporterId]?.verified === true
    && reporters[report.reporterId]?.goodStanding === true);
  const reporterIds = [...new Set(counted.map(report => report.reporterId))];
  const hide = !target.isAdmin && target.active && !target.hidden && reporterIds.length >= AUTO_HIDE_REPORTERS;
  return { hide, reporterIds, reportIds: counted.map(report => report.id) };
}
