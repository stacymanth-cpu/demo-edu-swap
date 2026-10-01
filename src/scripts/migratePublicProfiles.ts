import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toPublicUserProfile } from '../lib/publicUserProfile';

const projectId = 'eduswap-5e9ed';
const batchSize = 450;

async function migratePublicProfiles() {
  const app = getApps()[0] || initializeApp({
    credential: applicationDefault(),
    projectId,
  });
  const firestore = getFirestore(app);
  const users = await firestore.collection('users').get();
  let migrated = 0;

  for (let offset = 0; offset < users.docs.length; offset += batchSize) {
    const batch = firestore.batch();
    const page = users.docs.slice(offset, offset + batchSize);
    for (const user of page) {
      const profile = toPublicUserProfile({ ...user.data(), uid: user.id });
      batch.set(firestore.collection('publicProfiles').doc(user.id), profile);
    }
    await batch.commit();
    migrated += page.length;
  }

  console.log(`Public profile migration complete. Migrated ${migrated} users.`);
}

migratePublicProfiles().catch(error => {
  console.error('Public profile migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});