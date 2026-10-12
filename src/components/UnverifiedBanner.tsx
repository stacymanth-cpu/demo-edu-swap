import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './UnverifiedBanner.css';

const DISMISS_KEY = 'eduswap-unverified-banner-dismissed';

function readDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/**
 * Tells a signed-in student, on every page, that their account is not verified yet, or that
 * their profile was hidden from Explore after reports (automatic moderation).
 */
export function UnverifiedBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  // Hidden on call screens, where a banner would cover the video.
  const onCallScreen = location.pathname === '/video-call' || location.pathname === '/group-call';
  if (!user || user.isAdmin || dismissed || onCallScreen) return null;
  const hidden = user.hiddenFromDiscovery === true;
  if (!hidden && user.studentVerified) return null;

  const message = hidden
    ? 'Your profile is hidden from Explore because several students reported it. You can still use your matches, chats and sessions. If you think this is a mistake, contact EduSwap support.'
    : 'Please verify your account. Confirm your university email to appear in Explore and accept tutor bookings.';

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* per-visit convenience only */ }
  };

  return (
    <div className="unverified-banner" role="status">
      <ShieldAlert size={18} aria-hidden="true" />
      <p>{message}</p>
      {!hidden && location.pathname !== '/profile' && (
        <Link to="/profile#student-verification" className="unverified-banner-action">Verify my account</Link>
      )}
      <button type="button" onClick={dismiss} aria-label="Hide this message for now"><X size={16} /></button>
    </div>
  );
}
