import { existsSync, readFileSync, statSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { PASSWORD, type TestStudent } from './fixtures';

const PIN_LOG = 'e2e/.output/pin-server.log';

const logSize = () => (existsSync(PIN_LOG) ? statSync(PIN_LOG).size : 0);

/** Waits for the PIN server to print a login PIN for `email` after byte `from` of its log. */
async function readPin(email: string, from: number): Promise<string> {
  const pattern = new RegExp(`\\[login PIN\\] ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: (\\d{6})`, 'g');
  let pin: string | undefined;
  await expect.poll(() => {
    const text = readFileSync(PIN_LOG).subarray(from).toString('utf8');
    pin = [...text.matchAll(pattern)].at(-1)?.[1];
    return pin;
  }, { message: `login PIN for ${email}`, timeout: 15_000 }).toBeTruthy();
  return pin!;
}

/** Signs in with email and password and stops on the PIN page. Returns the emailed PIN. */
export async function startSignIn(page: Page, student: TestStudent): Promise<string> {
  await page.goto('/login');
  await page.locator('#email').fill(student.email);
  await page.locator('#password').fill(PASSWORD);
  const from = logSize();
  await page.locator('#btn-login').click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  return readPin(student.email, from);
}

/** Full sign-in, PIN included, ending on the signed-in dashboard. */
export async function signIn(page: Page, student: TestStudent): Promise<void> {
  const pin = await startSignIn(page, student);
  await page.locator('#login-pin').fill(pin);
  await page.locator('#btn-verify-pin').click();
  await expect(page.locator('#sidebar-nav')).toBeVisible();
}
