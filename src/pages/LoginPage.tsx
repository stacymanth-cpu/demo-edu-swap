import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../lib/validation';
import logoImg from '../assets/logo.png';
import './AuthPages.css';

export function LoginPage() {
  const { login, isLoading, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Password reset state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    // clear field errors
    setEmailError('');
    setPasswordError('');

    const cleanEmail = email.trim();
    const cleanPassword = password;

    let hasError = false;
    if (!cleanEmail) {
      setEmailError('Please enter your email');
      hasError = true;
    } else if (!validateEmail(cleanEmail)) {
      setEmailError('Invalid email address');
      hasError = true;
    }
    if (!cleanPassword) {
      setPasswordError('Please enter your password');
      hasError = true;
    } else if (/\s/.test(cleanPassword)) {
      setPasswordError('Password cannot contain spaces');
      hasError = true;
    }
    if (hasError) return;
    const errorMsg = await login(cleanEmail, cleanPassword);
    if (errorMsg) {
      setError(errorMsg);
    } else {
      navigate('/');
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    const cleanResetEmail = resetEmail.trim();
    if (!cleanResetEmail) {
      setResetError('Please enter your email address');
      return;
    }
    if (!validateEmail(cleanResetEmail)) {
      setResetError('Invalid email address');
      return;
    }
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setResetError('No account found with this email.');
      } else if (code === 'auth/invalid-email') {
        setResetError('Invalid email address.');
      } else {
        setResetError('Failed to send reset email. Try again.');
      }
    } finally {
      setResetSending(false);
    }
  };

  const openReset = () => {
    setShowReset(true);
    setResetEmail(email); // pre-fill with login email
    setResetSuccess(false);
    setResetError('');
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

        {!showReset ? (
          <form className="auth-form" onSubmit={handleSubmit} id="login-form">
            <h2>Welcome back</h2>
            <p className="auth-subtitle">Sign in to continue learning</p>

            {error && <div className="auth-error">{error}</div>}
            {sessionExpired && (
              <div className="auth-error" style={{ marginBottom: 16 }}>
                Your saved session has expired. Please sign in again.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="you@university.ac.za"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                className={emailError ? 'input-error' : ''}
                autoComplete="email"
              />
              {emailError && <div className="field-error">{emailError}</div>}
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                <button type="button" className="forgot-link" onClick={openReset} id="btn-forgot">
                  Forgot password?
                </button>
              </div>
              <div className="input-with-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }}
                  className={passwordError ? 'input-error' : ''}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={isLoading} id="btn-login">
              {isLoading ? (
                <Loader2 size={20} className="spinner" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <p className="auth-switch">
              Don't have an account? <Link to="/signup">Create one</Link>
            </p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleResetPassword} id="reset-form">
            <button type="button" className="back-to-login" onClick={() => setShowReset(false)}>
              <ArrowLeft size={16} /> Back to login
            </button>

            <h2>Reset Password</h2>
            <p className="auth-subtitle">We'll send a reset link to your email</p>

            {resetSuccess ? (
              <div className="reset-success">
                <Mail size={24} />
                <h3>Check your email</h3>
                <p>We sent a password reset link to <strong>{resetEmail}</strong>. Check your inbox and follow the instructions.</p>
                <button type="button" className="auth-submit" onClick={() => setShowReset(false)}>
                  <ArrowLeft size={18} /> Back to Login
                </button>
              </div>
            ) : (
              <>
                {resetError && <div className="auth-error">{resetError}</div>}

                <div className="form-group">
                  <label htmlFor="reset-email">Email address</label>
                  <input
                    type="email"
                    id="reset-email"
                    placeholder="you@university.ac.za"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <button type="submit" className="auth-submit" disabled={resetSending} id="btn-send-reset">
                  {resetSending ? (
                    <Loader2 size={20} className="spinner" />
                  ) : (
                    <>
                      Send Reset Link
                      <Mail size={18} />
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
