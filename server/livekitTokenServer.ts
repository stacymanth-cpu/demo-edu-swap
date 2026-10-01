import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AccessToken } from 'livekit-server-sdk';

const port = Number(process.env.LIVEKIT_TOKEN_PORT || 8787);
const liveKitApiKey = process.env.LIVEKIT_API_KEY;
const liveKitApiSecret = process.env.LIVEKIT_API_SECRET;
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';

if (!liveKitApiKey || !liveKitApiSecret) {
  throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required.');
}

initializeApp();

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }
  if (request.method !== 'POST' || request.url !== '/api/livekit/token') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  try {
    const authorization = request.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) {
      sendJson(response, 401, { error: 'Authentication required.' });
      return;
    }
    const firebaseToken = authorization.slice('Bearer '.length);
    const decoded = await getAuth().verifyIdToken(firebaseToken);
    const profile = await getFirestore().collection('users').doc(decoded.uid).get();
    const profileData = profile.data();
    if (!profile.exists || profileData?.accountStatus === 'suspended' || profileData?.accountStatus === 'deactivated') {
      sendJson(response, 403, { error: 'This account cannot join group calls.' });
      return;
    }
    let rawBody = '';
    for await (const chunk of request) rawBody += chunk;
    const body = JSON.parse(rawBody || '{}') as { room?: string };
    const room = body.room?.trim();
    if (!room || !/^[a-zA-Z0-9_-]{1,128}$/.test(room)) {
      sendJson(response, 400, { error: 'A valid room is required.' });
      return;
    }
    const groupRoom = await getFirestore().collection('groupCallRooms').doc(room).get();
    const groupRoomData = groupRoom.data();
    if (!groupRoom.exists || groupRoomData?.status !== 'open' || !Array.isArray(groupRoomData.participants) || !groupRoomData.participants.includes(decoded.uid)) {
      sendJson(response, 403, { error: 'You are not allowed to join this group call.' });
      return;
    }

    const liveKitRoom = `EduSwap-${room}`;
    const token = new AccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: decoded.uid,
      name: decoded.name || decoded.email || decoded.uid,
      ttl: '10m',
    });
    token.addGrant({ roomJoin: true, room: liveKitRoom, canPublish: true, canSubscribe: true });
    sendJson(response, 200, { token: await token.toJwt(), url: process.env.LIVEKIT_URL });
  } catch (error) {
    console.error('LiveKit token request failed:', error);
    sendJson(response, 401, { error: 'Unable to authorize this group call.' });
  }
});

server.listen(port, () => {
  console.log(`LiveKit token server listening on http://localhost:${port}`);
});
