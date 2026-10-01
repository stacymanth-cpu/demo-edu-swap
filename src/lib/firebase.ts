import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCYJIoM4Inu2NqXx6l7tHIihNIuQf_Wxzw",
  authDomain: "eduswap-5e9ed.firebaseapp.com",
  projectId: "eduswap-5e9ed",
  storageBucket: "eduswap-5e9ed.firebasestorage.app",
  messagingSenderId: "913071574289",
  appId: "1:913071574289:web:d45de38222566f360e50b0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to enable persistent auth:', error);
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
export default app;

