// Emailed one-time PIN checked at every login. The local server (npm run livekit:server)
// sends and checks the PIN, then records the passed sign-in in loginVerifications/{uid}.
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const tokenEndpoint = (import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT as string | undefined) || '/api/livekit/token';
const otpBase = (import.meta.env.VITE_OTP_ENDPOINT as string | undefined)
  || new URL('/api/otp', new URL(tokenEndpoint, window.location.origin)).href;

async function callOtpServer(firebaseUser: FirebaseUser, action: string, body: object = {}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${otpBase}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the EduSwap PIN service. Please try again shortly.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
}

/** True when this sign-in has already passed the login PIN (survives page refreshes). */
export async function isLoginVerified(firebaseUser: FirebaseUser): Promise<boolean> {
  const { claims } = await firebaseUser.getIdTokenResult();
  const snapshot = await getDoc(doc(db, 'loginVerifications', firebaseUser.uid));
  return snapshot.exists() && snapshot.data().authTime === Number(claims.auth_time);
}

export function sendLoginPin(firebaseUser: FirebaseUser, resend = false): Promise<void> {
  return callOtpServer(firebaseUser, 'send', { resend });
}

export function verifyLoginPin(firebaseUser: FirebaseUser, pin: string): Promise<void> {
  return callOtpServer(firebaseUser, 'verify', { pin });
}

/** A brand-new account is not asked for a PIN on the sign-in that created it. */
export function trustNewAccount(firebaseUser: FirebaseUser): Promise<void> {
  return callOtpServer(firebaseUser, 'trust-new-account');
}
