import { expect, test, type Page } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { emulatorAdmin } from './admin';
import { STUDENTS } from './fixtures';
import { signIn } from './helpers';

const { ayanda, bongani, lerato, sipho, zanele } = STUDENTS;

/** Files a report the way the app does (open, with a time), straight into the emulator. */
async function report(reporterId: string, targetUserId: string) {
  await emulatorAdmin().db.collection('reports').add({
    reporterId, targetUserId, type: 'user', reason: 'Inappropriate behaviour', details: 'Inappropriate behaviour',
    status: 'open', createdAt: Timestamp.now(),
  });
}
const profile = async (uid: string) => (await emulatorAdmin().db.doc(`users/${uid}`).get()).data() ?? {};

/** Searches Explore's student list for a name. */
async function searchStudents(page: Page, name: string) {
  await page.goto('/explore');
  await page.locator('#explore-search-input').fill(name);
  await page.locator('#btn-search-users').click();
}

// The EduSwap server watches reports and hides a student from Explore once three different
// verified students have reported them. Each step builds on the last.
test.describe.serial('Automatic hiding after reports', () => {
  test('reports from two students, or from a suspended student, do not hide anyone', async () => {
    await report(ayanda.uid, zanele.uid);
    await report(ayanda.uid, zanele.uid); // the same student again counts once
    await report(bongani.uid, zanele.uid);
    await report(sipho.uid, zanele.uid); // suspended accounts' reports do not count
    // Give the server time to react; nothing should change.
    await new Promise(resolve => setTimeout(resolve, 4000));
    expect((await profile(zanele.uid)).hiddenFromDiscovery).not.toBe(true);
  });

  test('a third student\'s report hides them from Explore, but they can keep using the app', async ({ page, browser }) => {
    await signIn(page, zanele);

    await report(lerato.uid, zanele.uid);
    await expect.poll(async () => (await profile(zanele.uid)).hiddenFromDiscovery, { timeout: 20_000 }).toBe(true);
    expect((await profile(zanele.uid)).accountStatus).toBe('active');

    // Zanele stays signed in and is told what happened.
    await expect(page.getByText('Your profile is hidden from Explore because several students reported it.')).toBeVisible();
    await page.goto('/sessions');
    await expect(page).toHaveURL(/\/sessions$/);

    // Other students no longer find her.
    const ayandaPage = await (await browser.newContext()).newPage();
    try {
      await signIn(ayandaPage, ayanda);
      await searchStudents(ayandaPage, 'Zanele');
      await expect(ayandaPage.getByText('No users found matching "Zanele"')).toBeVisible();
    } finally {
      await ayandaPage.context().close();
    }

    const { db } = emulatorAdmin();
    const logs = await db.collection('auditLogs').where('targetId', '==', zanele.uid).get();
    expect(logs.docs.map(doc => doc.get('action'))).toContain('profile_auto_hidden');
    expect(logs.docs[0].get('adminId')).toBe('system');
    const reports = await db.collection('reports').where('targetUserId', '==', zanele.uid).get();
    // The reports that counted are marked handled; the suspended student's report stays open.
    expect(reports.docs.filter(doc => doc.get('status') === 'reviewing')).toHaveLength(4);
    expect(reports.docs.filter(doc => doc.get('status') === 'open').map(doc => doc.get('reporterId'))).toEqual([sipho.uid]);
  });

  test('an admin can show her again, and the same reports do not hide her again', async ({ page }) => {
    await signIn(page, STUDENTS.admin);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Students' }).click();
    const row = page.locator('.admin-row', { hasText: 'Zanele Mthembu' });
    await expect(row.getByText(/Hidden from Explore after reports/)).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: 'Show in Explore' }).click();
    await expect(row.getByRole('button', { name: 'Show in Explore' })).toHaveCount(0);

    await expect.poll(async () => (await profile(zanele.uid)).hiddenFromDiscovery).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 4000));
    expect((await profile(zanele.uid)).hiddenFromDiscovery).toBe(false);

    await searchStudents(page, 'Zanele');
    await expect(page.getByRole('heading', { name: 'Zanele Mthembu' })).toBeVisible();
  });
});
