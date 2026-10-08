import { expect, test } from '@playwright/test';
import { PASSWORD, STUDENTS } from './fixtures';
import { signIn, startSignIn } from './helpers';

test.describe('Sign in', () => {
  test('a wrong PIN is refused and the emailed PIN opens the dashboard', async ({ page }) => {
    const pin = await startSignIn(page, STUDENTS.ayanda);
    const wrong = pin === '000000' ? '111111' : '000000';

    await page.locator('#login-pin').fill(wrong);
    await page.locator('#btn-verify-pin').click();
    await expect(page.getByText(/Wrong PIN/)).toBeVisible();
    await expect(page.locator('#sidebar-nav')).toHaveCount(0);

    await page.locator('#login-pin').fill(pin);
    await page.locator('#btn-verify-pin').click();
    await expect(page.locator('#sidebar-nav')).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('a passed PIN survives a page refresh', async ({ page }) => {
    await signIn(page, STUDENTS.bongani);
    await page.reload();
    await expect(page.locator('#sidebar-nav')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0);
  });

  test('a wrong password stays on the sign-in page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(STUDENTS.ayanda.email);
    await page.locator('#password').fill('not-the-password');
    await page.locator('#btn-login').click();
    await expect(page.locator('.auth-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a suspended account cannot sign in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(STUDENTS.sipho.email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#btn-login').click();
    await expect(page.getByText(/currently unavailable/)).toBeVisible();
    await expect(page.locator('#sidebar-nav')).toHaveCount(0);
  });
});

test.describe('Access', () => {
  test('signed-out visitors are sent to sign in', async ({ page }) => {
    for (const path of ['/explore', '/matches', '/sessions', '/chat', '/profile']) {
      await page.goto(path);
      await expect(page, `visiting ${path}`).toHaveURL(/\/login$/);
    }
  });

  test('a student cannot open the admin console', async ({ page }) => {
    await signIn(page, STUDENTS.ayanda);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByText('Platform control room')).toHaveCount(0);
  });

  test('an admin can open the admin console', async ({ page }) => {
    await signIn(page, STUDENTS.admin);
    await page.goto('/admin');
    await expect(page.getByText('Platform control room')).toBeVisible();
  });
});

test.describe('Sign up', () => {
  test('a personal email is refused', async ({ page }) => {
    await page.goto('/signup');
    await fillSignUp(page, 'naledi.personal@gmail.com');
    await expect(page.getByText(/university email/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('a university email creates an account without asking for a PIN', async ({ page }) => {
    await page.goto('/signup');
    await fillSignUp(page, 'naledi@ump.ac.za');
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator('#sidebar-nav')).toBeVisible();

    // The new account is trusted for the sign-in that created it, even after a refresh.
    await page.reload();
    await expect(page.locator('#sidebar-nav')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0);
  });
});

async function fillSignUp(page: import('@playwright/test').Page, email: string) {
  await page.locator('#first-name').fill('Naledi');
  await page.locator('#last-name').fill('Zulu');
  await page.locator('#student-number').fill('202412345');
  await page.locator('#signup-university').selectOption('University of Mpumalanga');
  await page.locator('#student-email').fill(email);
  await page.locator('fieldset', { hasText: 'I can teach' }).getByRole('button', { name: 'Mathematics' }).click();
  await page.locator('fieldset', { hasText: 'I want to learn' }).getByRole('button', { name: 'Python' }).click();
  await page.locator('#signup-password').fill(PASSWORD);
  await page.locator('#confirm-password').fill(PASSWORD);
  await page.getByText('I confirm that I am currently a university student.').click();
  await page.getByText('I agree to the Terms and Conditions').click();
  await page.getByRole('button', { name: 'Create Student Account' }).click();
}
