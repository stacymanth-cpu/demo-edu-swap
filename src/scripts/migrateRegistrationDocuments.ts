/**
 * Move registration document paths out of public user profiles and rotate old download tokens.
 * Run: npm run migrate:registration-documents
 * Requires GOOGLE_APPLICATION_CREDENTIALS or another Firebase Admin credential source.
 */
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getStoragePath(downloadUrl: string, userId: string, bucketName: string): string | null {
  try {
    const url = new URL(downloadUrl);
    if (url.hostname !== 'firebasestorage.googleapis.com') return null;
    const pathParts = url.pathname.split('/');
    if (pathParts[1] !== 'v0' || pathParts[2] !== 'b' || pathParts[3] !== bucketName || pathParts[4] !== 'o' || !pathParts[5]) return null;
    const storagePath = decodeURIComponent(pathParts.slice(5).join('/'));
    return storagePath.startsWith(`registrationDocuments/${userId}/`) ? storagePath : null;
  } catch {
    return null;
  }
}

async function migrateRegistrationDocuments() {
  const app = getApps()[0] || initializeApp({
    credential: applicationDefault(),
    projectId: 'eduswap-5e9ed',
    storageBucket: 'eduswap-5e9ed.firebasestorage.app',
  });
  const firestore = getFirestore(app);
  const bucket = getStorage(app).bucket('eduswap-5e9ed.firebasestorage.app');
  const users = await firestore.collection('users').get();
  let migrated = 0;
  let skipped = 0;

  for (const user of users.docs) {
    const oldUrl = user.get('registrationDocumentUrl');
    if (typeof oldUrl !== 'string' || !oldUrl || oldUrl === 'uploaded') {
      continue;
    }

    const storagePath = getStoragePath(oldUrl, user.id, bucket.name);
    if (!storagePath) {
      skipped += 1;
      console.warn(`Skipped ${user.id}: registration URL is not a matching Firebase Storage document.`);
      continue;
    }

    const file = bucket.file(storagePath);
    try {
      const [metadata] = await file.getMetadata();
      await file.setMetadata({
        metadata: {
          ...metadata.metadata,
          firebaseStorageDownloadTokens: randomUUID(),
        },
      });

      const batch = firestore.batch();
      batch.set(firestore.collection('privateRegistrationDocuments').doc(user.id), {
        storagePath,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(user.ref, { registrationDocumentUrl: FieldValue.delete() });
      await batch.commit();
      migrated += 1;
      console.log(`Migrated registration document for ${user.id}.`);
    } catch (error) {
      skipped += 1;
      console.error(`Failed to migrate ${user.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Migration complete. Migrated ${migrated}; skipped ${skipped}.`);
}

migrateRegistrationDocuments().catch(error => {
  console.error('Registration document migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});