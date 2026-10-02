import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './UnverifiedBanner.css';

const DISMISS_KEY = 'eduswap-unverified-banner-dismissed';

function readDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/** Tells a signed-in student that their account is not verified yet, on every page. */
export function UnverifiedBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  // Hidden on call screens, where a banner would cover the video.
  const onCallScreen = location.pathname === '/video-call' || location.pathname === '/group-call';
  if (!user || user.studentVerified || user.isAdmin || dismissed || onCallScreen) return null;

  const status = user.registrationVerificationStatus;
  const message = status === 'pending'
    ? 'Your account is not verified yet. Your proof of registration is waiting for admin review.'
    : status === 'rejected'
      ? 'Your account is not verified. Your registration document was not approved; please upload a clear, current one.'
      : 'Your account is not verified. Verify with your university email or upload proof of registration to accept tutor bookings.';

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* per-visit convenience only */ }
  };

  return (
    <div className={`unverified-banner ${status === 'rejected' ? 'rejected' : ''}`} role="status">
      <ShieldAlert size={18} aria-hidden="true" />
      <p>{message}</p>
      {status !== 'pending' && location.pathname !== '/profile' && (
        <Link to="/profile#student-verification" className="unverified-banner-action">Verify now</Link>
      )}
      <button type="button" onClick={dismiss} aria-label="Hide this message for now"><X size={16} /></button>
    </div>
  );
}
