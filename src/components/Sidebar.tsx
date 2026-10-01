import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, Users, MessageCircle, User, LogOut, Coins, Sparkles, Video, Bell, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToChatRooms, subscribeNotifications, markNotificationRead, subscribeSessions } from '../lib/firestoreService';
import type { Notification, Session } from '../types';
import logoImg from '../assets/logo.png';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/matches', icon: Users, label: 'Matches' },
  { to: '/sessions', icon: Sparkles, label: 'Sessions' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/video-call', icon: Video, label: 'Calls' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const mobilePrimaryItems = navItems.filter(item => ['Home', 'Explore', 'Matches', 'Chat'].includes(item.label));
const mobileMoreItems = navItems.filter(item => ['Sessions', 'Calls', 'Profile'].includes(item.label));

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [browserAlertsPermission, setBrowserAlertsPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'denied' : Notification.permission);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationFeedLoadedRef = useRef(false);
  const notificationFeedUserIdRef = useRef<string | null>(null);

  // Subscribe to real-time unread count from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToChatRooms(user.uid, (rooms) => {
      const total = rooms.reduce((sum, r) => sum + (r.unreadCount[user.uid] || 0), 0);
      setUnreadCount(total);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (notificationFeedUserIdRef.current !== user.uid) {
      notificationFeedUserIdRef.current = user.uid;
      seenNotificationIdsRef.current.clear();
      notificationFeedLoadedRef.current = false;
    }
    return subscribeNotifications(user.uid, incoming => {
      if (notificationFeedLoadedRef.current && document.visibilityState === 'hidden' && browserAlertsPermission === 'granted') {
        incoming.filter(notification => !notification.read && !seenNotificationIdsRef.current.has(notification.id)).forEach(notification => {
          const alert = new Notification(notification.title, { body: notification.body, tag: notification.id });
          alert.onclick = () => {
            window.focus();
            if (notification.link) navigate(notification.link);
          };
        });
      }
      notificationFeedLoadedRef.current = true;
      seenNotificationIdsRef.current = new Set(incoming.map(notification => notification.id));
      setNotifications(incoming);
    });
  }, [browserAlertsPermission, navigate, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeSessions(user.uid, sessions => setUpcomingSessions(sessions.filter(session => session.status === 'scheduled')));
  }, [user]);

  useEffect(() => {
    if (!user || typeof Notification === 'undefined') return;
    const checkReminders = () => {
      if (Notification.permission !== 'granted') return;
      const now = Date.now();
      upcomingSessions.forEach(session => {
        const timeUntilSession = session.scheduledAt.getTime() - now;
        const reminderKey = `eduswap-reminder-${session.id}`;
        if (timeUntilSession > 0 && timeUntilSession <= 60 * 60 * 1000 && !localStorage.getItem(reminderKey)) {
          const peerName = session.teacherId === user.uid ? session.learnerName : session.teacherName;
          new Notification('EduSwap session in less than an hour', { body: `${session.skill} with ${peerName}` });
          localStorage.setItem(reminderKey, 'sent');
        }
      });
    };
    checkReminders();
    const intervalId = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(intervalId);
  }, [upcomingSessions, user]);

  const unreadNotifications = notifications.filter(notification => !notification.read).length;

  const enableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') return;
    setBrowserAlertsPermission(await Notification.requestPermission());
  };

  // Hide sidebar on auth pages
  if (['/login', '/signup'].includes(location.pathname)) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <>
      <aside className="sidebar" id="sidebar-nav">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <img src={logoImg} alt="" />
            </div>
            <span className="logo-text">EduSwap</span>
          </div>
          <button
            className={`sidebar-bell ${showNotifications ? 'active' : ''}`}
            type="button"
            onClick={() => setShowNotifications(prev => !prev)}
            aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
            aria-expanded={showNotifications}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadNotifications > 0 && <span className="sidebar-bell-count">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.label === 'Chat' && unreadCount > 0 && (
                <span className="badge">{unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {showNotifications && (
          <div className="notification-panel">
            <div className="notification-panel-header"><strong>Notifications</strong><span>{unreadNotifications} unread</span><button type="button" onClick={() => setShowNotifications(false)} aria-label="Close notifications"><X size={16} /></button></div>
            {browserAlertsPermission === 'default' && <button type="button" className="notification-alert-toggle" onClick={() => void enableBrowserAlerts()}>Enable desktop alerts</button>}
            {browserAlertsPermission === 'denied' && <p className="notification-alert-note">Desktop alerts are blocked in browser settings.</p>}
            {notifications.length === 0 ? <p className="notification-empty">You are all caught up.</p> : notifications.slice(0, 6).map(notification => (
              <button
                className={`notification-item ${notification.read ? '' : 'unread'}`}
                key={notification.id}
                type="button"
                onClick={async () => {
                  if (!notification.read) {
                    await markNotificationRead(notification.id);
                    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
                  }
                  if (notification.link) navigate(notification.link);
                }}
              >
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </button>
            ))}
          </div>
        )}

        {user && (
          <div className="sidebar-footer">
            <div className="credit-display">
              <Coins size={16} />
              <span>Credits</span>
              <strong>{user.credits}</strong>
            </div>
            <div className="sidebar-user">
              <div className="user-avatar-sm">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.displayName} />
                ) : (
                  <span>{getInitials(user.displayName)}</span>
                )}
                <div className="online-dot" />
              </div>
              <div className="user-info-sm">
                <span className="user-name-sm">{user.displayName}</span>
                <span className="user-uni-sm" title={user.university}>{user.university}</span>
              </div>
              <button className="logout-btn" onClick={logout} title="Log out" aria-label="Log out" id="btn-logout">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav" id="mobile-bottom-nav">
        {mobilePrimaryItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            end={item.to === '/'}
            onClick={() => { setShowMobileMore(false); setShowMobileNotifications(false); setShowNotifications(false); }}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button className={`mobile-nav-link ${showMobileMore ? 'active' : ''}`} onClick={() => setShowMobileMore(open => !open)} aria-expanded={showMobileMore} aria-controls="mobile-more-menu">
          {showMobileMore ? <X size={21} /> : <Menu size={21} />}
          <span>More</span>
          {(unreadNotifications > 0 || unreadCount > 0) && <i className="mobile-alert-dot" />}
        </button>
      </nav>

      {showMobileMore && (
        <div className="mobile-more-backdrop" onClick={() => setShowMobileMore(false)}>
          <section className="mobile-more-sheet" id="mobile-more-menu" aria-label="More navigation" onClick={event => event.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <div className="mobile-more-user">
              <div className="user-avatar-sm">{user?.photoUrl ? <img src={user.photoUrl} alt={user.displayName} /> : <span>{getInitials(user?.displayName || 'User')}</span>}</div>
              <div><strong>{user?.displayName}</strong><span><Coins size={13} /> {user?.credits ?? 0} credits</span></div>
              <button type="button" onClick={() => setShowMobileMore(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <div className="mobile-more-grid">
              {mobileMoreItems.map(item => <NavLink key={item.to} to={item.to} onClick={() => { setShowMobileMore(false); setShowMobileNotifications(false); }} className={({ isActive }) => isActive ? 'active' : ''}><item.icon size={20} /><span>{item.label}</span></NavLink>)}
              <button type="button" onClick={() => setShowMobileNotifications(open => !open)} aria-expanded={showMobileNotifications}><Bell size={20} /><span>Notifications</span>{unreadNotifications > 0 && <b>{unreadNotifications}</b>}</button>
            </div>
            {showMobileNotifications && <div className="mobile-notifications">{browserAlertsPermission === 'default' && <button type="button" onClick={() => void enableBrowserAlerts()}><strong>Enable desktop alerts</strong><span>Get alerts when EduSwap is open in another tab.</span></button>}{notifications.length === 0 ? <p>You are all caught up.</p> : notifications.slice(0, 4).map(notification => <button key={notification.id} type="button" onClick={async () => { if (!notification.read) { await markNotificationRead(notification.id); setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item)); } if (notification.link) navigate(notification.link); }}><strong>{notification.title}</strong><span>{notification.body}</span></button>)}</div>}
            <button className="mobile-sheet-logout" onClick={logout} id="btn-mobile-logout"><LogOut size={18} /> Log out</button>
          </section>
        </div>
      )}
    </>
  );
}
