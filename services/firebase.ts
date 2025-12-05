if (typeof window === "undefined") {
  throw new Error("❌ Firebase ne doit PAS être exécuté côté serveur.");
}


import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

//⚠️ IMPORTANT : utilisation de import.meta.env pour Vite + Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD4jX5s0emTJ4l5FOAijd0Nl2MT7ubcLTI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "memoraid-7cd9d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "memoraid-7cd9d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "memoraid-7cd9d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "424814765916",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:424814765916:web:aaba185d4dbab2af52c399",
};

let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

try {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("REMPLACER")) {
    console.warn("⚠️ Clés Firebase manquantes (VITE_FIREBASE_* non définies).");
  } else {
    // Initialisation Firebase
    app = initializeApp(firebaseConfig);

    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }
} catch (error) {
  console.warn("Firebase initialization failed:", error);
}

export { auth, db, googleProvider };
