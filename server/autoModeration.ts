// Automatic moderation: hides a student from Explore, search and recommendations once enough
// different students report them (the rule is in autoModerationRules.ts). Hidden students can
// still sign in and use their existing matches, chats and sessions; an admin can show them
// again. Runs inside the EduSwap server with Firebase Admin, because changing another person's
// profile is not something a browser may do.
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AUTO_HIDE_WINDOW_DAYS, decideAutoHide, type OpenReport, type Standing } from './autoModerationRules';

const isClosed = (status: unknown) => status === 'suspended' || status === 'deactivated';

async function evaluate(targetUserId: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(targetUserId);
  const user = await userRef.get();
  if (!user.exists) return;
  const authUser = await getAuth().getUser(targetUserId).catch(() => null);
  const target = {
    uid: targetUserId,
    isAdmin: user.get('isAdmin') === true || authUser?.customClaims?.admin === true,
    active: !isClosed(user.get('accountStatus')),
    hidden: user.get('hiddenFromDiscovery') === true,
  };
  if (target.isAdmin || !target.active || target.hidden) return;

  const reportSnaps = await db.collection('reports')
    .where('targetUserId', '==', targetUserId)
    .where('status', '==', 'open')
    .get();
  const openReports: OpenReport[] = reportSnaps.docs.map(doc => ({
    id: doc.id,
    reporterId: String(doc.get('reporterId') ?? ''),
    targetUserId,
    createdAt: (doc.get('createdAt') as Timestamp | undefined)?.toDate() ?? new Date(0),
  }));

  const reporterIds = [...new Set(openReports.map(report => report.reporterId).filter(Boolean))];
  const reporterDocs = reporterIds.length ? await db.getAll(...reporterIds.map(id => db.collection('users').doc(id))) : [];
  const reporters: Record<string, Standing> = Object.fromEntries(reporterDocs.filter(doc => doc.exists).map(doc => [
    doc.id,
    {
      verified: doc.get('studentVerified') === true,
      goodStanding: !isClosed(doc.get('accountStatus')) && doc.get('hiddenFromDiscovery') !== true,
    },
  ]));

  const decision = decideAutoHide(target, openReports, reporters);
  if (!decision.hide) return;

  const now = Timestamp.now();
  const reason = `Hidden from Explore automatically after reports from ${decision.reporterIds.length} different students within ${AUTO_HIDE_WINDOW_DAYS} days.`;
  const batch = db.batch();
  batch.update(userRef, { hiddenFromDiscovery: true, hiddenAt: now, hiddenReason: reason });
  batch.set(db.collection('publicProfiles').doc(targetUserId), { hiddenFromDiscovery: true }, { merge: true });
  // Mark the reports as handled so that, if an admin shows the student again, the same reports
  // do not hide them again. New reports after that start a fresh count.
  for (const id of decision.reportIds) {
    batch.update(db.collection('reports').doc(id), { status: 'reviewing', autoActionAt: now, autoAction: 'profile_hidden' });
  }
  batch.set(db.collection('auditLogs').doc(), {
    adminId: 'system',
    action: 'profile_auto_hidden',
    targetId: targetUserId,
    details: reason,
    reporterCount: decision.reporterIds.length,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log(`[auto-moderation] hid ${targetUserId}: ${reason}`);
}

/**
 * Watches open reports and evaluates each reported student as reports arrive. The first
 * snapshot covers every open report, so reports made while the server was asleep or offline
 * are handled when it starts. Returns a function that stops watching.
 */
export function startAutoModeration(): () => void {
  const running = new Set<string>();
  const queued = new Set<string>();

  const run = async (targetUserId: string): Promise<void> => {
    // One evaluation per student at a time; a report arriving meanwhile triggers one more pass.
    if (running.has(targetUserId)) { queued.add(targetUserId); return; }
    running.add(targetUserId);
    try {
      await evaluate(targetUserId);
    } catch (error) {
      console.error(`[auto-moderation] could not evaluate ${targetUserId}:`, error);
    } finally {
      running.delete(targetUserId);
      if (queued.delete(targetUserId)) void run(targetUserId);
    }
  };

  const stop = getFirestore().collection('reports').where('status', '==', 'open').onSnapshot(snapshot => {
    const targets = new Set(snapshot.docChanges()
      .filter(change => change.type === 'added')
      .map(change => change.doc.get('targetUserId'))
      .filter((id): id is string => typeof id === 'string' && id.length > 0));
    targets.forEach(targetUserId => void run(targetUserId));
  }, error => console.error('[auto-moderation] stopped watching reports:', error));

  console.log('[auto-moderation] watching reports');
  return stop;
}
