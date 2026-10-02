// "Remember me" on the sign-in page: the last remembered email on this device, used to prefill
// the form. Storage can be blocked (private windows), so every access is guarded.
const REMEMBERED_EMAIL_KEY = 'eduswap_remembered_email';

export function getRememberedEmail(): string {
  try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { return ''; }
}

export function rememberEmail(email: string, remember: boolean): void {
  try {
    if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Storage blocked: the student simply types their email next time.
  }
}
