import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUser, createUser, subscribeUser, updateUser as fsUpdateUser, DEFAULT_VERIFIED_EMAIL_DOMAINS, getVerifiedEmailDomains, isUniversityEmail, sendUniversityVerificationEmail, tryAutoVerifyStudent } from '../lib/firestoreService';
import type { User } from '../types';
import { rememberEmail } from '../lib/rememberedLogin';
import { isLoginVerified, sendLoginPin, trustNewAccount, verifyLoginPin } from '../lib/loginPin';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  authReady: boolean;
  sessionExpired: boolean;
  /** Email the login PIN was sent to while the sign-in waits for it; null otherwise. */
  pinEmail: string | null;
  /** remember: stay signed in for 30 days and prefill the email next time (default), or 8 hours. */
  login: (email: string, password: string, remember?: boolean) => Promise<string | null>;
  /** Emails the login PIN (resend: a new PIN even if one was sent). Returns an error message or null. */
  sendPin: (resend?: boolean) => Promise<string | null>;
  /** Checks the login PIN and finishes signing in. Returns an error message or null. */
  verifyPin: (pin: string) => Promise<string | null>;
  signup: (details: { firstName: string; lastName: string; studentNumber: string; email: string; mobileNumber?: string; password: string; university: string; skillsTeach: string[]; skillsLearn: string[] }) => Promise<string | null>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

// "Remember me" keeps a student signed in on their own device for 30 days; without it the
// session ends after 8 hours, which suits shared or lab computers.
const SHORT_SESSION_MS = 8 * 60 * 60 * 1000;
const REMEMBERED_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_KEY = 'eduswap_session_expires_at';
const SESSION_EXPIRED_KEY = 'eduswap_session_expired';

function setSessionExpiry(remember = true) {
  localStorage.setItem(SESSION_KEY, String(Date.now() + (remember ? REMEMBERED_SESSION_MS : SHORT_SESSION_MS)));
  localStorage.removeItem(SESSION_EXPIRED_KEY);
}

function clearSessionExpiry() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_EXPIRED_KEY);
}

async function updatePresence(uid: string, updates: Partial<User>) {
  try {
    await fsUpdateUser(uid, updates);
  } catch (error) {
    console.warn('Could not update online presence:', error);
  }
}

/**
 * Loads the signed-in student's profile (or a placeholder before it exists) and marks them online.
 * Sign-up passes markOnline false: the profile it is still saving is created online, and until
 * the save reaches the server the presence update would fail with "User profile not found".
 */
async function loadSignedInUser(firebaseUser: FirebaseUser, markOnline = true): Promise<User> {
  const profile = await getUser(firebaseUser.uid);
  if (profile && markOnline) await updatePresence(firebaseUser.uid, { isOnline: true });
  return profile || {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || '',
    email: firebaseUser.email || '',
    photoUrl: firebaseUser.photoURL || '',
    university: '',
    bio: '',
    skillsTeach: [],
    skillsLearn: [],
    credits: 50,
    rating: 0,
    totalSessions: 0,
    joinedAt: new Date(),
    isOnline: true,
    lastSeen: null,
  };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(() => localStorage.getItem(SESSION_EXPIRED_KEY) === 'true');
  const [pinEmail, setPinEmail] = useState<string | null>(null);
  // Creating an account signs in straight away; that sign-in is not asked for a PIN.
  const signingUpRef = useRef(false);

  // Listen for auth state changes (persists login across refreshes)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const expiresAt = Number(localStorage.getItem(SESSION_KEY) || '0');

      if (firebaseUser) {
        if (expiresAt && Date.now() > expiresAt) {
          localStorage.setItem(SESSION_EXPIRED_KEY, 'true');
          setSessionExpired(true);
          await signOut(auth);
          clearSessionExpiry();
          setUser(null);
          setAuthReady(true);
          return;
        }

        // Every sign-in must pass the emailed PIN before the app opens.
        if (!signingUpRef.current && !(await isLoginVerified(firebaseUser).catch(() => false))) {
          setUser(null);
          setPinEmail(firebaseUser.email || '');
          setAuthReady(true);
          return;
        }

        setPinEmail(null);
        setUser(await loadSignedInUser(firebaseUser, !signingUpRef.current));
        setSessionExpired(false);
        localStorage.removeItem(SESSION_EXPIRED_KEY);
      } else {
        setUser(null);
        setPinEmail(null);
        if (localStorage.getItem(SESSION_EXPIRED_KEY) === 'true') {
          setSessionExpired(true);
        }
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Reflect admin-driven changes, such as registration approval or rejection,
  // in the active session without requiring a refresh or another login.
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeUser(user.uid, updatedUser => {
      if (updatedUser) setUser(updatedUser);
    });
  }, [user?.uid]);

  // Students who have confirmed a university email are verified without admin review.
  // The new status arrives through the profile subscription above.
  // Runs on sign-in, on page load (including returning from the email link's "Continue"), and
  // whenever the student comes back to the tab after confirming the email elsewhere.
  useEffect(() => {
    if (!user?.uid || user.studentVerified) return;
    let lastAttempt = 0;
    const attempt = () => {
      if (Date.now() - lastAttempt < 10_000) return;
      lastAttempt = Date.now();
      tryAutoVerifyStudent(false).catch(error => console.warn('Automatic student verification skipped:', error));
    };
    const onReturn = () => { if (document.visibilityState === 'visible') attempt(); };
    attempt();
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [user?.uid, user?.studentVerified]);

  // Returns null on success, or an error message string on failure
  const login = useCallback(async (email: string, password: string, remember = true): Promise<string | null> => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setSessionExpiry(remember);
      rememberEmail(email, remember);
      const profile = await getUser(cred.user.uid);
      if (profile) {
        if (profile.accountStatus === 'suspended' || profile.accountStatus === 'deactivated') {
          await signOut(auth);
          setIsLoading(false);
          return 'This account is currently unavailable. Please contact EduSwap support.';
        }
      }
      // The app opens once the emailed PIN is entered (see verifyPin).
      setPinEmail(cred.user.email || email);
      setSessionExpired(false);
      localStorage.removeItem(SESSION_EXPIRED_KEY);
      setIsLoading(false);
      return null; // success
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = getAuthErrorMessage(err);
      setIsLoading(false);
      return msg; // error message
    }
  }, []);

  const sendPin = useCallback(async (resend = false): Promise<string | null> => {
    if (!auth.currentUser) return 'Please sign in again.';
    try {
      await sendLoginPin(auth.currentUser, resend);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<string | null> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return 'Please sign in again.';
    try {
      await verifyLoginPin(firebaseUser, pin);
      setUser(await loadSignedInUser(firebaseUser));
      setPinEmail(null);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }, []);

  // Returns null on success, or an error message string on failure
  const signup = useCallback(async (details: { firstName: string; lastName: string; studentNumber: string; email: string; mobileNumber?: string; password: string; university: string; skillsTeach: string[]; skillsLearn: string[] }): Promise<string | null> => {
    setIsLoading(true);
    signingUpRef.current = true;
    try {
      const name = `${details.firstName} ${details.lastName}`.trim();
      // Check before creating the sign-in account; the rules refuse the profile anyway.
      const universityDomains = await getVerifiedEmailDomains().catch(() => DEFAULT_VERIFIED_EMAIL_DOMAINS);
      if (!isUniversityEmail(details.email, universityDomains)) {
        setIsLoading(false);
        return 'Wrong email. Use your university email address, not a personal email such as Gmail or Outlook.';
      }
      const cred = await createUserWithEmailAndPassword(auth, details.email, details.password);

      await fbUpdateProfile(cred.user, { displayName: name });

      const newUser: User = {
        uid: cred.user.uid,
        displayName: name,
        firstName: details.firstName,
        lastName: details.lastName,
        studentNumber: details.studentNumber,
        mobileNumber: details.mobileNumber || '',
        studentStatusConfirmed: true,
        termsAcceptedAt: new Date(),
        email: details.email,
        photoUrl: '',
        university: details.university,
        bio: '',
        skillsTeach: details.skillsTeach,
        skillsLearn: details.skillsLearn,
        credits: 50,
        rating: 0,
        totalSessions: 0,
        studentVerified: false,
        joinedAt: new Date(),
        isOnline: true,
        lastSeen: null,
      };
      await createUser(newUser);
      // Without this, refreshing the page right after sign-up would ask for a login PIN.
      trustNewAccount(cred.user).catch(error => console.warn('Could not record the new-account sign-in:', error));
      // A university email can verify the student instantly once they click the link.
      try {
        if (isUniversityEmail(details.email, await getVerifiedEmailDomains())) await sendUniversityVerificationEmail();
      } catch (verificationError) {
        console.warn('Could not send the verification email:', verificationError);
      }
      setSessionExpiry();
      setUser(newUser);
      setSessionExpired(false);
      localStorage.removeItem(SESSION_EXPIRED_KEY);
      setIsLoading(false);
      return null; // success
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const msg = getAuthErrorMessage(err);
      setIsLoading(false);
      return msg; // error message
    } finally {
      signingUpRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (user) {
      try {
        await fsUpdateUser(user.uid, { isOnline: false, lastSeen: new Date() });
      } catch {
        // Ignore
      }
    }
    clearSessionExpiry();
    await signOut(auth);
    setUser(null);
    setPinEmail(null);
    setSessionExpired(false);
  }, [user]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    try {
      await fsUpdateUser(user.uid, updates);
      setUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  }, [user]);

  useEffect(() => {
    const handleUnload = async () => {
      if (!user) return;
      try {
        await fsUpdateUser(user.uid, { isOnline: false, lastSeen: new Date() });
      } catch {
        // Ignore failures during unload
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, authReady, sessionExpired, pinEmail, login, sendPin, verifyPin, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

function getAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    default:
      return `Authentication failed (${code || 'unknown'}). Please try again.`;
  }
}
