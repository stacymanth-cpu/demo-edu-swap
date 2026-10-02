// Automatic student verification by university email.
//
// A student who signs in with an address at an approved university domain (admin setting,
// e.g. "ump.ac.za") and confirms it through Firebase's verification link is verified without
// an admin. Firebase certifies `email_verified` inside the sign-in token, and firestore.rules
// only accept this self-verification when that claim is true and the domain is on the list.
// Everyone else uploads proof of registration for an admin to review.
import { sendEmailVerification } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { updateUser } from './users';

/** Used until an admin saves a list; keep in step with the default in firestore.rules. */
export const DEFAULT_VERIFIED_EMAIL_DOMAINS = ['ump.ac.za'];

/** "Student@UMP.ac.za" → "ump.ac.za"; empty for anything that is not an email address. */
export function emailDomain(email: string | null | undefined): string {
  const at = (email || '').lastIndexOf('@');
  return at > 0 ? (email || '').slice(at + 1).trim().toLowerCase() : '';
}

/** Clean an admin-entered list: lower case, no "@", no blanks or duplicates. */
export function normalizeDomains(domains: unknown): string[] {
  if (!Array.isArray(domains)) return [];
  return Array.from(new Set(domains
    .filter((domain): domain is string => typeof domain === 'string')
    .map(domain => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(domain => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain))));
}

export function isUniversityEmail(email: string | null | undefined, domains: string[]): boolean {
  const domain = emailDomain(email);
  return Boolean(domain) && domains.includes(domain);
}

export async function getVerifiedEmailDomains(): Promise<string[]> {
  const settings = await getDoc(doc(db, 'settings', 'platform'));
  const saved = settings.data()?.verifiedEmailDomains;
  return Array.isArray(saved) ? normalizeDomains(saved) : DEFAULT_VERIFIED_EMAIL_DOMAINS;
}

/** Send Firebase's "confirm your email" link to the signed-in student's address. */
export async function sendUniversityVerificationEmail(): Promise<void> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('Please sign in again.');
  await sendEmailVerification(firebaseUser);
}

export type AutoVerifyResult = 'verified' | 'already_verified' | 'not_university_email' | 'email_not_confirmed';

/**
 * Verify the signed-in student if their confirmed email belongs to an approved university.
 * Safe to call any time; it only writes when every condition holds.
 */
export async function tryAutoVerifyStudent(alreadyVerified: boolean): Promise<AutoVerifyResult> {
  if (alreadyVerified) return 'already_verified';
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return 'email_not_confirmed';

  const domains = await getVerifiedEmailDomains();
  if (!isUniversityEmail(firebaseUser.email, domains)) return 'not_university_email';

  // Pick up a confirmation made in another tab, then refresh the token so the rules see it.
  await firebaseUser.reload();
  if (!firebaseUser.emailVerified) return 'email_not_confirmed';
  await firebaseUser.getIdToken(true);

  await updateUser(firebaseUser.uid, {
    studentVerified: true,
    registrationVerificationStatus: 'approved',
    verificationMethod: 'university_email',
    verifiedEmailDomain: emailDomain(firebaseUser.email),
  });
  return 'verified';
}
