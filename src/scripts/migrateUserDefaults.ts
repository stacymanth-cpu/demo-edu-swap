/**
 * User migration script for existing Firestore profiles.
 * Run: npm run migrate:users
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCYJIoM4Inu2NqXx6l7tHIihNIuQf_Wxzw',
  authDomain: 'eduswap-5e9ed.firebaseapp.com',
  projectId: 'eduswap-5e9ed',
  storageBucket: 'eduswap-5e9ed.firebasestorage.app',
  messagingSenderId: '913071574289',
  appId: '1:913071574289:web:d45de38222566f360e50b0',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Found ${usersSnap.size} users to migrate.`);

  let updated = 0;
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const updates: Record<string, unknown> = {};

    if (!Array.isArray(data.skillsTeach)) updates.skillsTeach = [];
    if (!Array.isArray(data.skillsLearn)) updates.skillsLearn = [];
    if (typeof data.bio !== 'string') updates.bio = '';
    if (typeof data.university !== 'string') updates.university = '';
    if (typeof data.credits !== 'number') updates.credits = 0;
    if (typeof data.rating !== 'number') updates.rating = 0;
    if (typeof data.totalSessions !== 'number') updates.totalSessions = 0;
    if (typeof data.isOnline !== 'boolean') updates.isOnline = false;
    if (data.joinedAt && !(data.joinedAt instanceof Timestamp)) {
      updates.joinedAt = Timestamp.fromDate(new Date(data.joinedAt as string));
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, 'users', userDoc.id), updates);
      updated += 1;
      console.log(`Updated ${userDoc.id}:`, updates);
    }
  }

  console.log(`Migration complete. Updated ${updated} user profiles.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
