import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Star, MapPin, BookOpen, Coins, Calendar, TrendingUp, ArrowUp, ArrowDown, Loader2, Pencil, X, Plus, Save, Camera, BadgeCheck, CircleCheck, Circle, ChevronDown, ShieldCheck, UserRoundCheck, Video, Award, Eye, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createGroupCallRoom, getSessions, getTransactions, getComments, getSkillsCatalog, getMatches, subscribeMatches, subscribeTransactions, subscribeUserReviews, uploadProfilePhoto, uploadRegistrationDocument, saveIntroVideo, updateIntroVideoAccess, isStoredIntroVideo } from '../lib/firestoreService';
import { IntroVideoRecorder } from '../components/introVideo/IntroVideoRecorder';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { UniversityEmailVerification } from '../components/UniversityEmailVerification';
import { IntroVideoPlayer } from '../components/introVideo/IntroVideoPlayer';
import { SkillPicker } from '../components/SkillPicker';
import { format } from 'date-fns';
import type { Session, CreditTransaction, Comment as UserComment, SkillInfo, SkillMatch, User, WeeklyAvailability } from '../types';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { validateProfile } from '../lib/validation';
import './ProfilePage.css';

const availabilityDays: { day: WeeklyAvailability['day']; label: string }[] = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }, { day: 0, label: 'Sun' },
];

const defaultAvailability: WeeklyAvailability = { day: 1, start: '09:00', end: '17:00' };

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [comments, setComments] = useState<UserComment[]>([]);
  const [profileReviews, setProfileReviews] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creditHistoryOpen, setCreditHistoryOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [acceptedStudentsOpen, setAcceptedStudentsOpen] = useState(false);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingIntroductionVideo, setPendingIntroductionVideo] = useState<File | null>(null);
  const [pendingVideoPreviewUrl, setPendingVideoPreviewUrl] = useState('');
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editTeach, setEditTeach] = useState<string[]>([]);
  const [editLearn, setEditLearn] = useState<string[]>([]);
  const [editSkillLevels, setEditSkillLevels] = useState<Record<string, 'Beginner' | 'Intermediate' | 'Advanced'>>({});
  const [editName, setEditName] = useState('');
  const [editAvailability, setEditAvailability] = useState(user?.availability || 'offline');
  const [newTeachSkill, setNewTeachSkill] = useState('');
  const [newLearnSkill, setNewLearnSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [allSkillsInfo, setAllSkillsInfo] = useState<SkillInfo[]>([]);
  const [linkedStudents, setLinkedStudents] = useState<SkillMatch[]>([]);
  const [registrationUploading, setRegistrationUploading] = useState(false);
  const [registrationUploadProgress, setRegistrationUploadProgress] = useState(0);
  const [displayedRegistrationProgress, setDisplayedRegistrationProgress] = useState(0);
  const [registrationUploadNotice, setRegistrationUploadNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [groupCallCreating, setGroupCallCreating] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [editLearningGoals, setEditLearningGoals] = useState('');
  const [editTeachingStyle, setEditTeachingStyle] = useState<User['preferredTeachingStyle']>('practical');
  const [editLanguages, setEditLanguages] = useState('');
  const [editSessionPreference, setEditSessionPreference] = useState<User['sessionPreference']>('either');
  const [editWeeklyAvailability, setEditWeeklyAvailability] = useState<WeeklyAvailability[]>([]);
  const [editVideoVisibility, setEditVideoVisibility] = useState<User['introductionVideoVisibility']>('members');
  const photoDialogRef = useDialogAccessibility(showPhotoPreview, () => setShowPhotoPreview(false));

  useEffect(() => {
    if (!pendingIntroductionVideo) {
      setPendingVideoPreviewUrl('');
      return;
    }
    const previewUrl = URL.createObjectURL(pendingIntroductionVideo);
    setPendingVideoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [pendingIntroductionVideo]);

  // Firebase can remain at zero until its first network chunk is acknowledged.
  // Keep the UI moving while leaving the final percentage for Firestore submission.
  useEffect(() => {
    if (!registrationUploading && displayedRegistrationProgress >= registrationUploadProgress) return;
    const timer = window.setInterval(() => {
      setDisplayedRegistrationProgress(current => {
        const target = registrationUploading
          ? Math.max(registrationUploadProgress, Math.min(95, current + 1))
          : registrationUploadProgress;
        if (current >= target) {
          window.clearInterval(timer);
          return current;
        }
        const step = Math.max(1, Math.ceil((target - current) / 8));
        return Math.min(target, current + step);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [displayedRegistrationProgress, registrationUploadProgress, registrationUploading]);

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    setLoading(true);
    Promise.all([
      getSessions(user.uid),
      getTransactions(user.uid),
      getComments(),
      getSkillsCatalog(),
      getMatches(user.uid),
    ]).then(([sess, txns, cmts, skills, matches]) => {
      setSessions(sess);
      setTransactions(txns);
      setComments(cmts);
      setProfileReviews(cmts.filter(comment => comment.targetUserId === user.uid));
      setAllSkillsInfo(skills);
      setLinkedStudents(matches.filter(match => match.status === 'accepted'));
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load profile data:', err);
      setLoadError('We could not load your profile data. Check your connection and try again.');
      setAllSkillsInfo([]);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeTransactions(user.uid, setTransactions);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserReviews(user.uid, setProfileReviews);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeMatches(user.uid, matches => {
      setLinkedStudents(matches.filter(match => match.status === 'accepted'));
    });
  }, [user]);

  if (!user) return null;

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const acceptedLinkedStudents = linkedStudents.filter(match => match.status === 'accepted');
  const profileChecklist = [
    { label: 'Add a profile photo', complete: Boolean(user.photoUrl) },
    { label: 'Write a short bio', complete: Boolean(user.bio?.trim()) },
    { label: 'Add skills to teach and learn', complete: user.skillsTeach.length > 0 && user.skillsLearn.length > 0 },
    { label: 'Verify your student account', complete: user.studentVerified === true },
  ];
  const completedChecklistItems = profileChecklist.filter(item => item.complete).length;
  const trustSignals = [
    { label: 'Student identity', detail: user.studentVerified ? 'Approved by EduSwap' : 'Verification required', complete: user.studentVerified === true, icon: BadgeCheck },
    { label: 'Profile photo', detail: user.photoUrl ? 'Photo added' : 'Add a clear profile photo', complete: Boolean(user.photoUrl), icon: UserRoundCheck },
    { label: 'Introduction', detail: user.introductionVideoUrl ? 'Video introduction added' : 'Add an introduction video', complete: Boolean(user.introductionVideoUrl), icon: Video },
    { label: 'Session experience', detail: completedCount > 0 ? `${completedCount} completed session${completedCount === 1 ? '' : 's'}` : 'Complete your first session', complete: completedCount > 0, icon: BookOpen },
    { label: 'Community feedback', detail: profileReviews.length > 0 ? `${profileReviews.length} review${profileReviews.length === 1 ? '' : 's'} received` : 'No reviews received yet', complete: profileReviews.length > 0, icon: Star },
    { label: 'Skill detail', detail: Object.keys(user.skillLevels || {}).length > 0 ? 'Skill levels provided' : 'Add levels to your skills', complete: Object.keys(user.skillLevels || {}).length > 0, icon: Award },
  ];
  const completedTrustSignals = trustSignals.filter(signal => signal.complete).length;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const startEditing = () => {
    setEditBio(user.bio);
    setEditTeach([...user.skillsTeach]);
    setEditLearn([...user.skillsLearn]);
    setEditSkillLevels({ ...(user.skillLevels || {}) });
    setEditName(user.displayName);
    setEditAvailability(user.availability || 'offline');
    setEditLearningGoals(user.learningGoals || '');
    setEditTeachingStyle(user.preferredTeachingStyle || 'practical');
    setEditLanguages((user.languages || []).join(', '));
    setEditSessionPreference(user.sessionPreference || 'either');
    setEditWeeklyAvailability([...(user.weeklyAvailability || [])]);
    setEditVideoVisibility(user.introductionVideoVisibility || 'members');
    setPendingPhoto(null);
    setPendingIntroductionVideo(null);
    setVideoUploadProgress(0);
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setPendingPhoto(null);
    setPendingIntroductionVideo(null);
    setVideoUploadProgress(0);
    setEditing(false);
  };

  // A clip from the in-app recorder; it is saved with the rest of the profile.
  const selectIntroductionVideo = (file: File) => {
    setSaveError('');
    setVideoUploadProgress(0);
    setPendingIntroductionVideo(file);
  };

  const removeProfilePhoto = async () => {
    if (!user.photoUrl || !window.confirm('Delete your current profile picture? This cannot be undone.')) return;
    setRemovingPhoto(true);
    try {
      await updateProfile({ photoUrl: '' });
      setPendingPhoto(null);
      setShowPhotoPreview(false);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const saveProfile = async () => {
    const languages = editLanguages.split(',').map(value => value.trim()).filter(Boolean);
    const validationError = validateProfile({
      displayName: editName,
      bio: editBio,
      skillsTeach: editTeach,
      skillsLearn: editLearn,
      learningGoals: editLearningGoals,
      languages,
    });
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setSaving(true);
    setSaveError('');
    // Save the level shown for every current skill: an untouched dropdown displays
    // "Beginner" but has no value in state. Levels for removed skills are dropped.
    const skillLevels = Object.fromEntries(
      Array.from(new Set([...editTeach, ...editLearn])).map(skill => [skill, editSkillLevels[skill] || 'Beginner'] as const),
    );
    try {
      const updates = {
        displayName: editName,
        bio: editBio,
        skillsTeach: editTeach,
        skillsLearn: editLearn,
        skillLevels,
        availability: editAvailability,
        learningGoals: editLearningGoals.trim(),
        preferredTeachingStyle: editTeachingStyle,
        languages,
        sessionPreference: editSessionPreference,
        weeklyAvailability: editWeeklyAvailability,
        introductionVideoVisibility: editVideoVisibility,
        ...(pendingPhoto ? { photoUrl: await uploadProfilePhoto(user.uid, pendingPhoto) } : {}),
        ...(pendingIntroductionVideo ? { introductionVideoUrl: await saveIntroVideo(user.uid, pendingIntroductionVideo, editVideoVisibility || 'members', setVideoUploadProgress) } : {}),
      };
      // A new visibility applies to the existing recording too (the rules read it from the video).
      if (!pendingIntroductionVideo && isStoredIntroVideo(user.introductionVideoUrl) && editVideoVisibility !== user.introductionVideoVisibility) {
        await updateIntroVideoAccess(user.uid, editVideoVisibility || 'members');
      }
      await updateProfile(updates);
      setPendingPhoto(null);
      setPendingIntroductionVideo(null);
      setEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addTeachSkill = () => {
    const skill = newTeachSkill.trim();
    if (skill && !editTeach.includes(skill)) {
      setEditTeach([...editTeach, skill]);
      setNewTeachSkill('');
    }
  };

  const addLearnSkill = () => {
    const skill = newLearnSkill.trim();
    if (skill && !editLearn.includes(skill)) {
      setEditLearn([...editLearn, skill]);
      setNewLearnSkill('');
    }
  };

  const removeTeachSkill = (s: string) => setEditTeach(editTeach.filter(x => x !== s));
  const removeLearnSkill = (s: string) => setEditLearn(editLearn.filter(x => x !== s));

  const handleTeachKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTeachSkill(); }
  };
  const handleLearnKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addLearnSkill(); }
  };

  // Skill suggestions for manual typing
  const teachSuggestions = allSkillsInfo.map(s => s.name).filter(s => !editTeach.includes(s) && s.toLowerCase().includes(newTeachSkill.toLowerCase()) && newTeachSkill.length > 0).slice(0, 5);
  const learnSuggestions = allSkillsInfo.map(s => s.name).filter(s => !editLearn.includes(s) && s.toLowerCase().includes(newLearnSkill.toLowerCase()) && newLearnSkill.length > 0).slice(0, 5);

  if (loading) {
    return (
      <div className="profile-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="profile-page" role="alert" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div>
          <p>{loadError}</p>
          <button className="profile-edit-btn" type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <section className="profile-header animate-fade-in-up">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <div className="profile-avatar-xl">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.displayName} />
            ) : (
              <span>{getInitials(user.displayName)}</span>
            )}
            <div className="online-ring" />
            {editing && (
              <>
                <button className="avatar-tool-btn avatar-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={saving} type="button" id="btn-upload-photo" aria-label="Choose a new profile picture" title="Change picture"><Camera size={16} /></button>
                {user.photoUrl && <button className="avatar-tool-btn avatar-view-btn" onClick={() => setShowPhotoPreview(true)} type="button" aria-label="View profile picture" title="View picture"><Eye size={16} /></button>}
                {user.photoUrl && <button className="avatar-tool-btn avatar-delete-btn" onClick={removeProfilePhoto} disabled={removingPhoto} type="button" aria-label="Delete profile picture" title="Delete picture">{removingPhoto ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}</button>}
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => setPendingPhoto(e.target.files?.[0] || null)}
            />
          </div>

          {editing ? (
            <input
              type="text"
              className="edit-name-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Your name"
              id="edit-name"
            />
          ) : (
            <h1>{user.displayName}{user.studentVerified && <VerifiedBadge size={24} />}</h1>
          )}

          <div className="profile-meta">
            <span><MapPin size={14} /> {user.university}</span>
            <span><Calendar size={14} /> Joined {format(user.joinedAt, 'MMMM yyyy')}</span>
            <span className={`availability-dot ${user.availability || 'offline'}`} />
            <span>{(user.availability || 'offline').replace(/^./, value => value.toUpperCase())}</span>
          </div>

          {editing ? (
            <textarea
              className="edit-bio-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              placeholder="Write something about yourself..."
              rows={3}
              id="edit-bio"
            />
          ) : (
            <p className="profile-bio">{user.bio || 'No bio yet. Click Edit to add one!'}</p>
          )}

          <div className="profile-badges">
            <div className="profile-badge">
              <Star size={16} />
              <span>{user.rating}</span>
              <span className="badge-label">Rating</span>
            </div>
            <div className="profile-badge">
              <BookOpen size={16} />
              <span>{user.totalSessions}</span>
              <span className="badge-label">Sessions</span>
            </div>
            <div className="profile-badge">
              <Coins size={16} />
              <span>{user.credits}</span>
              <span className="badge-label">Credits</span>
            </div>
            <div className="profile-badge">
              <TrendingUp size={16} />
              <span>{completedCount}</span>
              <span className="badge-label">Completed</span>
            </div>
          </div>

          {/* Edit / Save / Cancel buttons */}
          <div className="profile-actions">
            {editing ? (
              <>
                {saveError && <div className="field-error" role="alert">{saveError}</div>}
                <button className="profile-save-btn" onClick={saveProfile} disabled={saving} id="btn-save-profile">
                  {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="profile-cancel-btn" onClick={cancelEditing} disabled={saving} id="btn-cancel-edit">
                  <X size={16} /> Cancel
                </button>
              </>
            ) : (
              <button className="profile-edit-btn" onClick={startEditing} id="btn-edit-profile">
                <Pencil size={16} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-section profile-section-wide trust-center animate-fade-in-up">
          <div className="trust-center-heading">
            <div className="trust-center-title">
              <span className="trust-shield"><ShieldCheck size={22} /></span>
              <div><h2>Trust and safety</h2><p>These signals help students make informed decisions before connecting.</p></div>
            </div>
            <div className="trust-progress-summary" aria-label={`${completedTrustSignals} of ${trustSignals.length} trust signals complete`}>
              <strong>{completedTrustSignals}/{trustSignals.length}</strong>
              <span>signals complete</span>
            </div>
          </div>
          <div className="trust-progress-track"><span style={{ width: `${(completedTrustSignals / trustSignals.length) * 100}%` }} /></div>
          <div className="trust-signals-grid">
            {trustSignals.map(signal => {
              const SignalIcon = signal.icon;
              return <div className={`trust-signal ${signal.complete ? 'complete' : 'incomplete'}`} key={signal.label}><span className="trust-signal-icon"><SignalIcon size={17} /></span><span><strong>{signal.label}</strong><small>{signal.detail}</small></span>{signal.complete ? <CircleCheck size={17} aria-label="Complete" /> : <Circle size={17} aria-label="Incomplete" />}</div>;
            })}
          </div>
          <p className="trust-disclaimer"><ShieldCheck size={14} /> Verification confirms student documentation was reviewed; it does not guarantee session outcomes.</p>
        </section>

        {completedChecklistItems < profileChecklist.length && (
          <section className="profile-section profile-section-wide profile-checklist animate-fade-in-up">
            <div className="profile-checklist-heading">
              <div><h2>Complete your profile</h2><p>Complete these details to make it easier for students to find and trust you.</p></div>
              <strong>{completedChecklistItems}/{profileChecklist.length}</strong>
            </div>
            <div className="profile-checklist-progress"><span style={{ width: `${(completedChecklistItems / profileChecklist.length) * 100}%` }} /></div>
            <div className="profile-checklist-items">
              {profileChecklist.map(item => <div className={item.complete ? 'complete' : ''} key={item.label}>{item.complete ? <CircleCheck size={17} /> : <Circle size={17} />}<span>{item.label}</span></div>)}
            </div>
          </section>
        )}

        <section className="profile-section profile-section-wide profile-professional animate-fade-in-up">
          <h2>Professional profile</h2>
          <div className="professional-fields">
            {editing ? <label>Availability<select value={editAvailability} onChange={e => setEditAvailability(e.target.value as typeof editAvailability)}><option value="available">Available</option><option value="teaching">Currently teaching</option><option value="pending">Pending request</option><option value="offline">Offline / unavailable</option></select></label> : <div className="professional-readonly-field"><span>Availability</span><strong>{(user.availability || 'offline').replace(/^./, value => value.toUpperCase())}</strong></div>}
            <div className="professional-readonly-field"><span>Introduction video</span><strong>{pendingIntroductionVideo ? (saving && videoUploadProgress > 0 ? `Saving ${videoUploadProgress}%` : 'New recording ready to save') : user.introductionVideoUrl ? 'Recorded' : 'Not recorded yet'}</strong></div>
            {editing ? <label>Session preference<select value={editSessionPreference} onChange={e => setEditSessionPreference(e.target.value as User['sessionPreference'])}><option value="either">Remote or in person</option><option value="remote">Remote</option><option value="in_person">In person</option></select></label> : <div className="professional-readonly-field"><span>Session preference</span><strong>{(user.sessionPreference || 'either').replace('_', ' ')}</strong></div>}
            {editing ? <label>Teaching style<select value={editTeachingStyle} onChange={e => setEditTeachingStyle(e.target.value as User['preferredTeachingStyle'])}><option value="practical">Practical exercises</option><option value="visual">Visual demonstrations</option><option value="discussion">Discussion</option><option value="structured">Structured lessons</option></select></label> : <div className="professional-readonly-field"><span>Teaching style</span><strong>{user.preferredTeachingStyle || 'Practical'}</strong></div>}
            {editing ? <label>Languages<input value={editLanguages} onChange={e => setEditLanguages(e.target.value)} placeholder="English, isiZulu" /></label> : <div className="professional-readonly-field"><span>Languages</span><strong>{user.languages?.join(', ') || 'Not provided'}</strong></div>}
            {editing ? <label>Video visibility<select value={editVideoVisibility} onChange={e => setEditVideoVisibility(e.target.value as User['introductionVideoVisibility'])}><option value="members">All members</option><option value="matches">Accepted matches only</option><option value="private">Only me</option></select></label> : <div className="professional-readonly-field"><span>Video visibility</span><strong>{user.introductionVideoVisibility || 'members'}</strong></div>}
          </div>
          {editing ? (
            <div className="availability-editor">
              <span className="availability-editor-label">Weekly availability</span>
              <div className="availability-day-list">
                {availabilityDays.map(({ day, label }) => {
                  const slot = editWeeklyAvailability.find(item => item.day === day);
                  return <div className="availability-day-row" key={day}>
                    <label className="availability-day-toggle"><input type="checkbox" checked={Boolean(slot)} onChange={event => setEditWeeklyAvailability(current => event.target.checked ? [...current, { ...defaultAvailability, day }] : current.filter(item => item.day !== day))} /> {label}</label>
                    <input type="time" aria-label={`${label} start time`} disabled={!slot} value={slot?.start || defaultAvailability.start} onChange={event => setEditWeeklyAvailability(current => current.map(item => item.day === day ? { ...item, start: event.target.value } : item))} />
                    <span>to</span>
                    <input type="time" aria-label={`${label} end time`} disabled={!slot} value={slot?.end || defaultAvailability.end} onChange={event => setEditWeeklyAvailability(current => current.map(item => item.day === day ? { ...item, end: event.target.value } : item))} />
                  </div>;
                })}
              </div>
            </div>
          ) : (
            <div className="professional-readonly-field availability-summary"><span>Weekly availability</span><strong>{user.weeklyAvailability?.length ? user.weeklyAvailability.map(slot => `${availabilityDays.find(item => item.day === slot.day)?.label} ${slot.start}-${slot.end}`).join(' · ') : 'Not provided'}</strong></div>
          )}
          <div className="profile-goals-field">{editing ? <label>Learning goals<textarea rows={3} maxLength={500} value={editLearningGoals} onChange={e => setEditLearningGoals(e.target.value)} placeholder="What would you like to achieve?" /></label> : <><span>Learning goals</span><p>{user.learningGoals || 'Add a specific goal to improve your recommendations.'}</p></>}</div>
          {(pendingVideoPreviewUrl || user.introductionVideoUrl) && <div className="profile-video-preview"><div><span>{pendingIntroductionVideo ? 'New introduction video' : 'Introduction video'}</span><p>{pendingIntroductionVideo ? 'Save your profile to publish this recording.' : 'This is how your video appears to other students.'}</p></div>{pendingVideoPreviewUrl ? <video controls preload="metadata" playsInline src={pendingVideoPreviewUrl} /> : <IntroVideoPlayer userId={user.uid} videoUrl={user.introductionVideoUrl} />}</div>}
          {editing && <IntroVideoRecorder disabled={saving} onRecorded={selectIntroductionVideo} />}
        </section>

        <section className="profile-section profile-section-wide animate-fade-in-up">
          <h2>Student verification</h2>
          {!user.studentVerified && <UniversityEmailVerification email={user.email} />}
          {/* Once verified, read mode shows only the status; the explanations appear while editing. */}
          {(editing || !user.studentVerified) && <p className="verification-copy">{editing ? 'Upload proof of registration for admin review. Only approved students can accept tutor bookings.' : 'Only approved students can accept tutor bookings. Click Edit Profile to upload proof of registration.'}</p>}
          {editing && <label className="registration-document-upload"><span>Registration document</span><input type="file" accept="application/pdf,image/jpeg,image/png" disabled={registrationUploading} onChange={async e => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; setRegistrationUploadNotice(null); setRegistrationUploadProgress(0); setDisplayedRegistrationProgress(0); setRegistrationUploading(true); try { await uploadRegistrationDocument(user.uid, file, setRegistrationUploadProgress); setRegistrationUploadProgress(100); setDisplayedRegistrationProgress(100); setRegistrationUploadNotice({ type: 'success', message: '100% uploaded. Your verification is now pending admin approval.' }); } catch (error) { console.error('Registration upload failed:', error); setRegistrationUploadProgress(0); setDisplayedRegistrationProgress(0); setRegistrationUploadNotice({ type: 'error', message: error instanceof Error ? error.message : 'Document upload failed. Please check your connection and try again.' }); } finally { setRegistrationUploading(false); input.value = ''; } }} /><small className="upload-help">PDF, JPG, or PNG. Maximum file size: 5 MB.</small></label>}
          {(registrationUploading || registrationUploadProgress === 100) && <div className="registration-upload-progress"><div className="registration-upload-progress-label"><span>{displayedRegistrationProgress < 100 ? 'Uploading registration document' : 'Upload complete'}</span><strong>{displayedRegistrationProgress}%</strong></div><progress aria-label="Registration document upload progress" max={100} value={displayedRegistrationProgress}>{displayedRegistrationProgress}%</progress></div>}
          {/* The upload's "pending approval" message is hidden once an admin has reviewed it. */}
          {editing && user.registrationVerificationStatus === 'approved' && <div className="registration-upload-notice success" role="status"><BadgeCheck size={17} aria-hidden="true" /><span>Your registration was approved. You are a verified student and can accept tutor bookings.</span></div>}
          {user.registrationVerificationStatus === 'rejected' && <div className="registration-upload-notice error" role="status"><span>Your registration document was not approved. Please upload a clear, current proof of registration.</span></div>}
          {registrationUploadNotice && (registrationUploadNotice.type === 'error' || user.registrationVerificationStatus === 'pending') && <div className={`registration-upload-notice ${registrationUploadNotice.type}`} role={registrationUploadNotice.type === 'error' ? 'alert' : 'status'}>{registrationUploadNotice.type === 'success' && <CircleCheck size={17} aria-hidden="true" />}<span>{registrationUploadNotice.message}</span></div>}
          <span className={`verification-status ${user.registrationVerificationStatus || 'not_submitted'}`}>{user.registrationVerificationStatus === 'approved' && <BadgeCheck size={15} aria-hidden="true" />}Verification: {(user.registrationVerificationStatus || 'not_submitted').replaceAll('_', ' ')}</span>
        </section>

        <section className="profile-section profile-section-wide animate-fade-in-up">
          <div className="credit-history-header">
            <button type="button" className="credit-history-toggle" aria-expanded={acceptedStudentsOpen} aria-controls="accepted-students-list" onClick={() => setAcceptedStudentsOpen(open => !open)}>
              <h2>Accepted students ({linkedStudents.length})</h2>
              <ChevronDown className={acceptedStudentsOpen ? 'is-open' : ''} size={19} aria-hidden="true" />
            </button>
            {acceptedStudentsOpen && <button type="button" className="credit-history-close" onClick={() => setAcceptedStudentsOpen(false)} aria-label="Close accepted students"><X size={18} /></button>}
          </div>
          {acceptedStudentsOpen && <div className="collapsible-section-content" id="accepted-students-list">
            <div className="linked-students-list">{linkedStudents.length === 0 ? <p className="verification-copy">Students whose matches you accept will appear here.</p> : linkedStudents.map(match => { const student = match.user1Id === user.uid ? match.user2 : match.user1; const studentReviews = comments.filter(comment => comment.targetUserId === student.uid); return <div className="linked-student-row" key={match.id}><div className="linked-student-avatar">{student.photoUrl ? <img src={student.photoUrl} alt={student.displayName} /> : student.displayName.slice(0, 1)}</div><div className="linked-student-details"><strong>{student.displayName}</strong><span>{student.university}</span><span>{student.skillsTeach.slice(0, 3).join(', ') || 'Skills pending'} · {student.availability || 'offline'}</span><div className="linked-student-reviews"><span className="linked-review-summary"><Star size={13} /> {student.rating || 'No rating'} · {studentReviews.length} review{studentReviews.length === 1 ? '' : 's'}</span>{studentReviews.slice(0, 2).map(review => <span className="linked-review-item" key={review.id}>"{review.text}"</span>)}</div></div><span className={`match-status ${match.status}`}>{match.status}</span><span className={`availability-dot ${student.availability || 'offline'}`} /></div>; })}</div>
            {acceptedLinkedStudents.length > 0 && <button className="profile-save-btn group-call-btn" disabled={groupCallCreating} onClick={async () => { setGroupCallCreating(true); try { const title = `${user.displayName}'s group skill session`; const participantIds = acceptedLinkedStudents.map(match => match.user1Id === user.uid ? match.user2Id : match.user1Id); const roomId = await createGroupCallRoom(user.uid, title, participantIds); window.location.assign(`/group-call?room=${encodeURIComponent(roomId)}&title=${encodeURIComponent(title)}`); } catch (error) { console.error('Failed to create group call:', error); } finally { setGroupCallCreating(false); } }}>{groupCallCreating ? 'Creating group call...' : 'Start group call with accepted matches'}</button>}
          </div>}
        </section>

        {/* Skills I Teach */}
        <section className="profile-section animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h2>Skills I Teach</h2>
          <div className="profile-skills">
            {(editing ? editTeach : user.skillsTeach).map(s => (
              <span key={s} className="profile-skill-chip teach">
                {s}{user.skillLevels?.[s] && <small> · {user.skillLevels[s]}</small>}
                {editing && <select aria-label={`${s} skill level`} value={editSkillLevels[s] || 'Beginner'} onChange={e => setEditSkillLevels({ ...editSkillLevels, [s]: e.target.value as 'Beginner' | 'Intermediate' | 'Advanced' })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>}
                {editing && (
                  <button className="skill-remove-btn" onClick={() => removeTeachSkill(s)} aria-label={`Remove ${s}`}>
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {!editing && user.skillsTeach.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No teaching skills added yet.</p>
            )}
          </div>
          {editing && (
            <>
              <div className="skill-add-row">
                <div className="skill-input-wrapper">
                  <input
                    type="text"
                    placeholder="Add a skill you can teach..."
                    value={newTeachSkill}
                    onChange={e => setNewTeachSkill(e.target.value)}
                    onKeyDown={handleTeachKeyDown}
                    className="skill-add-input"
                    id="input-add-teach"
                  />
                  {teachSuggestions.length > 0 && (
                    <div className="skill-suggestions">
                      {teachSuggestions.map(s => (
                        <button key={s} className="skill-suggestion" onClick={() => { setEditTeach([...editTeach, s]); setNewTeachSkill(''); }}>
                          <Plus size={12} /> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="skill-add-btn" onClick={addTeachSkill} disabled={!newTeachSkill.trim()} id="btn-add-teach">
                  <Plus size={16} />
                </button>
              </div>
              <div className="skill-picker-block">
                <SkillPicker
                  label="Teach"
                  allSkillsInfo={allSkillsInfo}
                  currentSkills={editTeach}
                  onAddSkills={setEditTeach}
                  buttonId="btn-teach-skill-picker"
                />
              </div>
            </>
          )}
        </section>

        {/* Skills I Want to Learn */}
        <section className="profile-section animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h2>Skills I Want to Learn</h2>
          <div className="profile-skills">
            {(editing ? editLearn : user.skillsLearn).map(s => (
              <span key={s} className="profile-skill-chip learn">
                {s}{user.skillLevels?.[s] && <small> · {user.skillLevels[s]}</small>}
                {editing && <select aria-label={`${s} skill level`} value={editSkillLevels[s] || 'Beginner'} onChange={e => setEditSkillLevels({ ...editSkillLevels, [s]: e.target.value as 'Beginner' | 'Intermediate' | 'Advanced' })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>}
                {editing && (
                  <button className="skill-remove-btn" onClick={() => removeLearnSkill(s)} aria-label={`Remove ${s}`}>
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {!editing && user.skillsLearn.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No learning skills added yet.</p>
            )}
          </div>
          {editing && (
            <>
              <div className="skill-add-row">
                <div className="skill-input-wrapper">
                  <input
                    type="text"
                    placeholder="Add a skill you want to learn..."
                    value={newLearnSkill}
                    onChange={e => setNewLearnSkill(e.target.value)}
                    onKeyDown={handleLearnKeyDown}
                    className="skill-add-input"
                    id="input-add-learn"
                  />
                  {learnSuggestions.length > 0 && (
                    <div className="skill-suggestions">
                      {learnSuggestions.map(s => (
                        <button key={s} className="skill-suggestion" onClick={() => { setEditLearn([...editLearn, s]); setNewLearnSkill(''); }}>
                          <Plus size={12} /> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="skill-add-btn" onClick={addLearnSkill} disabled={!newLearnSkill.trim()} id="btn-add-learn">
                  <Plus size={16} />
                </button>
              </div>
              <div className="skill-picker-block">
                <SkillPicker
                  label="Learn"
                  allSkillsInfo={allSkillsInfo}
                  currentSkills={editLearn}
                  onAddSkills={setEditLearn}
                  buttonId="btn-learn-skill-picker"
                />
              </div>
            </>
          )}
        </section>

        {/* Credit History */}
        <section className="profile-section profile-section-wide profile-activity-section animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="credit-history-header">
            <button
              type="button"
              className="credit-history-toggle"
              aria-expanded={creditHistoryOpen}
              aria-controls="credit-history-list"
              onClick={() => setCreditHistoryOpen(open => !open)}
            >
              <h2>Credit History</h2>
              <ChevronDown className={creditHistoryOpen ? 'is-open' : ''} size={19} aria-hidden="true" />
            </button>
            {creditHistoryOpen && (
              <button type="button" className="credit-history-close" onClick={() => setCreditHistoryOpen(false)} aria-label="Close credit history">
                <X size={18} />
              </button>
            )}
          </div>
          {creditHistoryOpen && (
            <div className="credit-history" id="credit-history-list">
              {transactions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>No transactions yet.</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="credit-row" id={`tx-${tx.id}`}>
                    <div className={`credit-icon ${tx.amount > 0 ? 'earn' : 'spend'}`}>
                      {tx.amount > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </div>
                    <div className="credit-detail">
                      <span className="credit-desc">{tx.description}</span>
                      <span className="credit-date">{format(tx.timestamp, 'MMM d, yyyy')}</span>
                    </div>
                    <span className={`credit-amount ${tx.amount > 0 ? 'earn' : 'spend'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} credits
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="profile-section profile-section-wide profile-activity-section animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="credit-history-header">
            <button
              type="button"
              className="credit-history-toggle"
              aria-expanded={reviewsOpen}
              aria-controls="reviews-list"
              onClick={() => setReviewsOpen(open => !open)}
            >
              <h2>Reviews ({profileReviews.length})</h2>
              <ChevronDown className={reviewsOpen ? 'is-open' : ''} size={19} aria-hidden="true" />
            </button>
            {reviewsOpen && (
              <button type="button" className="credit-history-close" onClick={() => setReviewsOpen(false)} aria-label="Close reviews">
                <X size={18} />
              </button>
            )}
          </div>
          {reviewsOpen && (
            <div className="reviews-list collapsible-section-content" id="reviews-list">
              {profileReviews.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>No reviews yet.</p>
              ) : (
                profileReviews.map(c => (
                  <div key={c.id} className="review-card" id={`review-${c.id}`}>
                    <div className="review-header">
                      <div className="review-avatar">
                        <span>{getInitials(c.userName)}</span>
                      </div>
                      <div className="review-author">
                        <span className="review-name">{c.userName}</span>
                        <span className="review-date">{format(c.timestamp, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="review-stars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} className={i < c.rating ? 'star-filled' : 'star-empty'} />
                        ))}
                      </div>
                    </div>
                    <p className="review-text">{c.text}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
      {showPhotoPreview && user.photoUrl && (
        <div className="modal-overlay profile-photo-overlay" onClick={() => setShowPhotoPreview(false)}>
          <div ref={photoDialogRef} className="profile-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
            <div className="profile-photo-dialog-header"><h2 id="profile-photo-title">Profile picture</h2><button type="button" aria-label="Close profile picture" onClick={() => setShowPhotoPreview(false)}><X size={20} /></button></div>
            <img src={user.photoUrl} alt={`${user.displayName}'s profile`} />
            <div className="profile-photo-dialog-actions"><button type="button" onClick={() => { setShowPhotoPreview(false); fileInputRef.current?.click(); }}><Camera size={16} /> Change picture</button><button type="button" className="danger" onClick={removeProfilePhoto}><Trash2 size={16} /> Delete picture</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
