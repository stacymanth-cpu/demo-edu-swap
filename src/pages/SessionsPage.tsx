import { useState, useEffect } from 'react';
import { Calendar, Clock, Video, Check, XCircle, X, Loader2, RefreshCw, ExternalLink, Download, Star, Bell, Globe2 } from 'lucide-react';
import { getSessions, subscribeSessions, cancelSession, updateSession, completeSessionWithCredits, createComment, getChatRooms, getComments } from '../lib/firestoreService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../lib/firestoreService';
import { format } from 'date-fns';
import type { Session } from '../types';
import { downloadIcsFile, getGoogleCalendarUrl } from '../lib/calendar';
import { formatTimeZoneLabel, getSessionActionError, hasSchedulingConflict } from '../lib/sessionScheduling';
import './SessionsPage.css';

export function SessionsPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'expired' | 'completed' | 'cancelled'>('all');
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviewSession, setReviewSession] = useState<Session | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [sessionCallError, setSessionCallError] = useState('');
  const [chatRoomByPeerId, setChatRoomByPeerId] = useState<Record<string, string>>({});
  const [callChoiceSession, setCallChoiceSession] = useState<Session | null>(null);
  const [callChoiceLoading, setCallChoiceLoading] = useState(false);
  const [reviewedSessionIds, setReviewedSessionIds] = useState<Set<string>>(new Set());
  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSending, setRescheduleSending] = useState(false);
  const [reminderPermission, setReminderPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'denied' : Notification.permission);

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    setLoading(true);
    Promise.all([getSessions(user.uid), getChatRooms(user.uid), getComments()])
      .then(([sessions, rooms, reviews]) => {
        setSessionList(sessions);
        const roomLookup: Record<string, string> = {};
        rooms.forEach((room) => {
          const peerId = room.participants.find((participantId) => participantId !== user.uid);
          if (peerId) {
            roomLookup[peerId] = room.id;
          }
        });
        setChatRoomByPeerId(roomLookup);
        setReviewedSessionIds(new Set(reviews.filter(review => review.userId === user.uid && review.sessionId).map(review => review.sessionId as string)));
      })
      .catch(err => {
        console.error('Failed to load sessions:', err);
        setLoadError('We could not load your sessions. Check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeSessions(user.uid, sessions => setSessionList(sessions), () => setLoadError('Live session updates are unavailable. Refresh to try again.'));
  }, [user]);

  useEffect(() => {
    if (!user || !('Notification' in window)) return;
    const upcoming = sessionList.find(session => session.status === 'scheduled' && session.scheduledAt.getTime() > Date.now() && session.scheduledAt.getTime() - Date.now() <= 60 * 60 * 1000);
    const reminderKey = upcoming ? `eduswap-reminder-${upcoming.id}` : '';
    if (upcoming && Notification.permission === 'granted' && !localStorage.getItem(reminderKey)) {
      new Notification(`EduSwap session in less than an hour`, { body: `${upcoming.skill} with ${upcoming.teacherId === user.uid ? upcoming.learnerName : upcoming.teacherName}` });
      localStorage.setItem(reminderKey, 'sent');
    }
  }, [sessionList, user]);

  const isExpiredSession = (session: Session) => {
    return session.status === 'scheduled' && session.scheduledAt.getTime() < Date.now();
  };

  const getDisplayStatus = (session: Session) => {
    return isExpiredSession(session) ? 'expired' : session.status;
  };

  const filtered = sessionList.filter((session) => {
    const expired = isExpiredSession(session);
    if (filter === 'all') return true;
    if (filter === 'scheduled') return session.status === 'scheduled' && !expired;
    if (filter === 'expired') return expired;
    return session.status === filter;
  });

  const handleComplete = async (session: Session) => {
    if (!user) return;
    const actionError = getSessionActionError(session, user.uid, 'complete');
    if (actionError) {
      setSessionCallError(actionError);
      return;
    }
    try {
      await completeSessionWithCredits(session);
      setSessionList(prev => prev.map(s => s.id === session.id ? { ...s, status: 'completed' as const } : s));
      if (user) {
        const updated = await getUser(user.uid);
        if (updated) {
          updateProfile({ credits: updated.credits, totalSessions: updated.totalSessions });
        }
      }
      setReviewRating(5);
      setReviewText('');
      setReviewError('');
      setReviewSuccess('');
      setReviewSession(session);
    } catch (err) {
      console.error('Failed to complete session:', err);
      setSessionCallError(err instanceof Error ? err.message : 'Unable to complete this session.');
    }
  };

  const handleCancel = async (session: Session) => {
    if (!user) return;
    const actionError = getSessionActionError(session, user.uid, 'cancel');
    if (actionError) {
      setSessionCallError(actionError);
      return;
    }
    const reason = window.prompt('Why are you cancelling this session?')?.trim();
    if (reason === undefined) return;
    if (!reason) {
      setSessionCallError('Please provide a cancellation reason.');
      return;
    }
    try {
      await cancelSession(session, user.uid, reason);
      setSessionList(prev => prev.map(s => s.id === session.id ? { ...s, status: 'cancelled' as const, cancelledBy: user.uid, cancellationReason: reason } : s));
    } catch (err) {
      console.error('Failed to cancel session:', err);
      setSessionCallError(err instanceof Error ? err.message : 'Unable to cancel this session.');
    }
  };

  const openReschedule = (session: Session) => {
    if (!user) return;
    const actionError = getSessionActionError(session, user.uid, 'reschedule');
    if (actionError) {
      setSessionCallError(actionError);
      return;
    }
    setRescheduleSession(session);
    setRescheduleDate(format(session.scheduledAt, 'yyyy-MM-dd'));
    setRescheduleTime(format(session.scheduledAt, 'HH:mm'));
    setRescheduleError('');
  };

  const handleReschedule = async () => {
    if (!rescheduleSession || !rescheduleDate || !rescheduleTime) return;
    if (!user) return;
    const actionError = getSessionActionError(rescheduleSession, user.uid, 'reschedule');
    if (actionError) {
      setRescheduleError(actionError);
      return;
    }
    const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      setRescheduleError('Choose a valid future date and time.');
      return;
    }
    if (hasSchedulingConflict(sessionList, scheduledAt, rescheduleSession.durationMinutes, rescheduleSession.id)) {
      setRescheduleError('This time overlaps another scheduled session.');
      return;
    }
    setRescheduleSending(true);
    try {
      await updateSession(rescheduleSession.id, { scheduledAt, rescheduledFrom: rescheduleSession.scheduledAt });
      setSessionList(prev => prev.map(item => item.id === rescheduleSession.id ? { ...item, scheduledAt, rescheduledFrom: rescheduleSession.scheduledAt } : item));
      setRescheduleSession(null);
    } catch (err) {
      console.error('Failed to reschedule session:', err);
      setRescheduleError('Unable to reschedule this session.');
    } finally {
      setRescheduleSending(false);
    }
  };

  const enableReminders = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setReminderPermission(permission);
  };

  const getReviewTarget = (session: Session): { targetId: string; targetName: string; targetRole?: 'tutor' | 'learner' } => {
    if (!user) return { targetId: '', targetName: '' };
    const isTutor = session.teacherId === user.uid;
    return {
      targetId: isTutor ? session.learnerId : session.teacherId,
      targetName: isTutor ? session.learnerName : session.teacherName,
      targetRole: isTutor ? 'learner' : 'tutor',
    };
  };

  const handleSubmitReview = async () => {
    if (!user || !reviewSession) return;
    const { targetId, targetName } = getReviewTarget(reviewSession);
    if (!targetId) return;
    if (!reviewText.trim() || reviewText.trim().length < 8) {
      setReviewError('Please enter a review with at least 8 characters.');
      return;
    }

    setReviewSending(true);
    setReviewError('');
    setReviewSuccess('');

    try {
      await createComment({
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoUrl || '',
        targetUserId: targetId,
        text: reviewText.trim(),
        rating: reviewRating,
        sessionId: reviewSession.id,
        skill: reviewSession.skill,
        targetRole: getReviewTarget(reviewSession).targetRole,
        timestamp: new Date(),
      });

      setReviewedSessionIds(previous => new Set(previous).add(reviewSession.id));
      setReviewSuccess(`Your review for ${targetName} has been submitted.`);
      setReviewText('');
      setReviewRating(5);
      setTimeout(() => setReviewSession(null), 1200);
    } catch (err) {
      console.error('Failed to submit session review:', err);
      setReviewError('Unable to submit review. Please try again later.');
    } finally {
      setReviewSending(false);
    }
  };

  const closeReviewModal = () => {
    setReviewSession(null);
    setReviewError('');
    setReviewSuccess('');
  };

  const getStatusColor = (status: Session['status'] | 'expired') => {
    switch (status) {
      case 'scheduled': return 'status-scheduled';
      case 'expired': return 'status-expired';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  const getSessionPeerId = (session: Session) => {
    if (!user) return '';
    return session.teacherId === user.uid ? session.learnerId : session.teacherId;
  };

  const handleStartSessionCall = async (session: Session) => {
    if (!user) return;
    setSessionCallError('');

    if (session.status !== 'scheduled') {
      setSessionCallError('Only scheduled sessions can be joined.');
      return;
    }
    if (session.scheduledAt.getTime() > Date.now()) {
      setSessionCallError(`Your Join Call button will appear at ${format(session.scheduledAt, 'h:mm a')}.`);
      return;
    }

    const peerId = getSessionPeerId(session);
    const chatRoomId = chatRoomByPeerId[peerId];

    if (!chatRoomId) {
      setSessionCallError('Open a chat with this user first to start a direct session call.');
      return;
    }

    const params = new URLSearchParams({
      chatRoomId,
      autoStart: '1',
      sessionId: session.id,
    });

    navigate(`/video-call?${params.toString()}`);
  };

  const openCallChoiceModal = (session: Session) => {
    setSessionCallError('');
    setCallChoiceSession(session);
  };

  const closeCallChoiceModal = () => {
    if (callChoiceLoading) return;
    setCallChoiceSession(null);
  };

  const handleCallChoice = async () => {
    if (!callChoiceSession) return;
    setCallChoiceLoading(true);

    try {
      await handleStartSessionCall(callChoiceSession);
      setCallChoiceSession(null);
    } finally {
      setCallChoiceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sessions-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (loadError) {
    return <div className="sessions-page" role="alert"><div className="empty-sessions"><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div></div>;
  }

  return (
    <div className="sessions-page">
      <div className="page-header animate-fade-in-up">
        <div><h1>Sessions</h1><p>Manage your learning and teaching sessions</p></div>
        <button type="button" className={`reminder-toggle ${reminderPermission === 'granted' ? 'active' : ''}`} onClick={enableReminders} disabled={reminderPermission === 'denied'}><Bell size={16} /> {reminderPermission === 'granted' ? 'Reminders on' : reminderPermission === 'denied' ? 'Reminders blocked' : 'Enable reminders'}</button>
      </div>

      <div className="session-filters animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {(['all', 'scheduled', 'expired', 'completed', 'cancelled'] as const).map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {sessionCallError && <div className="session-call-error">{sessionCallError}</div>}

      <div className="sessions-list-full stagger-children">
        {filtered.length === 0 ? (
          <div className="empty-sessions">
            <p>{filter === 'all' ? 'No sessions yet. Accept a match and schedule your first session.' : `No ${filter} sessions found.`}</p>
            {filter === 'all' && <button type="button" onClick={() => navigate('/matches')}>View matches</button>}
          </div>
        ) : (
          filtered.map(session => (
            <div key={session.id} className="session-card-full" id={`session-card-${session.id}`}>
              <div className="session-card-top-row">
                <div className="session-meta">
                  <Calendar size={16} />
                  <span>{format(session.scheduledAt, 'EEEE, MMMM d, yyyy')}</span>
                  <span className="dot-sep">·</span>
                  <Clock size={14} />
                  <span>{format(session.scheduledAt, 'h:mm a')}</span>
                  <span className="dot-sep">·</span>
                  <span>{session.durationMinutes} min</span>
                </div>
                <span className={`session-status ${getStatusColor(getDisplayStatus(session))}`}>
                  {getDisplayStatus(session)}
                </span>
              </div>

              <div className="session-card-body">
                <h3>{session.skill}</h3>
                <p className="session-role">
                  {session.teacherId === user?.uid ? (
                    <>Teaching <strong>{session.learnerName}</strong></>
                  ) : (
                    <>Learning from <strong>{session.teacherName}</strong></>
                  )}
                </p>
                {session.notes && (
                  <p className="session-notes">{session.notes}</p>
                )}
              </div>

              <div className="session-card-footer">
                <div className="session-credits">
                  <span className={session.teacherId === user?.uid ? 'credit-earn' : 'credit-spend'}>
                    {session.teacherId === user?.uid ? '+' : '-'}{session.creditsExchanged} credits
                  </span>
                </div>
                <div className="session-actions-row">
                  {session.status === 'scheduled' && !isExpiredSession(session) && (
                    <>
                      <button className="session-video-btn" type="button" onClick={() => downloadIcsFile(session)} title="Download calendar file">
                        <Download size={14} /> Calendar
                      </button>
                      <button className="session-video-btn" type="button" onClick={() => window.open(getGoogleCalendarUrl(session), '_blank', 'noopener,noreferrer')} title="Add to Google Calendar">
                        <ExternalLink size={14} /> Google Calendar
                      </button>
                    </>
                  )}
                  {session.status === 'scheduled' && session.scheduledAt.getTime() <= Date.now() && (
                    <>
                      <button className="session-video-btn" type="button" onClick={() => openCallChoiceModal(session)}>
                        <Video size={14} /> Join Call
                      </button>
                    </>
                  )}
                  {session.status === 'scheduled' && (
                    <>
                      {session.learnerId === user?.uid ? (
                        <button className="complete-btn" onClick={() => handleComplete(session)}>
                          <Check size={14} /> Complete
                        </button>
                      ) : (
                        <span className="session-awaiting-confirmation">Learner confirms completion</span>
                      )}
                      {!isExpiredSession(session) && (
                        <>
                          <button className="cancel-btn" onClick={() => handleCancel(session)}>
                            <XCircle size={14} /> Cancel
                          </button>
                          <button className="cancel-btn" onClick={() => openReschedule(session)}>
                            <RefreshCw size={14} /> Reschedule
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {session.status === 'scheduled' && isExpiredSession(session) && (
                    <span className="expired-note">Expired session</span>
                  )}
                  {session.status === 'completed' && !reviewedSessionIds.has(session.id) && (
                    <button className="review-session-btn" type="button" onClick={() => { setReviewRating(5); setReviewText(''); setReviewError(''); setReviewSuccess(''); setReviewSession(session); }}>
                      <Star size={14} /> Leave review
                    </button>
                  )}
                  {session.status === 'completed' && reviewedSessionIds.has(session.id) && <span className="review-submitted-badge"><Check size={13} /> Reviewed</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {rescheduleSession && (
        <div className="modal-overlay" onClick={() => setRescheduleSession(null)}>
          <form className="review-modal reschedule-modal" onSubmit={event => { event.preventDefault(); void handleReschedule(); }} onClick={event => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setRescheduleSession(null)} aria-label="Close reschedule modal">×</button>
            <div className="modal-header"><h3>Reschedule session</h3><p>Choose a new time for {rescheduleSession.skill}.</p></div>
            <div className="reschedule-fields"><label>Date<input type="date" className="booking-input" min={format(new Date(), 'yyyy-MM-dd')} value={rescheduleDate} onChange={event => setRescheduleDate(event.target.value)} /></label><label>Time<input type="time" className="booking-input" value={rescheduleTime} onChange={event => setRescheduleTime(event.target.value)} /></label></div>
            <p className="reschedule-timezone"><Globe2 size={14} /> {rescheduleDate && rescheduleTime ? formatTimeZoneLabel(new Date(`${rescheduleDate}T${rescheduleTime}`)) : Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            {rescheduleError && <div className="booking-error">{rescheduleError}</div>}
            <button type="submit" className="booking-submit-btn" disabled={rescheduleSending || !rescheduleDate || !rescheduleTime}>{rescheduleSending ? <Loader2 size={16} className="spinner" /> : <><RefreshCw size={15} /> Confirm new time</>}</button>
          </form>
        </div>
      )}

      {reviewSession && (
        <div className="modal-overlay" onClick={closeReviewModal}>
          <div className="review-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeReviewModal} aria-label="Close review modal">×</button>
            <div className="modal-header">
              <h3>Leave a review</h3>
              <p>Share feedback for {getReviewTarget(reviewSession).targetName} after your session.</p>
            </div>
            <div className="review-form">
              <label htmlFor="session-review-rating">Rating</label>
              <select
                id="session-review-rating"
                value={reviewRating}
                onChange={e => setReviewRating(Number(e.target.value))}
                className="booking-input"
              >
                {[5, 4, 3, 2, 1].map(value => (
                  <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
                ))}
              </select>

              <label htmlFor="session-review-text">Review</label>
              <textarea
                id="session-review-text"
                className="booking-textarea"
                rows={5}
                placeholder="Tell us what went well and what could improve."
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
              />

              {reviewError && <div className="booking-error">{reviewError}</div>}
              {reviewSuccess && <div className="booking-success">{reviewSuccess}</div>}

              <button
                type="button"
                className="booking-submit-btn"
                onClick={handleSubmitReview}
                disabled={reviewSending || reviewText.trim().length < 8}
              >
                {reviewSending ? <Loader2 size={16} className="spinner" /> : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {callChoiceSession && (
        <div className="modal-overlay" onClick={closeCallChoiceModal}>
          <div className="review-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeCallChoiceModal} disabled={callChoiceLoading} aria-label="Close session choice modal">
              <X size={18} />
            </button>
            <h3>Start this session?</h3>
            <p>This will open the in-app video call for your session.</p>
            <div className="yes-no-actions">
              <button
                type="button"
                className="binary-yes-btn"
                onClick={() => handleCallChoice()}
                disabled={callChoiceLoading}
              >
                {callChoiceLoading ? <Loader2 size={16} className="spinner" /> : 'Start video call'}
              </button>
            </div>
            <p className="binary-help-text">
              The session starts in-app immediately with the built-in video call experience.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
