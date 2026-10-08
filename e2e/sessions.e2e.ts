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
    await expect(page.getByText('Learner confirms completion')).toBeVisible();
    await expect(page.locator('.complete-btn')).toHaveCount(0);
  });

  test('the learner completes it and exactly the set credits move once', async ({ page }) => {
    await signIn(page, lerato);
    await page.goto('/sessions');
    await page.locator('.complete-btn').click();
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
});
