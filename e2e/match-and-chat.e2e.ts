import { expect, test, type Page } from '@playwright/test';
import { STUDENTS, displayName } from './fixtures';
import { signIn } from './helpers';

const { ayanda, bongani } = STUDENTS;

// Match the message bubble, not the same text previewed in the conversation list.
const bubble = (page: Page, text: string) => page.getByRole('paragraph').filter({ hasText: text });

// Ayanda teaches Python and wants Guitar; Bongani is the reverse. Each step builds on the last.
test.describe.serial('Explore, match and chat', () => {
  test('Ayanda finds Bongani with search and sends a match request', async ({ page }) => {
    await signIn(page, ayanda);
    await page.goto('/explore');

    await page.locator('#explore-search-input').fill('Bongani');
    await page.locator('#btn-search-users').click();
    const card = page.locator(`#btn-match-${bongani.uid}`);
    await expect(card).toBeVisible();
    await expect(page.getByText(displayName(STUDENTS.lerato))).toHaveCount(0);

    await card.click();
    await expect(page.getByRole('heading', { name: `Request Match with ${displayName(bongani)}` })).toBeVisible();
    await page.locator('#btn-send-match').click();
    await expect(page.getByText(`Match request sent to ${displayName(bongani)}!`)).toBeVisible();
  });

  test('Bongani accepts and both students can chat live', async ({ browser }) => {
    // One browser per student, closed afterwards so their live listeners don't keep the
    // emulator busy during later tests.
    const bonganiContext = await browser.newContext();
    const ayandaContext = await browser.newContext();
    try {
      const bonganiPage = await bonganiContext.newPage();
      await signIn(bonganiPage, bongani);
      await bonganiPage.goto('/matches');
      await bonganiPage.locator('[id^="accept-"]').first().click();
      await expect(bonganiPage.getByRole('button', { name: 'Accepted 1' })).toBeVisible();
      await bonganiPage.getByRole('button', { name: 'Accepted 1' }).click();
      await bonganiPage.getByRole('button', { name: 'Message' }).first().click();
      await expect(bonganiPage).toHaveURL(/\/chat/);

      const ayandaPage = await ayandaContext.newPage();
      await signIn(ayandaPage, ayanda);
      await ayandaPage.goto('/chat');
      await ayandaPage.getByText(displayName(bongani)).first().click();
      await ayandaPage.locator('#chat-input').fill('Hi Bongani, Python for Guitar this week?');
      await ayandaPage.locator('#btn-send-msg').click();

      await expect(bubble(bonganiPage, 'Hi Bongani, Python for Guitar this week?')).toBeVisible();
      await bonganiPage.locator('#chat-input').fill('Deal, Thursday works.');
      await bonganiPage.locator('#btn-send-msg').click();
      await expect(bubble(ayandaPage, 'Deal, Thursday works.')).toBeVisible();
    } finally {
      await Promise.all([bonganiContext.close(), ayandaContext.close()]);
    }
  });
});
