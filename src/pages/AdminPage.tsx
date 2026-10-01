import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Check, Megaphone, Save, Shield, Users, X, BookOpen, Coins, Star, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { adminReviewStudentRegistration, createAnnouncement, getAdminComments, getAdminReports, getAdminSkills, getAdminUsers, getAdminRegistrationDocumentUrl, getAdminVerifications, getAuditLogs, getAllMatches, getAllSessions, getAllTransactions, getSystemSettings, adminUpdateUserStatus, removeComment, reviewReport, reviewSkillVerification, saveAdminSkill, subscribeAdminUsers, updateSystemSettings } from '../lib/firestoreService';
import type { AuditLog, Comment, CreditTransaction, Session, SkillInfo, SkillVerification, SystemSettings, User, UserReport } from '../types';
import './AdminPage.css';

type AdminTab = 'overview' | 'users' | 'reports' | 'verification' | 'skills' | 'sessions' | 'credits' | 'reviews' | 'settings';

export function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [verifications, setVerifications] = useState<SkillVerification[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [skills, setSkills] = useState<(SkillInfo & { id: string })[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeMatches, setActiveMatches] = useState(0);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  // The console opens for profiles marked isAdmin, but Firestore only accepts admin writes
  // from accounts with the `admin` custom claim (set by `npm run promote:owner`).
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    auth.currentUser?.getIdTokenResult(true)
      .then(result => setHasAdminClaim(result.claims.admin === true))
      .catch(() => setHasAdminClaim(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getAdminUsers(), getAdminReports(), getAdminVerifications(), getAllSessions(), getAllTransactions(), getAdminSkills(), getAuditLogs(), getSystemSettings(), getAdminComments(), getAllMatches()])
      .then(([loadedUsers, loadedReports, loadedVerifications, loadedSessions, loadedTransactions, loadedSkills, loadedLogs, loadedSettings, loadedComments, loadedMatches]) => {
        setUsers(loadedUsers); setReports(loadedReports); setVerifications(loadedVerifications); setSessions(loadedSessions); setTransactions(loadedTransactions); setSkills(loadedSkills); setLogs(loadedLogs); setSettings(loadedSettings); setComments(loadedComments); setActiveMatches(loadedMatches.filter(match => match.status === 'accepted').length);
      }).catch(error => console.error('Failed to load admin data:', error)).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeAdminUsers(setUsers);
  }, [user]);

  if (!user || loading) return <div className="admin-page"><p>Loading administration workspace...</p></div>;
  const openReports = reports.filter(report => report.status !== 'resolved');
  const pendingVerifications = verifications.filter(item => item.status === 'pending');
  const activeUsers = users.filter(item => item.accountStatus !== 'deactivated');
  const reviewRegistration = async (student: User, status: 'approved' | 'rejected') => {
    setActionError('');
    setActionNotice('');
    try {
      await adminReviewStudentRegistration(user.uid, student.uid, status);
      setUsers(prev => prev.map(item => item.uid === student.uid ? { ...item, studentVerified: status === 'approved', registrationVerificationStatus: status } : item));
      setActionNotice(`${student.displayName}'s registration was ${status === 'approved' ? 'approved' : 'rejected'}. They have been notified.`);
    } catch (reviewError) {
      console.error('Failed to review registration:', reviewError);
      const code = (reviewError as { code?: string })?.code;
      setActionError(code === 'permission-denied'
        ? 'Firebase refused this change because your account does not have the admin permission yet. Run "npm run promote:owner -- your-email", then sign out and sign in again.'
        : `Could not update ${student.displayName}'s registration. Please try again.`);
    }
  };

  const updateStatus = async (target: User, status: User['accountStatus']) => {
    await adminUpdateUserStatus(user.uid, target.uid, status);
    setUsers(prev => prev.map(item => item.uid === target.uid ? { ...item, accountStatus: status } : item));
  };

  const sendAnnouncement = async () => {
    if (!announcement.title.trim() || !announcement.message.trim()) return;
    await createAnnouncement({ ...announcement, createdBy: user.uid });
    setAnnouncement({ title: '', message: '' });
  };

  const saveSettings = async () => {
    if (!settings) return;
    await updateSystemSettings(user.uid, { creditsPerSession: settings.creditsPerSession, verificationRequired: settings.verificationRequired, cancellationWindowHours: settings.cancellationWindowHours });
  };

  const openRegistrationDocument = async (student: User) => {
    const documentWindow = window.open('about:blank', '_blank');
    if (!documentWindow) return;
    documentWindow.opener = null;
    try {
      const url = await getAdminRegistrationDocumentUrl(student.uid);
      if (url) documentWindow.location.replace(url);
      else documentWindow.close();
    } catch (error) {
      documentWindow.close();
      console.error('Failed to open registration document:', error);
    }
  };

  return <div className="admin-page">
    <header className="admin-header"><div><p className="admin-eyebrow"><Shield size={14} /> ADMIN CONSOLE</p><h1>Platform control room</h1><p>Moderate trust, safety, credits, and student activity from one place.</p></div><button className="admin-logout" onClick={logout}>Sign out</button></header>
    {hasAdminClaim === false && <div className="admin-alert error" role="alert"><AlertTriangle size={16} /><span><strong>Your account cannot make admin changes yet.</strong> It is marked as admin in its profile, but Firebase only accepts admin actions from accounts promoted with <code>npm run promote:owner -- your-email</code>. Run it, then sign out and sign in again. Until then, approvals and other changes will be refused.</span></div>}
    {actionError && <div className="admin-alert error" role="alert"><AlertTriangle size={16} /><span>{actionError}</span><button type="button" onClick={() => setActionError('')} aria-label="Dismiss"><X size={14} /></button></div>}
    {actionNotice && <div className="admin-alert success" role="status"><Check size={16} /><span>{actionNotice}</span><button type="button" onClick={() => setActionNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
    <nav className="admin-tabs">{([['overview', BarChart3, 'Overview'], ['users', Users, 'Students'], ['reports', AlertTriangle, 'Reports'], ['verification', Check, 'Verification'], ['skills', BookOpen, 'Skills'], ['sessions', Activity, 'Sessions'], ['credits', Coins, 'Credits'], ['reviews', MessageSquare, 'Reviews'], ['settings', Save, 'Settings']] as const).map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}</nav>
    {tab === 'overview' && <section className="admin-content"><div className="admin-metrics"><div><Users /><strong>{activeUsers.length}</strong><span>Active students</span></div><div><Users /><strong>{activeMatches}</strong><span>Active matches</span></div><div><Activity /><strong>{sessions.length}</strong><span>Total sessions</span></div><div><Coins /><strong>{transactions.reduce((sum, item) => sum + item.amount, 0)}</strong><span>Net credit activity</span></div><div><AlertTriangle /><strong>{openReports.length}</strong><span>Open reports</span></div><div><Check /><strong>{pendingVerifications.length}</strong><span>Pending verification</span></div></div><div className="admin-grid"><section className="admin-panel"><h2>Popular skills <Star size={17} /></h2>{skills.slice().sort((a, b) => b.userCount - a.userCount).slice(0, 6).map(skill => <p className="admin-log" key={skill.id}><strong>{skill.name}</strong><span>{skill.userCount} learners · {skill.category}</span></p>)}</section><section className="admin-panel"><h2>Announcements <Megaphone size={17} /></h2><input placeholder="Announcement title" value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} /><textarea placeholder="Message for students" value={announcement.message} onChange={e => setAnnouncement({ ...announcement, message: e.target.value })} /><button className="admin-primary" onClick={sendAnnouncement}><Megaphone size={15} /> Publish announcement</button></section><section className="admin-panel"><h2>Recent audit activity</h2>{logs.slice(-5).reverse().map(log => <p className="admin-log" key={log.id}><strong>{log.action}</strong><span>{log.details}</span></p>)}</section></div></section>}
    {tab === 'users' && <section className="admin-content"><div className="admin-panel"><h2>Student accounts</h2>{users.map(student => <div className="admin-row" key={student.uid}><div><strong>{student.displayName}</strong><span>{student.email} · {student.university} · {student.studentVerified ? 'Student verified' : 'Unverified'} · Registration: {student.registrationVerificationStatus || 'not submitted'}</span></div><div className="admin-actions">{student.registrationDocumentPath && <button type="button" className="admin-link" onClick={() => openRegistrationDocument(student)}>View document</button>}{student.registrationDocumentPath && !(student.registrationVerificationStatus === 'approved' && student.studentVerified) && <button onClick={() => void reviewRegistration(student, 'approved')}><Check size={14} /> Approve registration</button>}{student.registrationDocumentPath && student.registrationVerificationStatus !== 'rejected' && <button onClick={() => void reviewRegistration(student, 'rejected')}><X size={14} /> {student.studentVerified ? 'Revoke verification' : 'Reject'}</button>}<select value={student.accountStatus || 'active'} onChange={e => updateStatus(student, e.target.value as User['accountStatus'])}><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></div></div>)}</div></section>}
    {tab === 'reports' && <section className="admin-content"><div className="admin-panel"><h2>User reports and complaints</h2>{reports.map(report => <div className="admin-row" key={report.id}><div><strong>{report.reason}</strong><span>{report.details}</span></div><select value={report.status} onChange={async e => { const status = e.target.value as UserReport['status']; await reviewReport(user.uid, report.id, status); setReports(prev => prev.map(item => item.id === report.id ? { ...item, status } : item)); }}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select></div>)}</div></section>}
    {tab === 'verification' && <section className="admin-content"><div className="admin-panel"><h2>Skill evidence review</h2>{verifications.map(item => <div className="admin-row" key={item.id}><div><strong>{item.skill}</strong><span>{item.method} · {item.userId}</span></div><div className="admin-actions"><button onClick={async () => { await reviewSkillVerification(user.uid, item.id, 'approved'); setVerifications(prev => prev.map(v => v.id === item.id ? { ...v, status: 'approved' } : v)); }}><Check size={14} /> Approve</button><button onClick={async () => { await reviewSkillVerification(user.uid, item.id, 'rejected'); setVerifications(prev => prev.map(v => v.id === item.id ? { ...v, status: 'rejected' } : v)); }}><X size={14} /> Reject</button></div></div>)}</div></section>}
    {tab === 'skills' && <section className="admin-content"><div className="admin-panel"><h2>Skill catalog</h2><div className="admin-skill-form"><input id="new-skill-name" placeholder="New skill name" /><select id="new-skill-category"><option>Technology</option><option>Academic</option><option>Creative</option><option>Languages</option><option>Business</option><option>Lifestyle</option></select><button className="admin-primary" onClick={async () => { const name = (document.getElementById('new-skill-name') as HTMLInputElement).value.trim(); const category = (document.getElementById('new-skill-category') as HTMLSelectElement).value as SkillInfo['category']; if (!name) return; const skill = { name, category, userCount: 0, icon: 'BookOpen' }; const id = await saveAdminSkill(user.uid, skill); setSkills(prev => [...prev, { ...skill, id }]); (document.getElementById('new-skill-name') as HTMLInputElement).value = ''; }}>Add skill</button></div>{skills.filter(skill => !(skill as SkillInfo & { isArchived?: boolean }).isArchived).map(skill => <div className="admin-row" key={skill.id}><div><strong>{skill.name}</strong><span>{skill.category} · {skill.userCount} learners</span></div></div>)}</div></section>}
    {tab === 'sessions' && <section className="admin-content"><div className="admin-panel"><h2>Session monitoring</h2>{sessions.map(session => <div className="admin-row" key={session.id}><div><strong>{session.skill}</strong><span>{session.teacherName} with {session.learnerName}</span></div><span className={`admin-status ${session.status}`}>{session.status}</span></div>)}</div></section>}
    {tab === 'credits' && <section className="admin-content"><div className="admin-panel"><h2>Credit activity</h2>{transactions.slice().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50).map(transaction => <div className="admin-row" key={transaction.id}><div><strong>{transaction.description}</strong><span>{transaction.userId} · {transaction.type}</span></div><strong className={transaction.amount >= 0 ? 'credit-positive' : 'credit-negative'}>{transaction.amount > 0 ? '+' : ''}{transaction.amount}</strong></div>)}</div></section>}
    {tab === 'reviews' && <section className="admin-content"><div className="admin-panel"><h2>Ratings and review moderation</h2>{comments.map(comment => <div className="admin-row" key={comment.id}><div><strong>{comment.rating}/5 · {comment.userName}</strong><span>{comment.text}</span></div><button className="admin-actions" onClick={async () => { if (!window.confirm('Remove this review? This moderation action will be recorded.')) return; await removeComment(user.uid, comment.id); setComments(prev => prev.filter(item => item.id !== comment.id)); }}><X size={14} /> Remove review</button></div>)}</div></section>}
    {tab === 'settings' && settings && <section className="admin-content"><div className="admin-panel settings-panel"><h2>System settings</h2><label>Credits per session<input type="number" min="1" value={settings.creditsPerSession} onChange={e => setSettings({ ...settings, creditsPerSession: Number(e.target.value) })} /></label><label>Cancellation window (hours)<input type="number" min="0" value={settings.cancellationWindowHours} onChange={e => setSettings({ ...settings, cancellationWindowHours: Number(e.target.value) })} /></label><label className="admin-checkbox"><input type="checkbox" checked={settings.verificationRequired} onChange={e => setSettings({ ...settings, verificationRequired: e.target.checked })} /> Require student verification</label><button className="admin-primary" onClick={saveSettings}><Save size={15} /> Save platform settings</button></div></section>}
  </div>;
}
