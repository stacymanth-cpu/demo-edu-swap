/**
 * Seed remaining collections (skills catalog, transactions, comments)
 * Run: npx tsx src/scripts/seedRemaining.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyCYJIoM4Inu2NqXx6l7tHIihNIuQf_Wxzw",
  authDomain: "eduswap-5e9ed.firebaseapp.com",
  projectId: "eduswap-5e9ed",
  storageBucket: "eduswap-5e9ed.firebasestorage.app",
  messagingSenderId: "913071574289",
  appId: "1:913071574289:web:d45de38222566f360e50b0"
});
const db = getFirestore(app);
const ts = (d: string) => Timestamp.fromDate(new Date(d));

async function seed() {
  console.log('🎯 Seeding skills catalog...');
  const skills = [
    { name: 'Python', category: 'Technology', userCount: 156, icon: 'Code' },
    { name: 'TypeScript', category: 'Technology', userCount: 132, icon: 'FileCode2' },
    { name: 'Java', category: 'Technology', userCount: 118, icon: 'Code' },
    { name: 'C++', category: 'Technology', userCount: 102, icon: 'Code' },
    { name: 'C#', category: 'Technology', userCount: 94, icon: 'Code' },
    { name: 'Go', category: 'Technology', userCount: 71, icon: 'Code' },
    { name: 'Rust', category: 'Technology', userCount: 64, icon: 'Code' },
    { name: 'Kotlin', category: 'Technology', userCount: 69, icon: 'Code' },
    { name: 'Swift', category: 'Technology', userCount: 58, icon: 'Code' },
    { name: 'PHP', category: 'Technology', userCount: 83, icon: 'Code' },
    { name: 'SQL', category: 'Technology', userCount: 121, icon: 'BarChart3' },
    { name: 'Machine Learning', category: 'Technology', userCount: 89, icon: 'BrainCircuit' },
    { name: 'Web Development', category: 'Technology', userCount: 134, icon: 'Globe' },
    { name: 'React', category: 'Technology', userCount: 98, icon: 'Atom' },
    { name: 'Data Science', category: 'Technology', userCount: 76, icon: 'BarChart3' },
    { name: 'JavaScript', category: 'Technology', userCount: 145, icon: 'FileCode2' },
    { name: 'Mobile Development', category: 'Technology', userCount: 67, icon: 'Smartphone' },
    { name: 'Blockchain', category: 'Technology', userCount: 34, icon: 'Link2' },
    { name: 'Mathematics', category: 'Academic', userCount: 178, icon: 'Ruler' },
    { name: 'Physics', category: 'Academic', userCount: 92, icon: 'Zap' },
    { name: 'Statistics', category: 'Academic', userCount: 85, icon: 'TrendingUp' },
    { name: 'Data Structures', category: 'Academic', userCount: 110, icon: 'Building2' },
    { name: 'Research Methods', category: 'Academic', userCount: 54, icon: 'Microscope' },
    { name: 'Accounting', category: 'Business', userCount: 68, icon: 'DollarSign' },
    { name: 'Financial Analysis', category: 'Business', userCount: 45, icon: 'LineChart' },
    { name: 'UI/UX Design', category: 'Creative', userCount: 112, icon: 'Palette' },
    { name: 'Graphic Design', category: 'Creative', userCount: 88, icon: 'Paintbrush' },
    { name: 'Figma', category: 'Creative', userCount: 76, icon: 'Target' },
    { name: 'Photography', category: 'Creative', userCount: 52, icon: 'Camera' },
    { name: 'Creative Writing', category: 'Creative', userCount: 41, icon: 'PenTool' },
    { name: 'Music Theory', category: 'Creative', userCount: 38, icon: 'Music' },
    { name: 'Piano', category: 'Creative', userCount: 29, icon: 'Piano' },
    { name: 'Guitar', category: 'Creative', userCount: 35, icon: 'Guitar' },
    { name: 'Spanish', category: 'Languages', userCount: 67, icon: 'Languages' },
    { name: 'French', category: 'Languages', userCount: 54, icon: 'Languages' },
    { name: 'Mandarin', category: 'Languages', userCount: 28, icon: 'Languages' },
    { name: 'Public Speaking', category: 'Lifestyle', userCount: 73, icon: 'Mic' },
    { name: 'Debate', category: 'Lifestyle', userCount: 42, icon: 'MessageSquare' },
    { name: 'Psychology', category: 'Lifestyle', userCount: 61, icon: 'Brain' },
  ];
  for (const skill of skills) {
    const id = skill.name.toLowerCase().replace(/[\s/]+/g, '-');
    await setDoc(doc(db, 'skillsCatalog', id), skill);
  }
  console.log(`  ✅ ${skills.length} skills seeded`);

  console.log('💰 Seeding transactions...');
  const transactions = [
    { id: 'tx-001', userId: 'user-001', amount: 50, type: 'welcome_bonus', timestamp: ts('2025-09-15'), description: 'Welcome bonus' },
    { id: 'tx-002', userId: 'user-001', amount: 10, type: 'earned_teaching', sessionId: 'sess-004', timestamp: ts('2026-03-26'), description: 'Taught ML Intro to James' },
    { id: 'tx-003', userId: 'user-001', amount: -10, type: 'spent_learning', sessionId: 'sess-003', timestamp: ts('2026-03-28'), description: 'Learned Spanish from James' },
    { id: 'tx-004', userId: 'user-001', amount: 10, type: 'earned_teaching', sessionId: 'sess-001', timestamp: ts('2026-03-20'), description: 'Taught Python to Naledi' },
    { id: 'tx-005', userId: 'user-001', amount: 5, type: 'five_star_bonus', timestamp: ts('2026-03-21'), description: '5-star review bonus from Naledi' },
    { id: 'tx-006', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: ts('2026-03-15'), description: 'Taught Data Structures' },
    { id: 'tx-007', userId: 'user-001', amount: -10, type: 'spent_learning', timestamp: ts('2026-03-12'), description: 'Learned Figma basics' },
    { id: 'tx-008', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: ts('2026-03-08'), description: 'Taught Mathematics' },
    { id: 'tx-009', userId: 'user-001', amount: 5, type: 'five_star_bonus', timestamp: ts('2026-03-09'), description: '5-star review bonus' },
    { id: 'tx-010', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: ts('2026-02-28'), description: 'Taught Python basics' },
    { id: 'tx-011', userId: 'user-001', amount: -10, type: 'spent_learning', timestamp: ts('2026-02-25'), description: 'Learned public speaking tips' },
    { id: 'tx-012', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: ts('2026-02-20'), description: 'Taught ML concepts' },
  ];
  for (const tx of transactions) {
    await setDoc(doc(db, 'transactions', tx.id), tx);
  }
  console.log(`  ✅ ${transactions.length} transactions seeded`);

  console.log('⭐ Seeding comments...');
  const comments = [
    { id: 'c-001', userId: 'user-002', userName: 'Naledi Dlamini', userPhoto: '', text: 'Thabo is an amazing Python tutor!', rating: 5, timestamp: ts('2026-03-21') },
    { id: 'c-002', userId: 'user-003', userName: 'James van der Merwe', userPhoto: '', text: 'Great ML session. Makes complex topics accessible.', rating: 5, timestamp: ts('2026-03-27') },
    { id: 'c-003', userId: 'user-005', userName: 'Sipho Nkosi', userPhoto: '', text: 'Good session on data structures.', rating: 4, timestamp: ts('2026-03-15') },
    { id: 'c-004', userId: 'user-008', userName: 'Zanele Khumalo', userPhoto: '', text: 'Very knowledgeable in Python.', rating: 5, timestamp: ts('2026-03-10') },
  ];
  for (const c of comments) {
    await setDoc(doc(db, 'comments', c.id), c);
  }
  console.log(`  ✅ ${comments.length} comments seeded`);

  console.log('\n🎉 Remaining seed complete!');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
