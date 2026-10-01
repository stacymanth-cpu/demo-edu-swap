/**
 * Firestore Seed Script
 * Run: npx tsx src/scripts/seedFirestore.ts
 *
 * Populates Firestore with the same demo data that was previously hardcoded.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { toPublicUserProfile } from '../lib/publicUserProfile';

const firebaseConfig = {
  apiKey: "AIzaSyCYJIoM4Inu2NqXx6l7tHIihNIuQf_Wxzw",
  authDomain: "eduswap-5e9ed.firebaseapp.com",
  projectId: "eduswap-5e9ed",
  storageBucket: "eduswap-5e9ed.firebasestorage.app",
  messagingSenderId: "913071574289",
  appId: "1:913071574289:web:d45de38222566f360e50b0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function toTimestamp(date: Date) {
  return Timestamp.fromDate(date);
}

async function seed() {
  console.log('🌱 Starting Firestore seed...\n');

  // ─── Universities ──────────────────────
  console.log('📚 Seeding universities...');
  const universities = [
    { id: '1', name: 'University of Pretoria', domain: 'up.ac.za', logoUrl: '', totalUsers: 342 },
    { id: '2', name: 'University of Cape Town', domain: 'uct.ac.za', logoUrl: '', totalUsers: 289 },
    { id: '3', name: 'Stellenbosch University', domain: 'sun.ac.za', logoUrl: '', totalUsers: 215 },
    { id: '4', name: 'University of the Witwatersrand', domain: 'wits.ac.za', logoUrl: '', totalUsers: 198 },
    { id: '5', name: 'University of Johannesburg', domain: 'uj.ac.za', logoUrl: '', totalUsers: 176 },
    { id: '6', name: 'North-West University', domain: 'nwu.ac.za', logoUrl: '', totalUsers: 134 },
    { id: '7', name: 'University of KwaZulu-Natal', domain: 'ukzn.ac.za', logoUrl: '', totalUsers: 112 },
    { id: '8', name: 'Rhodes University', domain: 'ru.ac.za', logoUrl: '', totalUsers: 89 },
    { id: '9', name: 'University of Mpumalanga', domain: 'ump.ac.za', logoUrl: '', totalUsers: 64 },
  ];
  for (const uni of universities) {
    await setDoc(doc(db, 'universities', uni.id), uni);
  }
  console.log(`  ✅ ${universities.length} universities seeded`);

  // ─── Users ─────────────────────────────
  console.log('👤 Seeding users...');
  const users = [
    {
      uid: 'user-001', displayName: 'Thabo Lubhele', email: 'thabo@ump.ac.za', photoUrl: '',
      university: 'University of Mpumalanga',
      bio: 'Final year CS student passionate about AI and helping others learn.',
      skillsTeach: ['Python', 'Machine Learning', 'Data Structures', 'Mathematics'],
      skillsLearn: ['UI/UX Design', 'Spanish', 'Public Speaking'],
      credits: 120, rating: 4.8, totalSessions: 14, joinedAt: toTimestamp(new Date('2025-09-15')), isOnline: true,
    },
    {
      uid: 'user-002', displayName: 'Naledi Dlamini', email: 'naledi@up.ac.za', photoUrl: '',
      university: 'University of Pretoria',
      bio: 'Graphic design student with a passion for creating beautiful interfaces.',
      skillsTeach: ['UI/UX Design', 'Graphic Design', 'Figma'],
      skillsLearn: ['Python', 'Web Development', 'Data Structures'],
      credits: 85, rating: 4.9, totalSessions: 11, joinedAt: toTimestamp(new Date('2025-10-02')), isOnline: true,
    },
    {
      uid: 'user-003', displayName: 'James van der Merwe', email: 'james@sun.ac.za', photoUrl: '',
      university: 'Stellenbosch University',
      bio: 'Engineering student and part-time tutor. Fluent in Afrikaans, English, and Spanish.',
      skillsTeach: ['Spanish', 'Engineering Mathematics', 'Physics'],
      skillsLearn: ['Machine Learning', 'Python', 'Data Science'],
      credits: 65, rating: 4.5, totalSessions: 8, joinedAt: toTimestamp(new Date('2025-11-10')), isOnline: false,
    },
    {
      uid: 'user-004', displayName: 'Aisha Moosa', email: 'aisha@uct.ac.za', photoUrl: '',
      university: 'University of Cape Town',
      bio: 'Public speaking champion and debate society president.',
      skillsTeach: ['Public Speaking', 'Creative Writing', 'Debate'],
      skillsLearn: ['Mathematics', 'Statistics', 'Python'],
      credits: 95, rating: 4.7, totalSessions: 9, joinedAt: toTimestamp(new Date('2025-10-20')), isOnline: true,
    },
    {
      uid: 'user-005', displayName: 'Sipho Nkosi', email: 'sipho@wits.ac.za', photoUrl: '',
      university: 'University of the Witwatersrand',
      bio: 'Commerce student specializing in finance and accounting.',
      skillsTeach: ['Accounting', 'Financial Analysis', 'Blockchain'],
      skillsLearn: ['Web Development', 'UI/UX Design', 'Python'],
      credits: 45, rating: 4.3, totalSessions: 5, joinedAt: toTimestamp(new Date('2026-01-05')), isOnline: false,
    },
    {
      uid: 'user-006', displayName: 'Lila Petersen', email: 'lila@sun.ac.za', photoUrl: '',
      university: 'Stellenbosch University',
      bio: 'Music and arts student. Can play 4 instruments.',
      skillsTeach: ['Music Theory', 'Piano', 'Guitar'],
      skillsLearn: ['Web Development', 'Graphic Design', 'Photography'],
      credits: 70, rating: 4.6, totalSessions: 7, joinedAt: toTimestamp(new Date('2025-12-01')), isOnline: true,
    },
    {
      uid: 'user-007', displayName: 'Kabelo Makgato', email: 'kabelo@uj.ac.za', photoUrl: '',
      university: 'University of Johannesburg',
      bio: 'Full-stack developer and open source contributor.',
      skillsTeach: ['Web Development', 'React', 'Node.js', 'JavaScript'],
      skillsLearn: ['Machine Learning', 'Data Science', 'Mobile Development'],
      credits: 150, rating: 4.9, totalSessions: 18, joinedAt: toTimestamp(new Date('2025-08-20')), isOnline: true,
    },
    {
      uid: 'user-008', displayName: 'Zanele Khumalo', email: 'zanele@ukzn.ac.za', photoUrl: '',
      university: 'University of KwaZulu-Natal',
      bio: 'Psychology student interested in the intersection of AI and human behavior.',
      skillsTeach: ['Psychology', 'Research Methods', 'Statistics'],
      skillsLearn: ['Python', 'Machine Learning', 'Data Visualization'],
      credits: 55, rating: 4.4, totalSessions: 6, joinedAt: toTimestamp(new Date('2026-01-15')), isOnline: false,
    },
  ];
  for (const user of users) {
    await setDoc(doc(db, 'users', user.uid), user);
    await setDoc(doc(db, 'publicProfiles', user.uid), toPublicUserProfile(user));
  }
  console.log(`  ✅ ${users.length} users seeded`);

  // ─── Matches ───────────────────────────
  console.log('🤝 Seeding matches...');
  const matches = [
    { id: 'match-001', user1Id: 'user-001', user2Id: 'user-002', user1Teaches: 'Python', user2Teaches: 'UI/UX Design', status: 'accepted', createdAt: toTimestamp(new Date('2026-02-15')) },
    { id: 'match-002', user1Id: 'user-001', user2Id: 'user-003', user1Teaches: 'Machine Learning', user2Teaches: 'Spanish', status: 'accepted', createdAt: toTimestamp(new Date('2026-02-20')) },
    { id: 'match-003', user1Id: 'user-001', user2Id: 'user-004', user1Teaches: 'Mathematics', user2Teaches: 'Public Speaking', status: 'pending', createdAt: toTimestamp(new Date('2026-03-25')) },
    { id: 'match-004', user1Id: 'user-007', user2Id: 'user-001', user1Teaches: 'Web Development', user2Teaches: 'Machine Learning', status: 'pending', createdAt: toTimestamp(new Date('2026-03-27')) },
    { id: 'match-005', user1Id: 'user-001', user2Id: 'user-008', user1Teaches: 'Python', user2Teaches: 'Statistics', status: 'declined', createdAt: toTimestamp(new Date('2026-03-10')) },
  ];
  for (const match of matches) {
    await setDoc(doc(db, 'matches', match.id), match);
  }
  console.log(`  ✅ ${matches.length} matches seeded`);

  // ─── Sessions ──────────────────────────
  console.log('📅 Seeding sessions...');
  const sessions = [
    { id: 'sess-001', matchId: 'match-001', teacherId: 'user-001', learnerId: 'user-002', teacherName: 'Thabo Mokoena', learnerName: 'Naledi Dlamini', skill: 'Python Fundamentals', scheduledAt: toTimestamp(new Date('2026-03-30T14:00:00')), durationMinutes: 60, status: 'scheduled', creditsExchanged: 10, notes: 'Cover variables, loops, and functions' },
    { id: 'sess-002', matchId: 'match-001', teacherId: 'user-002', learnerId: 'user-001', teacherName: 'Naledi Dlamini', learnerName: 'Thabo Mokoena', skill: 'UI/UX Basics', scheduledAt: toTimestamp(new Date('2026-04-01T10:00:00')), durationMinutes: 60, status: 'scheduled', creditsExchanged: 10, notes: 'Introduction to Figma and design principles' },
    { id: 'sess-003', matchId: 'match-002', teacherId: 'user-003', learnerId: 'user-001', teacherName: 'James van der Merwe', learnerName: 'Thabo Mokoena', skill: 'Spanish Basics', scheduledAt: toTimestamp(new Date('2026-03-28T16:00:00')), durationMinutes: 45, status: 'completed', creditsExchanged: 10, notes: 'Basic greetings and introductions' },
    { id: 'sess-004', matchId: 'match-002', teacherId: 'user-001', learnerId: 'user-003', teacherName: 'Thabo Mokoena', learnerName: 'James van der Merwe', skill: 'Public Speaking', scheduledAt: toTimestamp(new Date('2026-04-03T13:00:00')), durationMinutes: 45, status: 'scheduled', creditsExchanged: 10, notes: 'Practice structure, pacing, and delivery' },
  ];
  for (const session of sessions) {
    await setDoc(doc(db, 'sessions', session.id), session);
  }
  console.log(`  ✅ ${sessions.length} sessions seeded`);

  // ─── Chat Rooms + Messages ─────────────
  console.log('💬 Seeding chat rooms & messages...');
  const chatRoomsData = [
    { id: 'chat-001', participants: ['user-001', 'user-002'], participantNames: { 'user-001': 'Thabo Mokoena', 'user-002': 'Naledi Dlamini' }, participantPhotos: { 'user-001': '', 'user-002': '' }, lastMessage: 'See you tomorrow for the Python session! 🐍', lastMessageAt: toTimestamp(new Date('2026-03-28T18:30:00')), unreadCount: 2 },
    { id: 'chat-002', participants: ['user-001', 'user-003'], participantNames: { 'user-001': 'Thabo Mokoena', 'user-003': 'James van der Merwe' }, participantPhotos: { 'user-001': '', 'user-003': '' }, lastMessage: 'Great session today! Gracias 😄', lastMessageAt: toTimestamp(new Date('2026-03-28T17:00:00')), unreadCount: 0 },
    { id: 'chat-003', participants: ['user-001', 'user-004'], participantNames: { 'user-001': 'Thabo Mokoena', 'user-004': 'Aisha Moosa' }, participantPhotos: { 'user-001': '', 'user-004': '' }, lastMessage: 'Would love to help with public speaking! When works for you?', lastMessageAt: toTimestamp(new Date('2026-03-27T09:15:00')), unreadCount: 1 },
  ];

  for (const room of chatRoomsData) {
    await setDoc(doc(db, 'chatRooms', room.id), room);
  }

  const messagesData: Record<string, { senderId: string; text: string; timestamp: Date; isRead: boolean }[]> = {
    'chat-001': [
      { senderId: 'user-002', text: 'Hey Thabo! Thanks for accepting the match 🎉', timestamp: new Date('2026-03-28T14:00:00'), isRead: true },
      { senderId: 'user-001', text: "Of course! I'd love to learn UI/UX from you. Your portfolio is amazing!", timestamp: new Date('2026-03-28T14:05:00'), isRead: true },
      { senderId: 'user-002', text: 'Aww thanks! And I really need help with Python for my data viz project', timestamp: new Date('2026-03-28T14:10:00'), isRead: true },
      { senderId: 'user-001', text: "Perfect, we can start with the basics tomorrow. I'll share some resources beforehand.", timestamp: new Date('2026-03-28T14:15:00'), isRead: true },
      { senderId: 'user-002', text: "Sounds great! I've set up the Teams meeting already", timestamp: new Date('2026-03-28T18:25:00'), isRead: true },
      { senderId: 'user-002', text: 'See you tomorrow for the Python session! 🐍', timestamp: new Date('2026-03-28T18:30:00'), isRead: false },
    ],
    'chat-002': [
      { senderId: 'user-003', text: 'Hola Thabo! Ready for your first Spanish lesson?', timestamp: new Date('2026-03-28T15:50:00'), isRead: true },
      { senderId: 'user-001', text: "Sí! Very excited. I've been practicing the basics you sent.", timestamp: new Date('2026-03-28T15:55:00'), isRead: true },
      { senderId: 'user-003', text: 'Great session today! Gracias 😄', timestamp: new Date('2026-03-28T17:00:00'), isRead: true },
    ],
    'chat-003': [
      { senderId: 'user-004', text: 'Hi Thabo! I saw your match request. I can definitely help with public speaking!', timestamp: new Date('2026-03-27T09:00:00'), isRead: true },
      { senderId: 'user-004', text: 'Would love to help with public speaking! When works for you?', timestamp: new Date('2026-03-27T09:15:00'), isRead: false },
    ],
  };

  for (const [roomId, msgs] of Object.entries(messagesData)) {
    for (const msg of msgs) {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        ...msg,
        timestamp: toTimestamp(msg.timestamp),
      });
    }
  }
  console.log(`  ✅ ${chatRoomsData.length} chat rooms + messages seeded`);

  // ─── Skills Catalog ────────────────────
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
    await setDoc(doc(db, 'skillsCatalog', skill.name.toLowerCase().replace(/[\s/]+/g, '-')), skill);
  }
  console.log(`  ✅ ${skills.length} skills seeded`);

  // ─── Credit Transactions ───────────────
  console.log('💰 Seeding transactions...');
  const transactions = [
    { id: 'tx-001', userId: 'user-001', amount: 50, type: 'welcome_bonus', timestamp: toTimestamp(new Date('2025-09-15')), description: 'Welcome bonus' },
    { id: 'tx-002', userId: 'user-001', amount: 10, type: 'earned_teaching', sessionId: 'sess-004', timestamp: toTimestamp(new Date('2026-03-26')), description: 'Taught ML Intro to James' },
    { id: 'tx-003', userId: 'user-001', amount: -10, type: 'spent_learning', sessionId: 'sess-003', timestamp: toTimestamp(new Date('2026-03-28')), description: 'Learned Spanish from James' },
    { id: 'tx-004', userId: 'user-001', amount: 10, type: 'earned_teaching', sessionId: 'sess-001', timestamp: toTimestamp(new Date('2026-03-20')), description: 'Taught Python to Naledi' },
    { id: 'tx-005', userId: 'user-001', amount: 5, type: 'five_star_bonus', timestamp: toTimestamp(new Date('2026-03-21')), description: '5-star review bonus from Naledi' },
    { id: 'tx-006', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: toTimestamp(new Date('2026-03-15')), description: 'Taught Data Structures' },
    { id: 'tx-007', userId: 'user-001', amount: -10, type: 'spent_learning', timestamp: toTimestamp(new Date('2026-03-12')), description: 'Learned Figma basics' },
    { id: 'tx-008', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: toTimestamp(new Date('2026-03-08')), description: 'Taught Mathematics' },
    { id: 'tx-009', userId: 'user-001', amount: 5, type: 'five_star_bonus', timestamp: toTimestamp(new Date('2026-03-09')), description: '5-star review bonus' },
    { id: 'tx-010', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: toTimestamp(new Date('2026-02-28')), description: 'Taught Python basics' },
    { id: 'tx-011', userId: 'user-001', amount: -10, type: 'spent_learning', timestamp: toTimestamp(new Date('2026-02-25')), description: 'Learned public speaking tips' },
    { id: 'tx-012', userId: 'user-001', amount: 10, type: 'earned_teaching', timestamp: toTimestamp(new Date('2026-02-20')), description: 'Taught ML concepts' },
  ];
  for (const tx of transactions) {
    await setDoc(doc(db, 'transactions', tx.id), tx);
  }
  console.log(`  ✅ ${transactions.length} transactions seeded`);

  // ─── Comments / Reviews ────────────────
  console.log('⭐ Seeding comments...');
  const comments = [
    { id: 'c-001', userId: 'user-002', userName: 'Naledi Dlamini', userPhoto: '', text: 'Thabo is an amazing Python tutor! He explains concepts so clearly and patiently. Highly recommend!', rating: 5, timestamp: toTimestamp(new Date('2026-03-21')) },
    { id: 'c-002', userId: 'user-003', userName: 'James van der Merwe', userPhoto: '', text: 'Great ML session. Thabo really knows his stuff and makes complex topics accessible.', rating: 5, timestamp: toTimestamp(new Date('2026-03-27')) },
    { id: 'c-003', userId: 'user-005', userName: 'Sipho Nkosi', userPhoto: '', text: 'Good session on data structures. Would have liked more practice problems.', rating: 4, timestamp: toTimestamp(new Date('2026-03-15')) },
    { id: 'c-004', userId: 'user-008', userName: 'Zanele Khumalo', userPhoto: '', text: 'Very knowledgeable in Python. Helped me understand pandas and numpy for my research.', rating: 5, timestamp: toTimestamp(new Date('2026-03-10')) },
  ];
  for (const comment of comments) {
    await setDoc(doc(db, 'comments', comment.id), comment);
  }
  console.log(`  ✅ ${comments.length} comments seeded`);

  console.log('\n🎉 Firestore seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
