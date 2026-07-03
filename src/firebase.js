import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDJhzTbbLbGXvNB0U1-uYPfU59IYbOOKEo",
  authDomain:        "queen-star.firebaseapp.com",
  projectId:         "queen-star",
  storageBucket:     "queen-star.firebasestorage.app",
  messagingSenderId: "127291008287",
  appId:             "1:127291008287:web:b72bed65534fe34b25fc2a",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
