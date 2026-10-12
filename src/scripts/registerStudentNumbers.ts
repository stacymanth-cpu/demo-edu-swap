// Records the student number of every existing account in studentNumbers/{number}, so nobody
// can sign up again with a number that is already in use. Accounts created before this rule
// were never recorded. Lists any number shared by more than one account and skips it, since
// an admin must decide which account to keep.
//
// Dry run (reads only):  npm run register:student-numbers
// Write the records:     npm run register:student-numbers -- --apply
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'eduswap-5e9ed';
const apply = process.argv.includes('--apply');

async function registerStudentNumbers() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const firestore = getFirestore(app);
  const users = await firestore.collection('users').get();

  const byNumber = new Map<string, { uid: string; name: string; email: string }[]>();
  let withoutNumber = 0;
  for (const user of users.docs) {
    const number = String(user.get('studentNumber') ?? '').trim();
    if (!/^\d{9}$/.test(number)) { withoutNumber++; continue; }
    const holders = byNumber.get(number) ?? [];
    holders.push({ uid: user.id, name: String(user.get('displayName') ?? ''), email: String(user.get('email') ?? '') });
    byNumber.set(number, holders);
  }

  const shared = [...byNumber].filter(([, holders]) => holders.length > 1);
  const unique = [...byNumber].filter(([, holders]) => holders.length === 1);

  console.log(`${users.size} accounts: ${unique.length} with their own student number, ${shared.length} numbers shared, ${withoutNumber} without a valid number.`);
  for (const [number, holders] of shared) {
    console.log(`\nStudent number ${number} is used by ${holders.length} accounts (not recorded; an admin must choose one):`);
    holders.forEach(h => console.log(`  - ${h.name} <${h.email}> (${h.uid})`));
  }

  if (!apply) {
    console.log(`\nDry run: nothing was written. Run with --apply to record ${unique.length} student numbers.`);
    return;
  }

  let written = 0;
  for (const [number, [holder]] of unique) {
    const ref = firestore.collection('studentNumbers').doc(number);
    const existing = await ref.get();
    if (existing.exists) continue;
    await ref.create({ uid: holder.uid });
    written++;
  }
  console.log(`\nRecorded ${written} student numbers.`);
}

registerStudentNumbers().catch(error => {
  console.error('Recording student numbers failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
