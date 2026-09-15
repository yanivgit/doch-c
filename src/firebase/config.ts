import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCdcJThdnN_n5zP1puPjuObmjzqbtRs890",
  authDomain: "happy-hour-hunter-yaniv.firebaseapp.com",
  projectId: "happy-hour-hunter-yaniv",
  storageBucket: "happy-hour-hunter-yaniv.firebasestorage.app",
  messagingSenderId: "29116296955",
  appId: "1:29116296955:web:71213c83c2bd339ed5ca5e"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

let auth: any;
try {
  auth = getAuth(app);
} catch (e) {
  console.log('Auth already initialized or error:', e);
}

export { app, db, auth };
