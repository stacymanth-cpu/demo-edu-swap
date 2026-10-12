import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { emulatorAdmin } from './admin';
import { CREDITS_PER_SESSION, PAST_SESSION_ID, STARTING_CREDITS, STUDENTS } from './fixtures';
import { signIn } from './helpers';

const { lerato, thabo } = STUDENTS;
const credits = async (uid: string) => (await emulatorAdmin().db.doc(`users/${uid}`).get()).get('credits');

// Lerato (learner) and Thabo (teacher) have a seeded session that started an hour ago.
test.describe.serial('Completing a session', () => {
  test('the teacher cannot complete it', async ({ page }) => {
    await signIn(page, thabo);
    await page.goto('/sessions');
    // The Sessions page loads slowly on the emulator, so allow it longer than other checks.
    await expect(page.getByText('Learner confirms completion')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.complete-btn')).toHaveCount(0);
  });

  test('the learner completes it and exactly the set credits move once', async ({ page }) => {
    await signIn(page, lerato);
    await page.goto('/sessions');
    await page.locator('.complete-btn').click({ timeout: 30_000 });
    await expect(page.locator('.complete-btn')).toHaveCount(0);

    await expect.poll(() => credits(lerato.uid)).toBe(STARTING_CREDITS - CREDITS_PER_SESSION);
    await expect.poll(() => credits(thabo.uid)).toBe(STARTING_CREDITS + CREDITS_PER_SESSION);

    const { db } = emulatorAdmin();
    expect((await db.doc(`sessions/${PAST_SESSION_ID}`).get()).get('status')).toBe('completed');
    expect((await db.doc(`transactions/tx-${PAST_SESSION_ID}-teacher`).get()).get('amount')).toBe(CREDITS_PER_SESSION);
    expect((await db.doc(`transactions/tx-${PAST_SESSION_ID}-learner`).get()).get('amount')).toBe(-CREDITS_PER_SESSION);

    // Opening the page again shows it completed, with nothing left to complete.
    await page.reload();
    await expect(page.locator('.complete-btn')).toHaveCount(0);
    expect(await credits(lerato.uid)).toBe(STARTING_CREDITS - CREDITS_PER_SESSION);
  });

  test('the teacher\'s profile shows the session in their activity and performance', async ({ page }) => {
    // First visit to the tutor page in a run: the dev server compiles it on demand, which can be slow.
    test.setTimeout(120_000);
    // The EduSwap server recomputes the public summary after the completion.
    const stats = async () => (await emulatorAdmin().db.doc(`publicStats/${thabo.uid}`).get()).data();
    await expect.poll(async () => (await stats())?.sessionsTaught, { timeout: 20_000 }).toBe(1);
    expect(await stats()).toMatchObject({ partners: 1, sessionsCompleted: 1, sessionsLearned: 0, hoursTaught: 1, completionRate: 100 });

    // Another student opens Thabo's profile and reads his track record.
    await signIn(page, lerato);
    await page.goto(`/tutor/${thabo.uid}`);
    const panel = page.locator('.performance-panel');
    await expect(panel.getByRole('heading', { name: 'Progress report' })).toBeVisible({ timeout: 60_000 });
    await expect(panel.locator('.performance-tile', { hasText: 'Sessions completed' }).locator('strong')).toHaveText('1');
    await expect(panel.locator('.performance-tile', { hasText: 'Partners matched' }).locator('strong')).toHaveText('1');
    await expect(panel.getByText('Taught a Statistics session')).toBeVisible();
    // Partners are never named in the public activity.
    await expect(panel.getByText('Lerato')).toHaveCount(0);

    // Another student can download Thabo's report as a PDF.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('button', { name: 'Download report' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('Thabo-Khumalo-progress-report.pdf');
    await download.saveAs('e2e/.output/progress-report-sample.pdf');
    expect(readFileSync('e2e/.output/progress-report-sample.pdf').subarray(0, 5).toString()).toBe('%PDF-');
  });
});
