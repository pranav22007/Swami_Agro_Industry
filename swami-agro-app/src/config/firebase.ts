import { initializeApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCT5NG_2V8IR-yVeaoUe_hsIV0uLbCiCqI",
  authDomain: "swami-agro-new.firebaseapp.com",
  projectId: "swami-agro-new",
  storageBucket: "swami-agro-new.firebasestorage.app",
  messagingSenderId: "84859388344",
  appId: "1:84859388344:web:7e3027b98c71f8fdc10f4d",
  measurementId: "G-7ZP08V1XQP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);

export default app;
