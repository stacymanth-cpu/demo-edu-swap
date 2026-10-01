/**
 * Promote a Firebase Auth user to the EduSwap owner/admin role.
 * Run: npm run promote:owner -- owner@example.com
 * Requires GOOGLE_APPLICATION_CREDENTIALS or another Firebase Admin credential source.
 */
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function promoteOwner(email: string) {
  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: applicationDefault() });
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const authUser = await auth.getUserByEmail(email);
  const claims = authUser.customClaims || {};

  await auth.setCustomUserClaims(authUser.uid, {
    ...claims,
    admin: true,
    owner: true,
  });

  await firestore.collection('users').doc(authUser.uid).set({
    isAdmin: true,
  }, { merge: true });

  console.log(`Promoted ${authUser.email} (${authUser.uid}) to owner/admin.`);
  console.log('The user must sign out and sign in again before the new claim is available.');
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run promote:owner -- owner@example.com');
  process.exit(1);
}

promoteOwner(email).catch(error => {
  console.error('Owner promotion failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
