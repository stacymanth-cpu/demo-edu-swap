// Admin moderation, announcements, audit log and platform settings.
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserReport, SkillVerification, AuditLog, Announcement, SystemSettings } from '../../types';
import { createNotification } from './notifications';
import { toDate } from './shared';
import { getAllUsers } from './users';

export async function getAdminReports(): Promise<UserReport[]> {
  const snap = await getDocs(collection(db, 'reports'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as UserReport));
}

export async function reviewReport(adminId: string, reportId: string, status: UserReport['status']): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status });
  await writeAuditLog({ adminId, action: 'report_reviewed', targetId: reportId, details: status });
}

export async function getAdminVerifications(): Promise<SkillVerification[]> {
  const snap = await getDocs(collection(db, 'skillVerifications'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as SkillVerification));
}

export async function reviewSkillVerification(adminId: string, verificationId: string, status: SkillVerification['status']): Promise<void> {
  await updateDoc(doc(db, 'skillVerifications', verificationId), { status });
  await writeAuditLog({ adminId, action: 'skill_verification_reviewed', targetId: verificationId, details: status });
}

export async function createAnnouncement(data: Omit<Announcement, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'announcements'), { ...data, createdAt: Timestamp.fromDate(new Date()) });
  const students = await getAllUsers();
  await Promise.all(students.filter(student => student.uid !== data.createdBy).map(student => createNotification({
    userId: student.uid,
    type: 'system',
    title: data.title,
    body: data.message,
    read: false,
    createdAt: new Date(),
  })));
  return docRef.id;
}

export async function writeAuditLog(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'auditLogs'), { ...data, createdAt: Timestamp.fromDate(new Date()) });
  return docRef.id;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const snap = await getDocs(collection(db, 'auditLogs'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as AuditLog));
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const snap = await getDoc(doc(db, 'settings', 'platform'));
  const data = snap.exists() ? snap.data() : {};
  return {
    id: 'platform',
    creditsPerSession: typeof data.creditsPerSession === 'number' ? data.creditsPerSession : 10,
    verificationRequired: data.verificationRequired !== false,
    cancellationWindowHours: typeof data.cancellationWindowHours === 'number' ? data.cancellationWindowHours : 24,
  };
}

export async function updateSystemSettings(adminId: string, settings: Omit<SystemSettings, 'id'>): Promise<void> {
  await setDoc(doc(db, 'settings', 'platform'), settings);
  await writeAuditLog({ adminId, action: 'system_settings_updated', details: JSON.stringify(settings) });
}
