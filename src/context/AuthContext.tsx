import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUser, createUser, subscribeUser, updateUser as fsUpdateUser } from '../lib/firestoreService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  authReady: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (details: { firstName: string; lastName: string; studentNumber: string; email: string; mobileNumber?: string; password: string; university: string; skillsTeach: string[]; skillsLearn: string[] }) => Promise<string | null>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_KEY = 'eduswap_session_expires_at';
const SESSION_EXPIRED_KEY = 'eduswap_session_expired';

function setSessionExpiry() {
  localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS));
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(() => localStorage.getItem(SESSION_EXPIRED_KEY) === 'true');

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

        const profile = await getUser(firebaseUser.uid);
        if (profile) {
          setUser(profile);
          await updatePresence(firebaseUser.uid, { isOnline: true });
        } else {
          setUser({
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
          });
          await updatePresence(firebaseUser.uid, { isOnline: true });
        }
        setSessionExpired(false);
        localStorage.removeItem(SESSION_EXPIRED_KEY);
      } else {
        setUser(null);
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

  // Returns null on success, or an error message string on failure
  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setSessionExpiry();
      const profile = await getUser(cred.user.uid);
      if (profile) {
        if (profile.accountStatus === 'suspended' || profile.accountStatus === 'deactivated') {
          await signOut(auth);
          setIsLoading(false);
          return 'This account is currently unavailable. Please contact EduSwap support.';
        }
        setUser(profile);
        await updatePresence(cred.user.uid, { isOnline: true });
      }
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

  // Returns null on success, or an error message string on failure
  const signup = useCallback(async (details: { firstName: string; lastName: string; studentNumber: string; email: string; mobileNumber?: string; password: string; university: string; skillsTeach: string[]; skillsLearn: string[] }): Promise<string | null> => {
    setIsLoading(true);
    try {
      const name = `${details.firstName} ${details.lastName}`.trim();
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
    <AuthContext.Provider value={{ user, isLoading, authReady, sessionExpired, login, signup, logout, updateProfile }}>
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
