import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCYJIoM4Inu2NqXx6l7tHIihNIuQf_Wxzw",
  authDomain: "eduswap-5e9ed.firebaseapp.com",
  projectId: "eduswap-5e9ed",
  storageBucket: "eduswap-5e9ed.firebasestorage.app",
  messagingSenderId: "913071574289",
  appId: "1:913071574289:web:d45de38222566f360e50b0"
};

// The browser tests (npm run test:e2e) run against the local Firebase emulators. The
// demo- project id means nothing here can reach a real Firebase project.
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-eduswap' } : firebaseConfig);

export const auth = getAuth(app);
if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to enable persistent auth:', error);
});

export const db = getFirestore(app);
if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
export default app;
