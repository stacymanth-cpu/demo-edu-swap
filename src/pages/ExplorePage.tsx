import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Users as UsersIcon, Star, UserPlus, X, ArrowLeftRight, ArrowRight, Check, Loader2, Sparkles, Bookmark, EyeOff, Flag } from 'lucide-react';
import { getSkillsCatalog, getAllUsers, getMatches, createMatch, submitReport } from '../lib/firestoreService';
import { getSkillIcon } from '../lib/iconMap';
import { getAiRecommendations, getCompatibleLearnSkills, getCompatibleTeachSkills, getMatchScore, userMatchesSearch } from '../lib/matchUtils';
import { useAuth } from '../context/AuthContext';
import { getSkillDescription } from '../lib/skillDescriptions';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import type { AiMatchRecommendation, SkillCategory, SkillInfo, User } from '../types';
import './ExplorePage.css';

export function ExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tourStep, setTourStep] = useState(searchParams.get('welcome') === '1' ? 0 : -1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | SkillCategory>('All');
  const [showUsers, setShowUsers] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | User['availability']>('all');
  const [minimumRating, setMinimumRating] = useState('0');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [universityFilter, setUniversityFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [skillLevelFilter, setSkillLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'match' | 'rating' | 'availability'>('match');
  const [savedOnly, setSavedOnly] = useState(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState('');
  const [skillsCatalog, setSkillsCatalog] = useState<SkillInfo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AiMatchRecommendation[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Match request state
  const [matchTarget, setMatchTarget] = useState<User | null>(null);
  const [selectedTeach, setSelectedTeach] = useState('');
  const [selectedLearn, setSelectedLearn] = useState('');
  const [matchSending, setMatchSending] = useState(false);
  const [matchSuccess, setMatchSuccess] = useState('');
  const [matchError, setMatchError] = useState('');
  const [existingMatchUserIds, setExistingMatchUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const uid = user?.uid;
    if (uid) setHiddenUserIds(user?.hiddenUserIds || []);
  }, [user?.uid, user?.hiddenUserIds]);

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    setLoading(true);
    Promise.all([getSkillsCatalog(), getAllUsers(), getMatches(user.uid)])
      .then(([skills, allUsers, matches]) => {
        setSkillsCatalog(skills);
        setUsers(allUsers);
        // Track users with existing matches (pending or accepted)
        const matchedIds = new Set<string>();
        matches.forEach(m => {
          if (m.status !== 'declined') {
            const otherId = m.user1Id === user.uid ? m.user2Id : m.user1Id;
            matchedIds.add(otherId);
          }
        });
        setExistingMatchUserIds(matchedIds);
        if (user) {
          setAiRecommendations(getAiRecommendations(user, allUsers));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load explore data:', err);
        setLoadError('We could not load students and skills. Check your connection and try again.');
        setLoading(false);
      });
  }, [user]);

  const filteredSkills = skillsCatalog.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const matchesUserFilters = (u: User) => {
    if (u.uid === user?.uid) return false;
    if (u.accountStatus === 'deactivated' || u.accountStatus === 'suspended') return false;
    if (user?.blockedUserIds?.includes(u.uid) || u.blockedUserIds?.includes(user?.uid || '')) return false;
    if (hiddenUserIds.includes(u.uid)) return false;
    if (u.skillsTeach.length > 0 && u.studentVerified !== true) return false;
    if (availabilityFilter !== 'all' && u.availability !== availabilityFilter) return false;
    if (Number(minimumRating) > 0 && u.rating < Number(minimumRating)) return false;
    if (onlineOnly && !u.isOnline) return false;
    if (universityFilter !== 'all' && u.university !== universityFilter) return false;
    if (languageFilter !== 'all' && !u.languages?.some(language => language.toLowerCase() === languageFilter.toLowerCase())) return false;
    if (skillLevelFilter !== 'all' && !user?.skillsLearn.some(skill => u.skillsTeach.some(teaching => teaching.toLowerCase() === skill.toLowerCase() && u.skillLevels?.[teaching] === skillLevelFilter))) return false;
    if (savedOnly && !user?.savedUserIds?.includes(u.uid)) return false;
    return userMatchesSearch(u, searchQuery);
  };

  const sortUsers = (first: User, second: User) => {
    if (sortBy === 'rating') return second.rating - first.rating || second.totalSessions - first.totalSessions;
    if (sortBy === 'availability') return Number(second.availability === 'available') - Number(first.availability === 'available') || Number(second.isOnline) - Number(first.isOnline);
    return getMatchScore(user!, second) - getMatchScore(user!, first) || second.rating - first.rating;
  };

  const filteredUsers = users.filter(matchesUserFilters).sort(sortUsers);
  const visibleRecommendations = aiRecommendations.filter(recommendation => matchesUserFilters(recommendation.user)).slice(0, 3);
  const universities = Array.from(new Set(users.map(candidate => candidate.university).filter(Boolean))).sort();
  const languages = Array.from(new Set(users.flatMap(candidate => candidate.languages || []))).sort();

  const categories: ('All' | SkillCategory)[] = [
    'All',
    ...Array.from(new Set(skillsCatalog.map(skill => skill.category))).sort(),
  ];

  const applySearch = (targetUsers = false) => {
    setSearchQuery(searchInput.trim());
    if (targetUsers) {
      setShowUsers(true);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const getSkillCardDescription = (skill: SkillInfo) => {
    return getSkillDescription(skill.name, skill.category, skill.description);
  };

  const openSkillDetails = (skill: SkillInfo) => {
    setSelectedSkill(skill);
  };

  const closeSkillDetails = () => {
    setSelectedSkill(null);
  };

  const getTeachOptions = (target: User) => {
    if (!user) return [];
    return getCompatibleTeachSkills(user.skillsTeach, target.skillsLearn);
  };

  const getLearnOptions = (target: User) => {
    if (!user) return [];
    return getCompatibleLearnSkills(user.skillsLearn, target.skillsTeach);
  };

  const canRequestMatch = (target: User) => {
    return getTeachOptions(target).length > 0 && getLearnOptions(target).length > 0;
  };

  const openMatchModal = (target: User) => {
    if (!canRequestMatch(target)) {
      setMatchTarget(null);
      setMatchError('No compatible skill exchange exists for this match.');
      return;
    }
    setMatchTarget(target);
    const teachOptions = getTeachOptions(target);
    const learnOptions = getLearnOptions(target);
    setSelectedTeach(teachOptions[0] || '');
    setSelectedLearn(learnOptions[0] || '');
    setMatchError('');
    setMatchSuccess('');
  };

  const closeMatchModal = () => {
    setMatchTarget(null);
    setMatchError('');
    setMatchSuccess('');
  };

  const closeTour = () => {
    setTourStep(-1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('welcome');
    setSearchParams(nextParams, { replace: true });
  };

  const skillDialogRef = useDialogAccessibility(Boolean(selectedSkill), closeSkillDetails);
  const matchDialogRef = useDialogAccessibility(Boolean(matchTarget), closeMatchModal);
  const tourDialogRef = useDialogAccessibility(tourStep >= 0, closeTour);

  const sendMatchRequest = async () => {
    if (!user || !matchTarget || !selectedTeach || !selectedLearn) {
      setMatchError('Please select both skills');
      return;
    }
    setMatchSending(true);
    setMatchError('');
    try {
      await createMatch({
        user1Id: user.uid,
        user2Id: matchTarget.uid,
        user1Teaches: selectedTeach,
        user2Teaches: selectedLearn,
        status: 'pending',
        createdAt: new Date(),
      });
      setExistingMatchUserIds(prev => new Set([...prev, matchTarget.uid]));
      setMatchSuccess(`Match request sent to ${matchTarget.displayName}!`);
      setTimeout(() => closeMatchModal(), 1500);
    } catch (err) {
      console.error('Failed to create match:', err);
      setMatchError('Failed to send request. Please try again.');
    } finally {
      setMatchSending(false);
    }
  };

  const toggleSavedUser = async (targetId: string) => {
    if (!user) return;
    const savedUserIds = user.savedUserIds || [];
    try {
      await updateProfile({ savedUserIds: savedUserIds.includes(targetId) ? savedUserIds.filter(id => id !== targetId) : [...savedUserIds, targetId] });
    } catch {
      setActionNotice('Unable to update saved profiles. Please try again.');
    }
  };

  const hideUser = async (targetId: string) => {
    if (!user) return;
    const hidden = hiddenUserIds.includes(targetId) ? hiddenUserIds : [...hiddenUserIds, targetId];
    try {
      await updateProfile({ hiddenUserIds: hidden });
      setHiddenUserIds(hidden);
    } catch {
      setActionNotice('Unable to hide this profile. Please try again.');
    }
  };

  const reportUser = async (target: User) => {
    if (!user) return;
    const reason = window.prompt(`Why are you reporting ${target.displayName}?`)?.trim();
    if (!reason) return;
    try {
      await submitReport({ reporterId: user.uid, targetUserId: target.uid, type: 'user', reason, details: reason });
      setActionNotice(`Report submitted for ${target.displayName}.`);
    } catch {
      setActionNotice('Unable to submit the report. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="explore-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 32, height: 32, border: '3px solid rgba(79, 70, 229, 0.2)', borderTopColor: 'var(--primary-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (loadError) {
    return <div className="explore-page" role="alert"><div className="empty-explore"><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div></div>;
  }

  return (
    <div className="explore-page">
      <div className="explore-header animate-fade-in-up">
        <h1>Explore Skills</h1>
        <p>Discover skills and find your perfect learning partner</p>
      </div>

      <div className="explore-search animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="search-actions">
          <button
            className="view-toggle"
            onClick={() => applySearch(true)}
            id="btn-search-users"
          >
            <Search size={16} /> Search Users
          </button>
          <button
            className={`view-toggle ${!showUsers ? 'active' : ''}`}
            onClick={() => setShowUsers(false)}
            id="btn-view-skills"
          >
            <Filter size={16} /> Skills
          </button>
          <button
            className={`view-toggle ${showUsers ? 'active' : ''}`}
            onClick={() => setShowUsers(true)}
            id="btn-view-users"
          >
            <UsersIcon size={16} /> Users
          </button>
        </div>
      </div>

      {showUsers && (
        <div className="user-filters animate-fade-in-up" aria-label="User filters">
          <label>
            Availability
            <select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value as 'all' | User['availability'])}>
              <option value="all">Any availability</option>
              <option value="available">Available</option>
              <option value="teaching">Teaching</option>
              <option value="pending">Pending</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <label>
            Minimum rating
            <select value={minimumRating} onChange={event => setMinimumRating(event.target.value)}>
              <option value="0">Any rating</option>
              <option value="3">3.0+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <label>
            University
            <select value={universityFilter} onChange={event => setUniversityFilter(event.target.value)}>
              <option value="all">Any university</option>
              {universities.map(university => <option key={university} value={university}>{university}</option>)}
            </select>
          </label>
          <label>
            Language
            <select value={languageFilter} onChange={event => setLanguageFilter(event.target.value)}>
              <option value="all">Any language</option>
              {languages.map(language => <option key={language} value={language}>{language}</option>)}
            </select>
          </label>
          <label>
            Tutor level
            <select value={skillLevelFilter} onChange={event => setSkillLevelFilter(event.target.value)}>
              <option value="all">Any level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </label>
          <label>
            Sort by
            <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}>
              <option value="match">Best match</option>
              <option value="rating">Rating</option>
              <option value="availability">Availability</option>
            </select>
          </label>
          <label className="online-filter">
            <input type="checkbox" checked={onlineOnly} onChange={event => setOnlineOnly(event.target.checked)} />
            Online now
          </label>
          <label className="online-filter">
            <input type="checkbox" checked={savedOnly} onChange={event => setSavedOnly(event.target.checked)} />
            Saved profiles
          </label>
        </div>
      )}

      {actionNotice && <p className="explore-action-notice" role="status">{actionNotice}<button type="button" onClick={() => setActionNotice('')} aria-label="Dismiss notice"><X size={14} /></button></p>}

      {!showUsers && (
        <>
          <div className="category-tabs animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="skills-grid stagger-children">
            {filteredSkills.map(skill => (
              <button
                key={skill.name}
                type="button"
                className="skill-card"
                id={`skill-${skill.name.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => openSkillDetails(skill)}
              >
                <div className="skill-card-icon">{getSkillIcon(skill.icon)}</div>
                <h3>{skill.name}</h3>
                <span className="skill-category-tag">{skill.category}</span>
                <div className="skill-card-footer">
                  <UsersIcon size={14} />
                  <span>{skill.userCount} learners</span>
                </div>
              </button>
            ))}
          </div>

          {filteredSkills.length === 0 && (
            <div className="empty-explore">
              <p>No skills found matching "{searchQuery}"</p>
            </div>
          )}
        </>
      )}

      {selectedSkill && (
        <div className="modal-overlay" onClick={closeSkillDetails}>
          <div ref={skillDialogRef} className="skill-detail-modal" role="dialog" aria-modal="true" aria-labelledby="skill-dialog-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close skill details" onClick={closeSkillDetails}><X size={18} /></button>
            <div className="modal-header">
              <div className="modal-avatar">{getSkillIcon(selectedSkill.icon)}</div>
              <h3 id="skill-dialog-title">{selectedSkill.name}</h3>
              <p className="modal-subtitle">{selectedSkill.category}</p>
            </div>
            <p className="skill-detail-description">{getSkillCardDescription(selectedSkill)}</p>
            <div className="skill-detail-users">
              <h4>People interested in this skill</h4>
              {users.filter(u => {
                const normalized = selectedSkill.name.trim().toLowerCase();
                return u.uid !== user?.uid && (
                  u.skillsTeach.some(skill => skill.trim().toLowerCase() === normalized) ||
                  u.skillsLearn.some(skill => skill.trim().toLowerCase() === normalized)
                );
              }).length === 0 ? (
                <p className="no-options">No users have listed this skill yet.</p>
              ) : users.filter(u => {
                const normalized = selectedSkill.name.trim().toLowerCase();
                return u.uid !== user?.uid && (
                  u.skillsTeach.some(skill => skill.trim().toLowerCase() === normalized) ||
                  u.skillsLearn.some(skill => skill.trim().toLowerCase() === normalized)
                );
              }).map(u => (
                <button key={u.uid} type="button" className="skill-detail-user" onClick={() => navigate(`/tutor/${u.uid}`)}>
                  <div>
                    <strong>{u.displayName}</strong>
                    <p>{u.skillsTeach.some(skill => skill.trim().toLowerCase() === selectedSkill.name.trim().toLowerCase()) ? 'Teaches this skill' : 'Wants to learn this skill'}</p>
                  </div>
                  <span className="skill-detail-user-role">View</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUsers && visibleRecommendations.length > 0 && (
        <div className="ai-recommendations-panel animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="ai-panel-header">
            <div className="ai-panel-icon"><Sparkles size={18} /></div>
            <div>
              <h2>Smart Match Recommendations</h2>
              <p>Reciprocal matches ranked by skills, availability, experience, and trust signals.</p>
            </div>
          </div>
          <div className="ai-recommendation-list">
            {visibleRecommendations.map(rec => {
              const compatible = canRequestMatch(rec.user);
              return (
                <div key={rec.user.uid} className="ai-recommendation-card">
                  <div className="ai-rec-avatar">{rec.user.photoUrl ? <img src={rec.user.photoUrl} alt={rec.user.displayName} /> : getInitials(rec.user.displayName)}</div>
                  <div className="ai-rec-body">
                    <div className="ai-rec-title"><h3>{rec.user.displayName}</h3><span className="compatibility-score"><strong>{rec.score}%</strong> match</span></div>
                    <span>{rec.user.university}</span>
                    <p>{rec.summary}</p>
                    <div className="ai-rec-reasons">{rec.reasons.map(reason => <span key={reason}><Check size={11} /> {reason}</span>)}</div>
                  </div>
                  <button
                    className={`ai-rec-action ${!compatible ? 'disabled' : ''}`}
                    onClick={() => compatible && openMatchModal(rec.user)}
                    disabled={!compatible}
                  >
                    {compatible ? 'Request match' : 'Unavailable'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUsers && (
        <div className="users-grid stagger-children">
          {filteredUsers.map(u => {
            const hasMatch = existingMatchUserIds.has(u.uid);

            return (
              <div key={u.uid} className="user-card-explore" id={`user-${u.uid}`}>
                <div className="user-card-top">
                  <div className="user-avatar-lg">
                    {u.photoUrl ? (
                      <img src={u.photoUrl} alt={u.displayName} />
                    ) : (
                      <span>{getInitials(u.displayName)}</span>
                    )}
                    {u.isOnline && <div className="online-dot-lg" />}
                  </div>
                  <h3>{u.displayName}</h3>
                  <span className="user-uni">{u.university}</span>
                  <div className="user-stats-row">
                    <span className="user-stat"><Star size={14} /> {u.rating}</span>
                    <span className="user-stat">{u.totalSessions} sessions</span>
                  </div>
                </div>
                <div className="user-card-skills">
                  <div className="skills-section">
                    <span className="skills-label">Teaches</span>
                    <div className="skills-list">
                      {u.skillsTeach.map(s => <span key={s} className="skill-tag teach">{s}</span>)}
                    </div>
                  </div>
                  <div className="skills-section">
                    <span className="skills-label">Learning</span>
                    <div className="skills-list">
                      {u.skillsLearn.map(s => <span key={s} className="skill-tag learn">{s}</span>)}
                    </div>
                  </div>
                </div>
                <p className="user-bio">{u.bio}</p>
                {canRequestMatch(u) && <p className="user-match-explanation"><strong>You teach:</strong> {getTeachOptions(u).join(', ')} <span>·</span> <strong>They teach:</strong> {getLearnOptions(u).join(', ')}</p>}

                {/* Match request button */}
                <div className="user-card-action">
                  <div className="profile-quick-actions">
                    <button type="button" aria-label={user?.savedUserIds?.includes(u.uid) ? `Remove ${u.displayName} from saved profiles` : `Save ${u.displayName}`} title={user?.savedUserIds?.includes(u.uid) ? 'Remove saved profile' : 'Save profile'} onClick={() => void toggleSavedUser(u.uid)}><Bookmark size={15} fill={user?.savedUserIds?.includes(u.uid) ? 'currentColor' : 'none'} /></button>
                    <button type="button" aria-label={`Hide ${u.displayName}`} title="Hide profile" onClick={() => void hideUser(u.uid)}><EyeOff size={15} /></button>
                    <button type="button" aria-label={`Report ${u.displayName}`} title="Report profile" onClick={() => void reportUser(u)}><Flag size={15} /></button>
                  </div>
                  <div className="user-card-actions">
                  <button className="view-profile-btn" onClick={() => navigate(`/tutor/${u.uid}`)}>
                    View Profile
                  </button>
                  {hasMatch ? (
                    <button className="match-requested-btn" disabled>
                      <Check size={14} /> Match Requested
                    </button>
                  ) : canRequestMatch(u) ? (
                    <button className="request-match-btn" onClick={() => openMatchModal(u)} id={`btn-match-${u.uid}`}>
                      <UserPlus size={14} /> Request Match
                    </button>
                  ) : (
                    <button className="request-match-btn disabled" disabled>
                      <UserPlus size={14} /> No Compatible Match
                    </button>
                  )}
                </div>
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="empty-explore">
              <p>{searchQuery ? `No users found matching "${searchQuery}"` : 'No verified students are available yet.'}</p>
              {!searchQuery && <button type="button" onClick={() => setShowUsers(false)}>Browse skills</button>}
            </div>
          )}
        </div>
      )}

      {/* Match Request Modal */}
      {matchTarget && (
        <div className="modal-overlay" onClick={closeMatchModal}>
          <div ref={matchDialogRef} className="match-modal" role="dialog" aria-modal="true" aria-labelledby="match-dialog-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close match request" onClick={closeMatchModal}><X size={18} /></button>

            <div className="modal-header">
              <div className="modal-avatar">
                {matchTarget.photoUrl ? (
                  <img src={matchTarget.photoUrl} alt={matchTarget.displayName} />
                ) : (
                  <span>{getInitials(matchTarget.displayName)}</span>
                )}
              </div>
              <h3 id="match-dialog-title">Request Match with {matchTarget.displayName}</h3>
              <p className="modal-subtitle">Select skills to exchange</p>
            </div>

            {matchSuccess ? (
              <div className="match-success-msg">
                <Check size={20} /> {matchSuccess}
              </div>
            ) : (
              <>
                <div className="match-exchange-form">
                  <div className="exchange-column">
                    <label>You teach</label>
                    <div className="exchange-options">
                      {getTeachOptions(matchTarget).length === 0 ? (
                        <p className="no-options">You don't teach any skills they want to learn</p>
                      ) : (
                        getTeachOptions(matchTarget).map(s => (
                          <button
                            key={s}
                            className={`exchange-option ${selectedTeach === s ? 'selected' : ''}`}
                            onClick={() => setSelectedTeach(s)}
                          >
                            {s}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="exchange-divider">
                    <ArrowLeftRight size={20} />
                  </div>

                  <div className="exchange-column">
                    <label>They teach you</label>
                    <div className="exchange-options">
                      {getLearnOptions(matchTarget).length === 0 ? (
                        <p className="no-options">They don't teach any skills you want to learn</p>
                      ) : (
                        getLearnOptions(matchTarget).map(s => (
                          <button
                            key={s}
                            className={`exchange-option learn ${selectedLearn === s ? 'selected' : ''}`}
                            onClick={() => setSelectedLearn(s)}
                          >
                            {s}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {matchError && <div className="match-modal-error">{matchError}</div>}

                <button
                  className="send-match-btn"
                  onClick={sendMatchRequest}
                  disabled={!selectedTeach || !selectedLearn || matchSending}
                  id="btn-send-match"
                >
                  {matchSending ? (
                    <Loader2 size={16} className="spinner" />
                  ) : (
                    <><UserPlus size={16} /> Send Match Request</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tourStep >= 0 && (
        <div className="modal-overlay onboarding-tour-overlay">
          <div ref={tourDialogRef} className="onboarding-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1}>
            <button className="modal-close" aria-label="Skip walkthrough" onClick={closeTour}><X size={18} /></button>
            <span className="tour-kicker">First match walkthrough · {tourStep + 1} of 3</span>
            <div className="tour-icon">{tourStep === 0 ? <Search /> : tourStep === 1 ? <Sparkles /> : <UserPlus />}</div>
            <h2 id="tour-title">{tourStep === 0 ? 'Discover a learning partner' : tourStep === 1 ? 'Check your compatibility' : 'Send your first request'}</h2>
            <p>{tourStep === 0 ? 'Open Users to see members whose teaching and learning goals complement yours.' : tourStep === 1 ? 'Match scores explain shared skills, availability, experience, and trust signals.' : 'Choose what each person will teach, then send the request. You can agree on a time after they accept.'}</p>
            <div className="tour-dots" aria-hidden="true">{[0, 1, 2].map(item => <span key={item} className={item === tourStep ? 'active' : ''} />)}</div>
            <div className="tour-actions">
              <button type="button" className="tour-skip" onClick={closeTour}>Skip</button>
              <button type="button" className="tour-next" onClick={() => { if (tourStep < 2) setTourStep(tourStep + 1); else { setShowUsers(true); closeTour(); } }}>{tourStep < 2 ? 'Next' : 'Find my match'} <ArrowRight size={17} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
