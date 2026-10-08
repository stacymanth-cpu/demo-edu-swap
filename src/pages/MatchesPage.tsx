import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Star, ArrowLeftRight, Loader2, CalendarPlus, Clock, MessageCircle, Video, Search, Users, Wifi, UserRound, Globe2 } from 'lucide-react';
import { subscribeMatches, updateMatchStatus, createSession, getOrCreateChatRoom, subscribeSessions, getSessions } from '../lib/firestoreService';
import { useAuth } from '../context/AuthContext';
import { canScheduleSession, formatTimeZoneLabel, getScheduleValidationError, hasSchedulingConflict } from '../lib/sessionScheduling';
import type { Session, SkillMatch } from '../types';
import { VerifiedBadge } from '../components/VerifiedBadge';
import './MatchesPage.css';

type MeetingMode = 'eduswap';

interface SuggestedSlot {
  iso: string;
  date: string;
  time: string;
  label: string;
}

type BinaryChoice = 'yes' | 'no' | '';

interface PreSessionAnswers {
  topicAgreed: BinaryChoice;
  availabilityConfirmed: BinaryChoice;
  materialsReady: BinaryChoice;
  reminderRequested: BinaryChoice;
  guidelineAgreement: BinaryChoice;
}

const defaultPreSessionAnswers: PreSessionAnswers = {
  topicAgreed: '',
  availabilityConfirmed: '',
  materialsReady: '',
  reminderRequested: '',
  guidelineAgreement: '',
};

export function MatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [matchList, setMatchList] = useState<SkillMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Schedule session state
  const [scheduleMatch, setScheduleMatch] = useState<SkillMatch | null>(null);
  const [scheduleRole, setScheduleRole] = useState<'teach' | 'learn'>('teach');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('eduswap');
  const [preSessionAnswers, setPreSessionAnswers] = useState<PreSessionAnswers>(defaultPreSessionAnswers);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [selectedSlotIso, setSelectedSlotIso] = useState('');
  const [scheduleSending, setScheduleSending] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduledSessions, setScheduledSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    const unsubscribe = subscribeMatches(user.uid, matches => {
      setMatchList(matches);
      setLoading(false);
    }, () => {
      setLoadError('We could not load your matches. Check your connection and try again.');
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeSessions(user.uid, setScheduledSessions);
  }, [user]);

  const handleAccept = async (matchId: string) => {
    await updateMatchStatus(matchId, 'accepted');
    setMatchList(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted' as const } : m));
    // Show the new partner, with Message and Schedule Session, instead of an emptier Pending list.
    setActiveTab('accepted');
  };

  const handleDecline = async (matchId: string) => {
    await updateMatchStatus(matchId, 'declined');
    setMatchList(prev => prev.map(m => m.id === matchId ? { ...m, status: 'declined' as const } : m));
  };

  const getOtherUser = (match: SkillMatch) => {
    return match.user1Id === user?.uid ? match.user2 : match.user1;
  };

  const getTeachSkill = (match: SkillMatch) => {
    return match.user1Id === user?.uid ? match.user1Teaches : match.user2Teaches;
  };

  const getLearnSkill = (match: SkillMatch) => {
    return match.user1Id === user?.uid ? match.user2Teaches : match.user1Teaches;
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const isWithinAvailability = (date: Date, participant: NonNullable<SkillMatch['user1']>) => {
    const availability = participant.weeklyAvailability;
    if (!availability?.length) return true;
    const slot = availability.find(item => item.day === date.getDay());
    if (!slot) return false;
    const startMinutes = Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3));
    const endMinutes = Number(slot.end.slice(0, 2)) * 60 + Number(slot.end.slice(3));
    const candidateMinutes = date.getHours() * 60 + date.getMinutes();
    const candidateEndMinutes = candidateMinutes + scheduleDuration;
    return candidateMinutes >= startMinutes && candidateEndMinutes <= endMinutes;
  };

  const getScheduledSessionForMatch = (matchId: string) => scheduledSessions.find(session => session.matchId === matchId && (session.status === 'scheduled' || session.status === 'in_progress'));

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMatches = matchList
    .filter(match => match.status === activeTab)
    .filter(match => {
      const other = getOtherUser(match);
      const searchableText = [
        other.displayName,
        other.university,
        getTeachSkill(match),
        getLearnSkill(match),
      ].join(' ').toLowerCase();

      return (!onlineOnly || other.isOnline) && (!normalizedQuery || searchableText.includes(normalizedQuery));
    })
    .sort((a, b) => Number(getOtherUser(b).isOnline) - Number(getOtherUser(a).isOnline));

  const counts = {
    pending: matchList.filter(m => m.status === 'pending').length,
    accepted: matchList.filter(m => m.status === 'accepted').length,
    declined: matchList.filter(m => m.status === 'declined').length,
  };

  const openScheduleModal = (match: SkillMatch) => {
    setScheduleMatch(match);
    setScheduleRole('teach');
    setScheduleDate('');
    setScheduleTime('');
    setScheduleDuration(60);
    setMeetingMode('eduswap');
    setPreSessionAnswers(defaultPreSessionAnswers);
    setScheduleNotes('');
    setSuggestedSlots(buildSuggestedSlots());
    setSelectedSlotIso('');
    setScheduleError('');
    setScheduleSuccess('');
  };

  const closeScheduleModal = () => {
    setScheduleMatch(null);
    setScheduleError('');
    setScheduleSuccess('');
  };

  const toDateInput = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toTimeInput = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const formatSlotLabel = (d: Date) => {
    const dayLabel = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeLabel = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${dayLabel} at ${timeLabel}`;
  };

  const buildSuggestedSlots = (): SuggestedSlot[] => {
    const slots: SuggestedSlot[] = [];
    const now = new Date();
    const cursor = new Date(now.getTime() + 60 * 60 * 1000);
    cursor.setMinutes(cursor.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (cursor <= now) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
    }

    while (slots.length < 12) {
      const hour = cursor.getHours();
      const other = scheduleMatch ? getOtherUser(scheduleMatch) : null;
      if (hour >= 8 && hour <= 20 && !hasSchedulingConflict(scheduledSessions, cursor, scheduleDuration) && (!other || (isWithinAvailability(cursor, user!) && isWithinAvailability(cursor, other)))) {
        slots.push({
          iso: cursor.toISOString(),
          date: toDateInput(cursor),
          time: toTimeInput(cursor),
          label: formatSlotLabel(cursor),
        });
      }
      cursor.setHours(cursor.getHours() + 3, 0, 0, 0);
      if (cursor.getHours() > 20 || cursor.getHours() < 8) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(9, 0, 0, 0);
      }
    }

    return slots;
  };

  const setPreSessionAnswer = (key: keyof PreSessionAnswers, value: Exclude<BinaryChoice, ''>) => {
    setPreSessionAnswers(prev => ({ ...prev, [key]: value }));
  };

  const areAllPreSessionAnswersComplete = Object.values(preSessionAnswers).every(value => value !== '');

  const isScheduleButtonEnabled = canScheduleSession({
    user,
    scheduleMatch,
    scheduleDate,
    scheduleTime,
    areAllPreSessionAnswersComplete,
    meetingMode,
    scheduleLink: '',
    isTeamsLinkValid: () => false,
  });
  const candidateScheduleDate = scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`) : null;
  const hasScheduleConflict = candidateScheduleDate ? hasSchedulingConflict(scheduledSessions, candidateScheduleDate, scheduleDuration) : false;

  const handleScheduleSession = async () => {
    if (!user || !scheduleMatch) {
      setScheduleError('Please select a valid match to schedule a session.');
      return;
    }

    const validationError = getScheduleValidationError({
      user,
      scheduleMatch,
      scheduleDate,
      scheduleTime,
      areAllPreSessionAnswersComplete,
      meetingMode,
      scheduleLink: '',
      isTeamsLinkValid: () => false,
    });

    if (validationError) {
      setScheduleError(validationError);
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setScheduleError('Please choose a valid date and time');
      return;
    }
    if (scheduledAt <= new Date()) {
      setScheduleError('Meeting date and time must be in the future');
      return;
    }
    if (hasSchedulingConflict(scheduledSessions, scheduledAt, scheduleDuration)) {
      setScheduleError('This time overlaps another scheduled session. Please choose a different slot.');
      return;
    }

    if (!areAllPreSessionAnswersComplete) {
      setScheduleError('Please answer all pre-session questions before scheduling.');
      return;
    }

    if (preSessionAnswers.topicAgreed !== 'yes') {
      setScheduleError('Please agree on the session topic before scheduling.');
      return;
    }

    if (preSessionAnswers.availabilityConfirmed !== 'yes') {
      setScheduleError('Please confirm availability at the selected date and time.');
      return;
    }

    if (preSessionAnswers.guidelineAgreement !== 'yes') {
      setScheduleError('You need to agree to attend on time and follow EduSwap guidelines.');
      return;
    }

    const other = getOtherUser(scheduleMatch);
    const skill = scheduleRole === 'teach' ? getTeachSkill(scheduleMatch) : getLearnSkill(scheduleMatch);
    const teacherId = scheduleRole === 'teach' ? user.uid : other.uid;
    const learnerId = scheduleRole === 'teach' ? other.uid : user.uid;
    const teacherName = scheduleRole === 'teach' ? user.displayName : other.displayName;
    const learnerName = scheduleRole === 'teach' ? other.displayName : user.displayName;

    setScheduleSending(true);
    setScheduleError('');
    try {
      if (!isWithinAvailability(scheduledAt, user) || !isWithinAvailability(scheduledAt, other)) {
        throw new Error('This time is outside the weekly availability listed by one of you.');
      }
      const otherSessions = await getSessions(other.uid);
      if (hasSchedulingConflict(otherSessions, scheduledAt, scheduleDuration)) {
        throw new Error('This time overlaps one of your partner\'s existing sessions. Please choose another slot.');
      }
      const roomId = await getOrCreateChatRoom(
        user.uid,
        user.displayName,
        other.uid,
        other.displayName,
        scheduleMatch.id
      );
      const meetingLink = `${window.location.origin}/video-call?chatRoomId=${encodeURIComponent(roomId)}`;

      await createSession({
        matchId: scheduleMatch.id,
        teacherId,
        learnerId,
        teacherName,
        learnerName,
        skill,
        scheduledAt,
        durationMinutes: scheduleDuration,
        status: 'scheduled',
        creditsExchanged: 10,
        notes: [
          `Topic agreed: ${preSessionAnswers.topicAgreed === 'yes' ? 'Yes' : 'No'}`,
          `Available at selected time: ${preSessionAnswers.availabilityConfirmed === 'yes' ? 'Yes' : 'No'}`,
          `Materials ready: ${preSessionAnswers.materialsReady === 'yes' ? 'Yes' : 'No'}`,
          `Reminder requested: ${preSessionAnswers.reminderRequested === 'yes' ? 'Yes' : 'No'}`,
          `Guidelines accepted: ${preSessionAnswers.guidelineAgreement === 'yes' ? 'Yes' : 'No'}`,
          scheduleNotes.trim() ? `Additional notes: ${scheduleNotes.trim()}` : '',
        ].filter(Boolean).join('\n'),
        meetingLink,
      });
      setScheduleSuccess('Session scheduled successfully!');
    } catch (err) {
      console.error('Failed to create session:', err);
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule. Please try again.');
    } finally {
      setScheduleSending(false);
    }
  };

  if (loading) {
    return (
      <div className="matches-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (loadError) {
    return <div className="matches-page" role="alert"><div className="empty-matches"><h2>Matches unavailable</h2><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div></div>;
  }

  return (
    <div className="matches-page">
      <div className="matches-hero animate-fade-in-up">
        <div className="page-header">
          <span className="matches-eyebrow"><Users size={14} /> Skill exchange network</span>
          <h1>Your Matches</h1>
          <p>Connect with students, exchange knowledge, and schedule your next learning session.</p>
        </div>
        <div className="matches-summary" aria-label="Match summary">
          <div><strong>{counts.accepted}</strong><span>Active partners</span></div>
          <div><strong>{counts.pending}</strong><span>Awaiting review</span></div>
        </div>
      </div>

      <div className="match-tabs animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {(['pending', 'accepted', 'declined'] as const).map(tab => (
          <button
            key={tab}
            className={`match-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            id={`tab-${tab}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="tab-count">{counts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="matches-toolbar animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <label className="matches-search" htmlFor="matches-search-input">
          <Search size={18} />
          <input
            id="matches-search-input"
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search people, universities, or skills"
          />
        </label>
        <button
          type="button"
          className={`online-filter ${onlineOnly ? 'active' : ''}`}
          onClick={() => setOnlineOnly(value => !value)}
          aria-pressed={onlineOnly}
        >
          <Wifi size={16} /> Online now
        </button>
      </div>

      <div className="matches-list stagger-children">
        {filteredMatches.length === 0 ? (
          <div className="empty-matches">
            <div className="empty-matches-icon"><UserRound size={28} /></div>
            <h2>{searchQuery || onlineOnly ? 'No matches found' : `No ${activeTab} matches yet`}</h2>
            <p>{searchQuery || onlineOnly ? 'Try changing your search or online filter.' : 'Explore students with complementary skills to grow your network.'}</p>
            {(searchQuery || onlineOnly) ? (
              <button type="button" onClick={() => { setSearchQuery(''); setOnlineOnly(false); }}>Clear filters</button>
            ) : (
              <button type="button" onClick={() => navigate('/explore')}>Explore students</button>
            )}
          </div>
        ) : (
          filteredMatches.map(match => {
            const other = getOtherUser(match);
            return (
              <article key={match.id} className="match-card-full" id={`match-card-${match.id}`}>
                <div className="match-card-left">
                  <div className="match-avatar-full">
                    {other.photoUrl ? (
                      <img src={other.photoUrl} alt={other.displayName} />
                    ) : (
                      <span>{getInitials(other.displayName)}</span>
                    )}
                    {other.isOnline && <div className="online-dot-match" />}
                  </div>
                  <div className="match-details">
                    <div className="match-name-row">
                      <h3>{other.displayName}{other.studentVerified && <VerifiedBadge size={16} />}</h3>
                      {other.isOnline && <span className="online-label">Online</span>}
                    </div>
                    <span className="match-uni">{other.university}</span>
                    <div className="match-rating-row">
                      <Star size={14} />
                      <span>{other.rating}</span>
                      <span className="dot-sep">·</span>
                      <span>{other.totalSessions} sessions</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="view-profile-btn"
                  onClick={() => navigate(`/tutor/${other.uid}`)}
                  aria-label={`View ${other.displayName}'s profile`}
                >
                  View profile
                </button>

                <div className="match-exchange">
                  <div className="exchange-item">
                    <span className="exchange-dir">You teach</span>
                    <span className="exchange-skill teach">{getTeachSkill(match)}</span>
                  </div>
                  <ArrowLeftRight size={18} className="exchange-arrow" />
                  <div className="exchange-item">
                    <span className="exchange-dir">You learn</span>
                    <span className="exchange-skill learn">{getLearnSkill(match)}</span>
                  </div>
                </div>

                {match.status === 'pending' && match.user1Id === user?.uid && (
                  <div className="match-actions">
                    <div className="match-status-badge">Request sent</div>
                    <button className="match-decline" onClick={() => handleDecline(match.id)} id={`withdraw-${match.id}`}>
                      <X size={18} /> Withdraw
                    </button>
                  </div>
                )}

                {match.status === 'pending' && match.user1Id !== user?.uid && (
                  <div className="match-actions">
                    <button className="match-accept" onClick={() => handleAccept(match.id)} id={`accept-${match.id}`}>
                      <Check size={18} /> Accept
                    </button>
                    <button className="match-decline" onClick={() => handleDecline(match.id)} id={`decline-${match.id}`}>
                      <X size={18} /> Decline
                    </button>
                  </div>
                )}

                {match.status === 'accepted' && (
                  <div className="match-accepted-actions">
                    <div className="match-status-badge accepted">Active</div>
                    <button className="schedule-btn" onClick={() => getScheduledSessionForMatch(match.id) ? navigate('/sessions') : openScheduleModal(match)} id={`schedule-${match.id}`}>
                      <CalendarPlus size={16} /> {getScheduledSessionForMatch(match.id) ? 'View Session' : 'Schedule Session'}
                    </button>
                    <button
                      className="message-btn"
                      onClick={async () => {
                        if (!user) return;
                        const other = getOtherUser(match);
                        const roomId = await getOrCreateChatRoom(
                          user.uid, user.displayName,
                          other.uid, other.displayName,
                          match.id
                        );
                        navigate('/chat', { state: { selectedRoomId: roomId } });
                      }}
                      id={`message-${match.id}`}
                    >
                      <MessageCircle size={16} /> Message
                    </button>
                  </div>
                )}

                {match.status === 'declined' && (
                  <div className="match-status-badge declined">Declined</div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Schedule Session Modal */}
      {scheduleMatch && (
        <div className="modal-overlay" onClick={closeScheduleModal}>
          <div className="schedule-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeScheduleModal}><X size={18} /></button>

            <div className="modal-header">
              <CalendarPlus size={28} className="schedule-icon" />
              <h3>Schedule a Session</h3>
              <p className="modal-subtitle">with {getOtherUser(scheduleMatch).displayName}</p>
            </div>

            {scheduleSuccess ? (
              <div className="schedule-success-panel">
                <div className="schedule-success-msg">
                  <Check size={20} /> {scheduleSuccess}
                </div>
                <div className="schedule-success-actions">
                  <button type="button" className="schedule-done-btn" onClick={() => { closeScheduleModal(); navigate('/sessions'); }} id="btn-schedule-view-sessions">
                    View Scheduled Sessions
                  </button>
                  <button type="button" className="schedule-close-btn" onClick={closeScheduleModal} id="btn-schedule-close">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleScheduleSession(); }}>
                <div className="schedule-field">
                  <label>Scheduling assistant</label>
                  <div className="slot-options">
                    {suggestedSlots.map(slot => (
                      <button
                        key={slot.iso}
                        type="button"
                        className={`slot-btn ${selectedSlotIso === slot.iso ? 'active' : ''}`}
                        onClick={() => {
                          setScheduleDate(slot.date);
                          setScheduleTime(slot.time);
                          setSelectedSlotIso(slot.iso);
                        }}
                      >
                        <Clock size={12} /> {slot.label}
                      </button>
                    ))}
                  </div>
                  <p className="schedule-note">Pick a suggested time or set your own date and time below.</p>
                </div>

                {/* Role selection */}
                <div className="schedule-field">
                  <label>Your role in this session</label>
                  <div className="role-toggle">
                    <button
                      type="button"
                      className={`role-option ${scheduleRole === 'teach' ? 'active teach' : ''}`}
                      onClick={() => setScheduleRole('teach')}
                    >
                      Teaching: {getTeachSkill(scheduleMatch)}
                    </button>
                    <button
                      type="button"
                      className={`role-option ${scheduleRole === 'learn' ? 'active learn' : ''}`}
                      onClick={() => setScheduleRole('learn')}
                    >
                      Learning: {getLearnSkill(scheduleMatch)}
                    </button>
                  </div>
                </div>

                <div className="schedule-field">
                  <label>Meeting mode</label>
                  <div className="meeting-mode-toggle">
                    <button
                      type="button"
                      className="meeting-mode-option active"
                      onClick={() => {
                        setMeetingMode('eduswap');
                        setScheduleError('');
                      }}
                    >
                      <Video size={14} /> In-app video call
                    </button>
                  </div>
                </div>

                <div className="schedule-row">
                  <div className="schedule-field">
                    <label htmlFor="sched-date">Date</label>
                    <input
                      type="date"
                      id="sched-date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="schedule-input"
                    />
                  </div>
                  <div className="schedule-field">
                    <label htmlFor="sched-time">Time</label>
                    <input
                      type="time"
                      id="sched-time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="schedule-input"
                    />
                  </div>
                </div>

                <div className={`schedule-timezone ${hasScheduleConflict ? 'conflict' : ''}`}>
                  <Globe2 size={14} />
                  <span>{candidateScheduleDate ? `Times shown in ${formatTimeZoneLabel(candidateScheduleDate)}` : `Times use your local time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}</span>
                  {hasScheduleConflict && <strong>Conflicts with another session</strong>}
                </div>

                <div className="schedule-field">
                  <label>Duration</label>
                  <div className="duration-options">
                    {[30, 45, 60, 90].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`duration-btn ${scheduleDuration === d ? 'active' : ''}`}
                        onClick={() => setScheduleDuration(d)}
                      >
                        <Clock size={12} /> {d} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="schedule-field">
                  <label>Meeting link</label>
                  <div className="schedule-auto-link-note">
                    A secure EduSwap video-call link will be generated automatically when you schedule.
                  </div>
                </div>

                <div className="schedule-field">
                  <label>Pre-session questions (required)</label>
                  <div className="pre-session-questions">
                    <div className="pre-session-question-row">
                      <p>1. Have you agreed on the topic for this session?</p>
                      <div className="binary-choice-buttons">
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.topicAgreed === 'yes' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('topicAgreed', 'yes')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.topicAgreed === 'no' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('topicAgreed', 'no')}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="pre-session-question-row">
                      <p>2. Are you available at the selected date and time?</p>
                      <div className="binary-choice-buttons">
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.availabilityConfirmed === 'yes' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('availabilityConfirmed', 'yes')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.availabilityConfirmed === 'no' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('availabilityConfirmed', 'no')}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="pre-session-question-row">
                      <p>3. Are your learning/teaching materials ready?</p>
                      <div className="binary-choice-buttons">
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.materialsReady === 'yes' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('materialsReady', 'yes')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.materialsReady === 'no' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('materialsReady', 'no')}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="pre-session-question-row">
                      <p>4. Would you like to receive a reminder before the session?</p>
                      <div className="binary-choice-buttons">
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.reminderRequested === 'yes' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('reminderRequested', 'yes')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.reminderRequested === 'no' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('reminderRequested', 'no')}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="pre-session-question-row">
                      <p>5. Do you agree to attend on time and follow the EduSwap guidelines?</p>
                      <div className="binary-choice-buttons">
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.guidelineAgreement === 'yes' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('guidelineAgreement', 'yes')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`duration-btn ${preSessionAnswers.guidelineAgreement === 'no' ? 'active' : ''}`}
                          onClick={() => setPreSessionAnswer('guidelineAgreement', 'no')}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="schedule-field">
                  <label htmlFor="sched-notes">Notes (optional)</label>
                  <textarea
                    id="sched-notes"
                    value={scheduleNotes}
                    onChange={e => setScheduleNotes(e.target.value)}
                    placeholder="Topics to cover, preparation needed..."
                    rows={2}
                    className="schedule-textarea"
                  />
                </div>

                {scheduleError && <div className="schedule-error">{scheduleError}</div>}

                <p className="schedule-help-text">
                  Choose a smart time slot and schedule. The in-app video call link will be generated automatically.
                </p>

                <button
                  type="submit"
                  className="schedule-submit-btn"
                  disabled={scheduleSending || !isScheduleButtonEnabled || hasScheduleConflict}
                  id="btn-schedule-submit"
                >
                  {scheduleSending ? (
                    <Loader2 size={16} className="spinner" />
                  ) : (
                    <><CalendarPlus size={16} /> Schedule Session</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
