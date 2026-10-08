import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.webp';
import './AuthPages.css';

/** Second sign-in step: the 6-digit PIN emailed by the server at every login. */
export function LoginPinPage() {
  const { pinEmail, sendPin, verifyPin, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(true);
  // True while no PIN has gone out, e.g. the PIN service is down; the page then offers a retry.
  const [sendFailed, setSendFailed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const requested = useRef(false);

  // Email the PIN when the screen opens; the server reuses a PIN it already sent for this sign-in.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    sendPin().then(sendError => {
      if (sendError) setError(sendError);
      setSendFailed(Boolean(sendError));
      setSending(false);
    });
  }, [sendPin]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter the 6-digit PIN from your email.');
      return;
    }
    setVerifying(true);
    const verifyError = await verifyPin(pin);
    setVerifying(false);
    if (verifyError) {
      setError(verifyError);
      setPin('');
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setSending(true);
    const sendError = await sendPin(true);
    setSending(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setNotice(sendFailed ? 'Your PIN is on its way.' : 'A new PIN is on its way. Only the newest PIN works.');
    setSendFailed(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="auth-orb orb-1" />
        <div className="auth-orb orb-2" />
        <div className="auth-orb orb-3" />
      </div>

      <div className="auth-container animate-scale-in">
        <div className="auth-brand">
          <div className="auth-logo">
            <img src={logoImg} alt="EduSwap" />
          </div>
          <h1>EduSwap</h1>
          <p className="auth-tagline">Exchange skills, grow together</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} id="pin-form">
          <button type="button" className="back-to-login" onClick={logout}>
            <ArrowLeft size={16} /> Use a different account
          </button>

          <h2>Check your email</h2>
          <p className="auth-subtitle">
            <Mail size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            {sending ? 'Sending a sign-in PIN to ' : sendFailed ? "We couldn't send a PIN to " : 'We sent a 6-digit PIN to '}
            <strong>{pinEmail}</strong>
          </p>

          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="pin-notice" role="status">{notice}</div>}

          <div className="form-group">
            <label htmlFor="login-pin">Sign-in PIN</label>
            <input
              id="login-pin"
              className="pin-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(''); }}
              autoFocus
            />
            <p className="remember-me-hint">The PIN expires after 10 minutes. Check your spam folder if it hasn't arrived.</p>
          </div>

          <button type="submit" className="auth-submit" disabled={verifying || pin.length !== 6} id="btn-verify-pin">
            {verifying ? <Loader2 size={20} className="spinner" /> : <>Verify and continue <ArrowRight size={18} /></>}
          </button>

          <p className="auth-switch">
            {sendFailed ? 'No PIN was sent.' : "Didn't get it?"}{' '}
            <button type="button" className="forgot-link" onClick={handleResend} disabled={sending} id="btn-resend-pin">
              <RefreshCw size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {sendFailed ? 'Try sending again' : 'Send a new PIN'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
