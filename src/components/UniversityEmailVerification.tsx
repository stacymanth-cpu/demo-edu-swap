import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, MailCheck } from 'lucide-react';
import { getVerifiedEmailDomains, isUniversityEmail, sendUniversityVerificationEmail, tryAutoVerifyStudent } from '../lib/firestoreService';

/**
 * Instant verification for students whose sign-in email belongs to an approved university.
 * Others are told to upload proof of registration instead (shown below this card).
 */
export function UniversityEmailVerification({ email }: { email: string }) {
  const [domains, setDomains] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getVerifiedEmailDomains().then(setDomains).catch(() => setDomains([]));
  }, []);

  if (!domains) return null;
  if (!isUniversityEmail(email, domains)) {
    return (
      <p className="university-email-note">
        <MailCheck size={15} aria-hidden="true" /> Students who sign up with their university email ({domains.map(domain => `@${domain}`).join(', ')}) are verified instantly. Otherwise, upload proof of registration below.
      </p>
    );
  }

  const send = async () => {
    setBusy('send');
    setMessage(null);
    try {
      await sendUniversityVerificationEmail();
      setMessage({ type: 'info', text: `We sent a link to ${email}. Open it, then come back and press "I've confirmed my email".` });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setMessage({ type: 'error', text: code === 'auth/too-many-requests' ? 'A link was sent recently. Check your inbox (and spam folder), or try again in a few minutes.' : 'The verification email could not be sent. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy('check');
    setMessage(null);
    try {
      const result = await tryAutoVerifyStudent(false);
      if (result === 'email_not_confirmed') setMessage({ type: 'error', text: 'Your email is not confirmed yet. Open the link in the email first, then press this button again.' });
    } catch (error) {
      console.error('Automatic verification failed:', error);
      setMessage({ type: 'error', text: 'Verification could not be completed. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="university-email-card">
      <div className="university-email-head">
        <BadgeCheck size={20} aria-hidden="true" />
        <div>
          <strong>Instant verification</strong>
          <p>Confirm your university email <span>{email}</span> and you are verified straight away, with no document review.</p>
        </div>
      </div>
      <div className="university-email-actions">
        <button type="button" className="university-email-btn primary" onClick={() => void send()} disabled={busy !== null}>
          {busy === 'send' ? <Loader2 size={15} className="spinner" /> : <MailCheck size={15} />} Send verification link
        </button>
        <button type="button" className="university-email-btn" onClick={() => void check()} disabled={busy !== null}>
          {busy === 'check' ? <Loader2 size={15} className="spinner" /> : null} I've confirmed my email
        </button>
      </div>
      {message && <p className={`university-email-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
