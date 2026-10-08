// Universities and skills offered at sign-up. Kept apart from mockData so the app does
// not ship the demo users and sessions; the seed scripts still read these through mockData.
import type { SkillInfo, University } from '../types';

// ─── Universities ────────────────────────────────────────────────
export const universities: University[] = [
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

// ─── Skills Catalog ──────────────────────────────────────────────
export const skillsCatalog: SkillInfo[] = [
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
