import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, UserPlus, CalendarPlus, Loader2, Clock, Flag, Ban, BadgeCheck, Bookmark, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getReviewsAbout, getUser, getMatches, createMatch, submitReport, blockUser } from '../lib/firestoreService';
import { getCompatibleLearnSkills, getCompatibleTeachSkills } from '../lib/matchUtils';
import { isValidTeamsLink } from '../lib/meetingLinks';
import type { Comment, User } from '../types';
import { IntroVideoPlayer } from '../components/introVideo/IntroVideoPlayer';
import { VerifiedBadge } from '../components/VerifiedBadge';
import './TutorProfilePage.css';

export function TutorProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [tutor, setTutor] = useState<User | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [acceptedMatch, setAcceptedMatch] = useState(false);
  const [introVideoUnavailable, setIntroVideoUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTeach, setSelectedTeach] = useState('');
  const [selectedLearn, setSelectedLearn] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingLinkError, setMeetingLinkError] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSending, setBookingSending] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingError, setBookingError] = useState('');
  const currentUserId = user?.uid;

  useEffect(() => {
    if (!uid) return;
    Promise.all([getUser(uid), getReviewsAbout([uid])])
      .then(([profileUser, commentList]) => {
        setTutor(profileUser);
        setComments(commentList);
      })
      .catch(err => console.error('Failed to load tutor profile:', err))
      .finally(() => setLoading(false));
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    setAcceptedMatch(false);
    if (!uid || !currentUserId || uid === currentUserId) {
      setAcceptedMatch(false);
      return;
    }
    getMatches(currentUserId).then(matches => {
      if (cancelled) return;
      setAcceptedMatch(matches.some(match =>
        match.status === 'accepted'
        && ((match.user1Id === currentUserId && match.user2Id === uid)
          || (match.user2Id === currentUserId && match.user1Id === uid))
      ));
    }).catch(error => {
      console.error('Failed to check tutor match:', error);
      if (!cancelled) setAcceptedMatch(false);
    });
    return () => { cancelled = true; };
  }, [uid, currentUserId]);

  const learnOptions = useMemo(() => {
    if (!user || !tutor) return [];
    return getCompatibleLearnSkills(tutor.skillsLearn, user.skillsTeach).length > 0
      ? getCompatibleLearnSkills(tutor.skillsLearn, user.skillsTeach)
      : tutor.skillsTeach;
  }, [tutor, user]);

  const teachOptions = useMemo(() => {
    if (!user || !tutor) return [];
    return getCompatibleTeachSkills(user.skillsTeach, tutor.skillsLearn).length > 0
      ? getCompatibleTeachSkills(user.skillsTeach, tutor.skillsLearn)
      : user.skillsTeach;
  }, [tutor, user]);

  useEffect(() => {
    if (!selectedLearn && learnOptions.length) {
      setSelectedLearn(learnOptions[0]);
    }
    if (!selectedTeach && teachOptions.length) {
      setSelectedTeach(teachOptions[0]);
    }
  }, [learnOptions, teachOptions, selectedLearn, selectedTeach]);

  // Only reviews written about this tutor; a review with no target belongs to nobody.
  const filteredReviews = comments.filter(c => Boolean(tutor?.uid) && c.targetUserId === tutor?.uid);
  const averageReviewRating = filteredReviews.length ? filteredReviews.reduce((total, review) => total + review.rating, 0) / filteredReviews.length : 0;
  const verifiedReviewCount = filteredReviews.filter(review => review.verifiedSession).length;
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({ rating, count: filteredReviews.filter(review => review.rating === rating).length }));

  const canRequestBooking = !!user && !!tutor && tutor.studentVerified === true && !!selectedLearn && !!scheduleDate && !!scheduleTime && !!learningGoal;
  const videoVisibility = tutor?.introductionVideoVisibility || 'members';
  // Public profiles omit the video link unless it is visible to all members, so for "matches only"
  // the player asks Firestore directly; the rules decide and the section hides if refused.
  const canViewIntroductionVideo = !introVideoUnavailable && (
    (videoVisibility === 'members' && Boolean(tutor?.introductionVideoUrl))
    || (videoVisibility === 'matches' && acceptedMatch)
    || user?.uid === tutor?.uid
  );

  const selectedDate = scheduleDate ? new Date(`${scheduleDate}T12:00:00`) : null;
  const selectedDay = selectedDate ? selectedDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6 : null;
  const selectedSlot = selectedDay === null ? undefined : tutor?.weeklyAvailability?.find(slot => slot.day === selectedDay);
  const isWithinAvailability = !tutor?.weeklyAvailability?.length || (!!selectedSlot && scheduleTime >= selectedSlot.start && scheduleTime <= selectedSlot.end);

  const isValidTeamsLinkValue = (link: string) => {
    if (!link.trim()) return true;
    return isValidTeamsLink(link);
  };

  const handleMeetingLinkChange = (value: string) => {
    setMeetingLink(value);
    if (value.trim() && !isValidTeamsLinkValue(value)) {
      setMeetingLinkError('Please enter a valid Microsoft Teams meeting link.');
    } else {
      setMeetingLinkError('');
    }
  };

  const handleSubmitBooking = async () => {
    if (!user || !tutor) return;
    if (!selectedLearn || !scheduleDate || !scheduleTime || !learningGoal.trim()) {
      setBookingError('Please select a skill, date, time and enter your learning goal.');
      return;
    }
    if (!isWithinAvailability) {
      setBookingError('That time is outside this tutor\'s listed availability.');
      return;
    }
    if (meetingLink.trim() && !isValidTeamsLinkValue(meetingLink)) {
      setBookingError('Please enter a valid Microsoft Teams meeting link.');
      return;
    }

    setBookingSending(true);
    setBookingError('');
    setBookingSuccess('');

    try {
      await createMatch({
        user1Id: user.uid,
        user2Id: tutor.uid,
        user1Teaches: selectedTeach || 'N/A',
        user2Teaches: selectedLearn,
        status: 'pending',
        createdAt: new Date(),
        learnerId: user.uid,
        teacherId: tutor.uid,
        requestedAt: new Date(`${scheduleDate}T${scheduleTime}`),
        requestedSkill: selectedLearn,
        offeredSkill: selectedTeach || '',
        learningGoal: learningGoal.trim(),
        meetingLink: meetingLink.trim(),
        requestNotes: bookingNotes.trim(),
      });

      setBookingSuccess('Booking request sent. The tutor will review your request soon.');
      setTimeout(() => navigate('/matches'), 1300);
    } catch (err) {
      console.error('Failed to submit booking request:', err);
      setBookingError('Unable to submit booking. Please try again later.');
    } finally {
      setBookingSending(false);
    }
  };

  const handleReport = async () => {
    if (!user || !tutor) return;
    const reason = window.prompt('Briefly describe the issue:')?.trim();
    if (!reason) return;
    try {
      await submitReport({ reporterId: user.uid, targetUserId: tutor.uid, type: 'user', reason, details: reason });
      window.alert('Report submitted for admin review.');
    } catch (err) {
      console.error('Failed to submit report:', err);
      window.alert('Unable to submit report. Please try again later.');
    }
  };

  const handleBlock = async () => {
    if (!user || !tutor || !window.confirm(`Block ${tutor.displayName}?`)) return;
    try {
      await blockUser(user.uid, tutor.uid);
      window.alert('User blocked.');
      navigate('/explore');
    } catch (err) {
      console.error('Failed to block user:', err);
      window.alert('Unable to block this user. Please try again later.');
    }
  };

  const toggleSavedTutor = async () => {
    if (!user || !tutor) return;
    const saved = user.savedUserIds || [];
    await updateProfile({ savedUserIds: saved.includes(tutor.uid) ? saved.filter(id => id !== tutor.uid) : [...saved, tutor.uid] });
  };

  if (loading) {
    return (
      <div className="tutor-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="tutor-page">
        <div className="tutor-empty">Tutor not found.</div>
      </div>
    );
  }

  return (
    <div className="tutor-page">
      <div className="tutor-hero">
        <button className="back-link" onClick={() => navigate(-1)}>
          ← Back to search
        </button>
        <div className="tutor-card">
          <div className="tutor-avatar">
            {tutor.photoUrl ? <img src={tutor.photoUrl} alt={tutor.displayName} /> : <span>{tutor.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}</span>}
          </div>
          <div className="tutor-summary">
            <h1>{tutor.displayName}{tutor.studentVerified && <VerifiedBadge size={24} />}</h1>
            <p className="tutor-university">{tutor.university}</p>
            <div className="tutor-stats-row">
              <span><Star size={16} /> {tutor.rating}</span>
              <span>·</span>
              <span>{tutor.totalSessions} sessions</span>
            </div>
            <p className="tutor-bio">{tutor.bio || 'No bio available.'}</p>
            {user && user.uid !== tutor.uid && (
              <div className="tutor-safety-actions">
                <button type="button" className="cancel-btn" aria-pressed={user.savedUserIds?.includes(tutor.uid)} onClick={toggleSavedTutor}><Bookmark size={14} fill={user.savedUserIds?.includes(tutor.uid) ? 'currentColor' : 'none'} /> {user.savedUserIds?.includes(tutor.uid) ? 'Saved' : 'Save tutor'}</button>
                <button type="button" className="cancel-btn" onClick={handleReport}><Flag size={14} /> Report</button>
                <button type="button" className="cancel-btn" onClick={handleBlock}><Ban size={14} /> Block</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="tutor-main-grid">
        <section className="tutor-info-card">
          <h2>Tutor Profile</h2>
          <div className="tutor-skills-row">
            <div>
              <h3>Teaches</h3>
              <div className="skill-chip-row">
                {tutor.skillsTeach.map(skill => <span key={skill} className="skill-chip teach">{skill}</span>)}
              </div>
            </div>
            <div>
              <h3>Learning</h3>
              <div className="skill-chip-row">
                {tutor.skillsLearn.map(skill => <span key={skill} className="skill-chip learn">{skill}</span>)}
              </div>
            </div>
          </div>

          <div className="tutor-booking-tip">
            <Clock size={16} /> Search tutor, view their profile, then book a session with a date, time and learning goal.
          </div>
          {tutor.learningGoals && <div className="tutor-booking-tip"><BookOpen size={16} /> Learning goals: {tutor.learningGoals}</div>}
          {tutor.weeklyAvailability?.length ? <div className="tutor-booking-tip"><Clock size={16} /> Available: {tutor.weeklyAvailability.map(slot => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.day]} ${slot.start}-${slot.end}`).join(' · ')}</div> : <div className="tutor-booking-tip"><Clock size={16} /> This tutor has not listed weekly availability yet.</div>}
          {/* Verified students carry the badge by their name. Others get a neutral note: the public profile
              does not reveal whether a document was submitted, so it never claims "pending". */}
          {!tutor.studentVerified && (
            <div className="tutor-verification-status">
              <span className="verification-pill unverified">Not verified yet</span>
            </div>
          )}
          {canViewIntroductionVideo && <div className="tutor-introduction-video"><h3>Introduction video</h3><IntroVideoPlayer userId={tutor.uid} videoUrl={tutor.introductionVideoUrl} onUnavailable={() => setIntroVideoUnavailable(true)} /></div>}
        </section>

        <section className="booking-card">
          <div className="booking-header">
            <CalendarPlus size={20} />
            <div>
              <h2>Book a session</h2>
              <p>{tutor.studentVerified ? 'Choose date, time and specify your learning goal.' : 'This student is not verified yet, so they cannot accept tutoring bookings.'}</p>
            </div>
          </div>

          <div className="booking-fields">
            <label>Skill to learn</label>
            <select value={selectedLearn} onChange={e => setSelectedLearn(e.target.value)}>
              {learnOptions.map(skill => <option key={skill} value={skill}>{skill}</option>)}
            </select>

            <label>Skill you can teach</label>
            <select value={selectedTeach} onChange={e => setSelectedTeach(e.target.value)}>
              {teachOptions.map(skill => <option key={skill} value={skill}>{skill}</option>)}
            </select>

            <div className="booking-datetime-row">
              <div>
                <label>Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="booking-input" />
              </div>
              <div>
                <label>Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="booking-input" />
              </div>
            </div>
            {scheduleDate && scheduleTime && (tutor.weeklyAvailability?.length || 0) > 0 && !isWithinAvailability && <div className="booking-error">Choose a time during the tutor&apos;s listed availability.</div>}

            <label>Learning goal</label>
            <textarea
              value={learningGoal}
              onChange={e => setLearningGoal(e.target.value)}
              placeholder="What do you want to achieve in this session?"
              rows={4}
              className="booking-textarea"
            />

            <label>Meeting link (optional)</label>
            <input
              type="url"
              value={meetingLink}
              onChange={e => handleMeetingLinkChange(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="booking-input"
            />
            {meetingLinkError && <div className="booking-error">{meetingLinkError}</div>}

            <label>Additional notes</label>
            <textarea
              value={bookingNotes}
              onChange={e => setBookingNotes(e.target.value)}
              placeholder="Preparation notes, materials, or other details..."
              rows={3}
              className="booking-textarea"
            />

            {bookingError && <div className="booking-error">{bookingError}</div>}
            {bookingSuccess && <div className="booking-success">{bookingSuccess}</div>}

            <button
              type="button"
              className="booking-submit-btn"
              onClick={handleSubmitBooking}
              disabled={!canRequestBooking || bookingSending}
            >
              {bookingSending ? <Loader2 size={16} className="spinner" /> : <><UserPlus size={16} /> Submit Booking Request</>}
            </button>
          </div>
        </section>
      </div>

      <section className="review-section">
        <div className="reputation-heading"><div><h2>Reviews and reputation</h2><p>Feedback from completed EduSwap sessions.</p></div>{verifiedReviewCount > 0 && <span className="verified-review-total"><BadgeCheck size={15} /> {verifiedReviewCount} verified</span>}</div>
        <div className="reputation-summary">
          <div className="rating-overview"><strong>{averageReviewRating ? averageReviewRating.toFixed(1) : '—'}</strong><span className="review-rating">{'★'.repeat(Math.round(averageReviewRating))}{'☆'.repeat(5 - Math.round(averageReviewRating))}</span><small>{filteredReviews.length} review{filteredReviews.length === 1 ? '' : 's'}</small></div>
          <div className="rating-distribution">{ratingDistribution.map(item => <div key={item.rating}><span>{item.rating} ★</span><i><b style={{ width: `${filteredReviews.length ? (item.count / filteredReviews.length) * 100 : 0}%` }} /></i><small>{item.count}</small></div>)}</div>
        </div>
        {user && tutor && user.uid !== tutor.uid && (
          <div className="verified-review-note"><BadgeCheck size={17} /><span><strong>Reviews require a completed session</strong>After learning together, submit feedback from your Sessions page.</span><button type="button" onClick={() => navigate('/sessions')}>View sessions</button></div>
        )}

        {filteredReviews.length === 0 ? (
          <p className="review-empty">No reviews yet for this tutor.</p>
        ) : (
          <div className="review-list">
            {filteredReviews.map(comment => (
              <div key={comment.id} className="review-card">
                <div className="review-card-header">
                  <span className="review-author-name">{comment.userName}{comment.verifiedSession && <em><BadgeCheck size={12} /> Verified session</em>}</span>
                  <span className="review-rating">{'★'.repeat(comment.rating)}{'☆'.repeat(5 - comment.rating)}</span>
                </div>
                {(comment.skill || comment.timestamp) && <div className="review-context">{comment.skill && <span>{comment.skill}</span>}{comment.timestamp && <time>{comment.timestamp.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</time>}</div>}
                <p>{comment.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
