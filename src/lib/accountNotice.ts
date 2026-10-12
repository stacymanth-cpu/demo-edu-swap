// Remembers, across the reload that follows a forced sign-out, that the account was closed
// (suspended or deactivated) while in use, so the sign-in page can say why.
const ACCOUNT_UNAVAILABLE_KEY = 'eduswap_account_unavailable';

export function markAccountUnavailable(): void {
  try { localStorage.setItem(ACCOUNT_UNAVAILABLE_KEY, 'true'); } catch { /* the sign-out still happens */ }
}

export function wasAccountUnavailable(): boolean {
  try { return localStorage.getItem(ACCOUNT_UNAVAILABLE_KEY) === 'true'; } catch { return false; }
}

export function clearAccountUnavailable(): void {
  try { localStorage.removeItem(ACCOUNT_UNAVAILABLE_KEY); } catch { /* nothing to clear */ }
}
