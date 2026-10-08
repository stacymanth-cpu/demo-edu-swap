// Firebase Admin connected to the emulators, for seeding data and checking results.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function emulatorAdmin() {
  // Refuse to run anywhere but the emulators, so tests can never write to a real project.
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Run the browser tests with `npm run test:e2e` so the Firebase emulators are running.');
  }
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-eduswap' });
  return { auth: getAuth(app), db: getFirestore(app) };
}
