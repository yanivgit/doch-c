import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { 
  getAuth, 
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
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

let db: any;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  db = getFirestore(app);
}

let auth: any;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
} catch (e) {
  auth = getAuth(app);
}

export { app, db, auth };
