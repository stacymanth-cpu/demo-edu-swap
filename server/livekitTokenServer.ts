import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AccessToken } from 'livekit-server-sdk';
import nodemailer from 'nodemailer';

// Hosts such as Render assign the port through PORT.
const port = Number(process.env.PORT || process.env.LIVEKIT_TOKEN_PORT || 8787);
const liveKitApiKey = process.env.LIVEKIT_API_KEY;
const liveKitApiSecret = process.env.LIVEKIT_API_SECRET;
// Comma-separated list, e.g. "http://localhost:5173,http://127.0.0.1:5173".
const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean);

if (!liveKitApiKey || !liveKitApiSecret) {
  throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required.');
}

// Login PINs are emailed either through Brevo's email API (BREVO_API_KEY, sent over HTTPS,
// for hosts that block outgoing SMTP) or from a Gmail account using an app password
// (Google Account > Security > 2-Step Verification > App passwords).
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS?.replace(/\s/g, '');
const brevoApiKey = process.env.BREVO_API_KEY;
// The sender address; with Brevo it must be a sender verified in the Brevo account.
const mailFrom = process.env.MAIL_FROM || smtpUser;
const mailer = !brevoApiKey && smtpUser && smtpPass
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } })
  : null;
if (brevoApiKey && !mailFrom) {
  throw new Error('Set MAIL_FROM to the sender address verified in Brevo.');
}
if (!brevoApiKey && !mailer) {
  console.warn('No email settings (BREVO_API_KEY, or SMTP_USER/SMTP_PASS): login PINs will be printed here instead of emailed (local testing only).');
}

const PIN_TTL_MS = 10 * 60 * 1000;
const PIN_RESEND_MS = 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;
// A brand-new account skips the login PIN for the sign-in that created it.
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

initializeApp();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, body: unknown): void {
  const origin = request.headers.origin;
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
}

async function authenticate(request: IncomingMessage): Promise<DecodedIdToken> {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required.');
  try {
    return await getAuth().verifyIdToken(authorization.slice('Bearer '.length));
  } catch {
    throw new HttpError(401, 'Your sign-in has expired. Please sign in again.');
  }
}

async function readBody<T>(request: IncomingMessage): Promise<T> {
  let rawBody = '';
  for await (const chunk of request) rawBody += chunk;
  try {
    return JSON.parse(rawBody || '{}') as T;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}

async function assertActiveAccount(uid: string): Promise<void> {
  const profile = await getFirestore().collection('users').doc(uid).get();
  const status = profile.data()?.accountStatus;
  if (status === 'suspended' || status === 'deactivated') throw new HttpError(403, 'This account is currently unavailable.');
}

function hashPin(uid: string, authTime: number, pin: string): Buffer {
  return createHash('sha256').update(`${uid}:${authTime}:${pin}`).digest();
}

/** Marks this sign-in (identified by its auth_time) as having passed the login PIN. */
async function markLoginVerified(uid: string, authTime: number): Promise<void> {
  await getFirestore().collection('loginVerifications').doc(uid).set({ authTime, verifiedAt: new Date() });
}

async function handleLiveKitToken(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const decoded = await authenticate(request);
  const profile = await getFirestore().collection('users').doc(decoded.uid).get();
  const profileData = profile.data();
  if (!profile.exists || profileData?.accountStatus === 'suspended' || profileData?.accountStatus === 'deactivated') {
    throw new HttpError(403, 'This account cannot join group calls.');
  }
  const body = await readBody<{ room?: string }>(request);
  const room = body.room?.trim();
  if (!room || !/^[a-zA-Z0-9_-]{1,128}$/.test(room)) throw new HttpError(400, 'A valid room is required.');
  const groupRoom = await getFirestore().collection('groupCallRooms').doc(room).get();
  const groupRoomData = groupRoom.data();
  if (!groupRoom.exists || groupRoomData?.status !== 'open' || !Array.isArray(groupRoomData.participants) || !groupRoomData.participants.includes(decoded.uid)) {
    throw new HttpError(403, 'You are not allowed to join this group call.');
  }

  const liveKitRoom = `EduSwap-${room}`;
  const token = new AccessToken(liveKitApiKey, liveKitApiSecret, {
    identity: decoded.uid,
    name: decoded.name || decoded.email || decoded.uid,
    ttl: '10m',
  });
  token.addGrant({ roomJoin: true, room: liveKitRoom, canPublish: true, canSubscribe: true });
  sendJson(request, response, 200, { token: await token.toJwt(), url: process.env.LIVEKIT_URL });
}

async function handleSendPin(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const decoded = await authenticate(request);
  if (!decoded.email) throw new HttpError(400, 'This account has no email address.');
  await assertActiveAccount(decoded.uid);
  const { resend } = await readBody<{ resend?: boolean }>(request);

  const pinRef = getFirestore().collection('loginPins').doc(decoded.uid);
  const existing = (await pinRef.get()).data();
  const sentAt = existing?.sentAt?.toMillis?.() ?? 0;
  const sentForThisSignIn = existing?.authTime === decoded.auth_time;
  // Opening the PIN screen again (e.g. a refresh) reuses the PIN already emailed.
  if (sentForThisSignIn && !resend && Date.now() - sentAt < PIN_TTL_MS) {
    sendJson(request, response, 200, { sent: true, email: decoded.email });
    return;
  }
  if (sentForThisSignIn && resend && Date.now() - sentAt < PIN_RESEND_MS) {
    const wait = Math.ceil((PIN_RESEND_MS - (Date.now() - sentAt)) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before asking for a new PIN.`);
  }

  const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pinRef.set({
    hash: hashPin(decoded.uid, decoded.auth_time, pin).toString('hex'),
    authTime: decoded.auth_time,
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + PIN_TTL_MS),
    attempts: 0,
  });

  await sendPinEmail(decoded.email, pin);
  sendJson(request, response, 200, { sent: true, email: decoded.email });
}

async function sendPinEmail(to: string, pin: string): Promise<void> {
  const subject = `${pin} is your EduSwap sign-in PIN`;
  const text = `Your EduSwap sign-in PIN is ${pin}.\n\nIt expires in 10 minutes. If you did not try to sign in, change your password.`;
  const html = `<p>Your EduSwap sign-in PIN is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${pin}</p><p>It expires in 10 minutes. If you did not try to sign in, change your password.</p>`;

  if (brevoApiKey) {
    const result = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'EduSwap', email: mailFrom }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    });
    if (!result.ok) throw new Error(`Brevo refused the PIN email (${result.status}): ${await result.text()}`);
  } else if (mailer) {
    await mailer.sendMail({ from: `"EduSwap" <${mailFrom}>`, to, subject, text, html });
  } else {
    console.log(`[login PIN] ${to}: ${pin}`);
  }
}

async function handleVerifyPin(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const decoded = await authenticate(request);
  const { pin } = await readBody<{ pin?: string }>(request);
  if (!pin || !/^\d{6}$/.test(pin)) throw new HttpError(400, 'Enter the 6-digit PIN from your email.');

  const pinRef = getFirestore().collection('loginPins').doc(decoded.uid);
  const stored = (await pinRef.get()).data();
  if (!stored || stored.authTime !== decoded.auth_time) throw new HttpError(400, 'No PIN was sent for this sign-in. Ask for a new PIN.');
  if (stored.expiresAt.toMillis() < Date.now()) throw new HttpError(400, 'This PIN has expired. Ask for a new PIN.');
  if (stored.attempts >= PIN_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong PINs. Ask for a new PIN.');

  const matches = timingSafeEqual(Buffer.from(stored.hash, 'hex'), hashPin(decoded.uid, decoded.auth_time, pin));
  if (!matches) {
    await pinRef.update({ attempts: stored.attempts + 1 });
    const left = PIN_MAX_ATTEMPTS - stored.attempts - 1;
    throw new HttpError(400, left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong PINs. Ask for a new PIN.');
  }

  await pinRef.delete();
  await markLoginVerified(decoded.uid, decoded.auth_time);
  sendJson(request, response, 200, { verified: true });
}

async function handleTrustNewAccount(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const decoded = await authenticate(request);
  const createdAt = new Date((await getAuth().getUser(decoded.uid)).metadata.creationTime).getTime();
  const signedInAt = decoded.auth_time * 1000;
  if (Date.now() - createdAt > NEW_ACCOUNT_WINDOW_MS || Math.abs(signedInAt - createdAt) > NEW_ACCOUNT_WINDOW_MS) {
    throw new HttpError(403, 'Only a new account can skip the login PIN.');
  }
  await markLoginVerified(decoded.uid, decoded.auth_time);
  sendJson(request, response, 200, { verified: true });
}

const routes: Record<string, (request: IncomingMessage, response: ServerResponse) => Promise<void>> = {
  '/api/livekit/token': handleLiveKitToken,
  '/api/otp/send': handleSendPin,
  '/api/otp/verify': handleVerifyPin,
  '/api/otp/trust-new-account': handleTrustNewAccount,
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(request, response, 204, {});
    return;
  }
  // For the host's health check and uptime monitors that keep a free instance awake.
  if (request.method === 'GET' && request.url === '/healthz') {
    sendJson(request, response, 200, { ok: true });
    return;
  }
  const handler = request.method === 'POST' && request.url ? routes[request.url] : undefined;
  if (!handler) {
    sendJson(request, response, 404, { error: 'Not found' });
    return;
  }

  try {
    await handler(request, response);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(request, response, error.status, { error: error.message });
      return;
    }
    console.error(`${request.url} failed:`, error);
    const fallback = request.url === '/api/livekit/token' ? 'Unable to authorize this group call.' : 'Something went wrong. Please try again.';
    sendJson(request, response, 500, { error: fallback });
  }
});

server.listen(port, () => {
  console.log(`EduSwap server (group calls + login PINs) listening on http://localhost:${port}`);
});
