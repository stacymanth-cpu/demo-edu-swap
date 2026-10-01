import { useState, useEffect } from 'react';
import { BookOpen, Users, TrendingUp, Coins, Calendar, ArrowRight, Star, Zap, Compass, MessageCircle, CalendarPlus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSessions, getSkillsCatalog, getAllUsers } from '../lib/firestoreService';
import { getSkillIcon } from '../lib/iconMap';
import { getAiRecommendations } from '../lib/matchUtils';
import { format } from 'date-fns';
import type { Session, SkillInfo, User } from '../types';
import { VerifiedBadge } from '../components/VerifiedBadge';
import './HomePage.css';

export function HomePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoadedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSessions(user.uid),
      getAllUsers(),
      getSkillsCatalog(),
    ]).then(([sess, users, skills]) => {
      setSessions(sess);
      setAllUsers(users);
      setSkillsCatalog(skills);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load home data:', err);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;

  const upcomingSessions = sessions
    .filter(s => s.status === 'scheduled' && s.scheduledAt.getTime() >= dashboardLoadedAt)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 3);

  const recommendedMatches = getAiRecommendations(user, allUsers).slice(0, 4);

  const trendingSkills = [...skillsCatalog]
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 8);

  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  if (loading) {
    return (
      <div className="route-loading" role="status">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-card" />
        <span className="sr-only">Loading your dashboard</span>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Hero / Welcome */}
      <section className="home-hero animate-fade-in-up">
        <div className="hero-content">
          <div className="hero-greeting">
            <span className="home-eyebrow"><Sparkles size={14} /> Your learning dashboard</span>
            <h1>Welcome back, {user.displayName.split(' ')[0]}</h1>
            <p>Keep your learning momentum going with your next skill exchange.</p>
            <div className="hero-actions">
              <Link to="/explore" className="hero-action-primary"><Compass size={17} /> Find a skill</Link>
              <Link to="/matches" className="hero-action-secondary">View matches <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="hero-quick-stats">
            <div className="quick-stat">
              <Coins size={18} />
              <span className="stat-value">{user.credits}</span>
              <span className="stat-label">Credits</span>
            </div>
            <div className="quick-stat">
              <Star size={18} />
              <span className="stat-value">{user.rating}</span>
              <span className="stat-label">Rating</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-quick-actions animate-fade-in-up" aria-label="Quick actions">
        <Link to="/explore"><span className="quick-action-icon"><Compass size={19} /></span><span><strong>Explore students</strong><small>Discover complementary skills</small></span><ArrowRight size={17} /></Link>
        <Link to="/matches"><span className="quick-action-icon"><Users size={19} /></span><span><strong>Manage matches</strong><small>Review and connect with partners</small></span><ArrowRight size={17} /></Link>
        <Link to="/sessions"><span className="quick-action-icon"><CalendarPlus size={19} /></span><span><strong>Plan a session</strong><small>View your learning schedule</small></span><ArrowRight size={17} /></Link>
        <Link to="/chat"><span className="quick-action-icon"><MessageCircle size={19} /></span><span><strong>Open messages</strong><small>Continue the conversation</small></span><ArrowRight size={17} /></Link>
      </section>

      {/* Stats Cards */}
      <section className="stats-grid stagger-children">
        <div className="stat-card" id="stat-sessions">
          <div className="stat-card-icon sessions-icon">
            <BookOpen size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{user.totalSessions}</span>
            <span className="stat-card-label">Total Sessions</span>
          </div>
        </div>
        <div className="stat-card" id="stat-matches">
          <div className="stat-card-icon matches-icon">
            <Users size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{recommendedMatches.length}</span>
            <span className="stat-card-label">Matches Available</span>
          </div>
        </div>
        <div className="stat-card" id="stat-completed">
          <div className="stat-card-icon completed-icon">
            <TrendingUp size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{completedSessions}</span>
            <span className="stat-card-label">Completed</span>
          </div>
        </div>
        <div className="stat-card" id="stat-skills">
          <div className="stat-card-icon skills-icon">
            <Zap size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{user.skillsTeach.length + user.skillsLearn.length}</span>
            <span className="stat-card-label">Skills Listed</span>
          </div>
        </div>
      </section>

      {/* Upcoming Sessions */}
      <section className="home-section animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="section-header">
          <h2><Calendar size={20} /> Upcoming Sessions</h2>
          <Link to="/sessions" className="section-link">View all <ArrowRight size={16} /></Link>
        </div>
        <div className="sessions-list">
          {upcomingSessions.length === 0 ? (
            <div className="empty-state-sm">
              <p>No upcoming sessions. <Link to="/matches">Find a match</Link> to get started!</p>
            </div>
          ) : (
            upcomingSessions.map(session => (
              <div key={session.id} className="session-card-home" id={`session-${session.id}`}>
                <div className="session-date-badge">
                  <span className="session-day">{format(session.scheduledAt, 'dd')}</span>
                  <span className="session-month">{format(session.scheduledAt, 'MMM')}</span>
                </div>
                <div className="session-info">
                  <h4>{session.skill}</h4>
                  <p>
                    {session.teacherId === user.uid
                      ? `Teaching ${session.learnerName}`
                      : `Learning from ${session.teacherName}`
                    }
                  </p>
                  <span className="session-time">{format(session.scheduledAt, 'h:mm a')} · {session.durationMinutes} min</span>
                </div>
                <div className={`session-role-badge ${session.teacherId === user.uid ? 'teaching' : 'learning'}`}>
                  {session.teacherId === user.uid ? 'Teaching' : 'Learning'}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recommended Matches */}
      <section className="home-section animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
        <div className="section-header">
          <h2><Users size={20} /> Recommended Matches</h2>
          <Link to="/explore" className="section-link">Explore all <ArrowRight size={16} /></Link>
        </div>
        <div className="matches-grid">
          {recommendedMatches.length === 0 ? (
            <div className="home-matches-empty">
              <Users size={24} />
              <div><strong>No recommendations yet</strong><span>Add skills to your profile to improve your matches.</span></div>
              <Link to="/profile">Update profile</Link>
            </div>
          ) : recommendedMatches.map(recommendation => {
            const match = recommendation.user;
            const teaches = match.skillsTeach.filter(s => user.skillsLearn.includes(s));
            const learns = match.skillsLearn.filter(s => user.skillsTeach.includes(s));
            return (
              <div key={match.uid} className="match-card-home" id={`match-${match.uid}`}>
                <div className="match-card-header">
                  <div className="match-avatar">
                    {match.photoUrl ? (
                      <img src={match.photoUrl} alt={match.displayName} />
                    ) : (
                      <span>{getInitials(match.displayName)}</span>
                    )}
                    {match.isOnline && <div className="online-indicator" />}
                  </div>
                  <div className="match-user-info">
                    <h4>{match.displayName}{match.studentVerified && <VerifiedBadge size={15} />}</h4>
                    <span>{match.university.split('University of ').pop() || match.university}</span>
                  </div>
                  <div className="match-rating">
                    <strong>{recommendation.score}%</strong>
                    <span>match</span>
                  </div>
                </div>
                <div className="match-skills">
                  {teaches.length > 0 && (
                    <div className="skill-exchange">
                      <span className="exchange-label">Can teach you</span>
                      <div className="skill-chips">
                        {teaches.map(s => <span key={s} className="skill-chip teach">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {learns.length > 0 && (
                    <div className="skill-exchange">
                      <span className="exchange-label">Wants to learn</span>
                      <div className="skill-chips">
                        {learns.map(s => <span key={s} className="skill-chip learn">{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="match-reasons" aria-label="Why this match">
                  {recommendation.reasons.map(reason => <span key={reason}><Sparkles size={11} /> {reason}</span>)}
                </div>
                <Link to={`/tutor/${match.uid}`} className="match-profile-link">View profile <ArrowRight size={14} /></Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trending Skills */}
      <section className="home-section animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
        <div className="section-header">
          <h2><TrendingUp size={20} /> Trending Skills</h2>
          <Link to="/explore" className="section-link">Browse all <ArrowRight size={16} /></Link>
        </div>
        <div className="trending-skills">
          {trendingSkills.map(skill => (
            <Link to="/explore" key={skill.name} className="trending-chip" id={`trending-${skill.name.toLowerCase().replace(/\s/g, '-')}`}>
              <span className="trending-icon">{getSkillIcon(skill.icon)}</span>
              <span className="trending-name">{skill.name}</span>
              <span className="trending-count">{skill.userCount} users</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
