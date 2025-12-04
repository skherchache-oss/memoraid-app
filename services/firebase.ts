import { 
  initializeApp 
} from "firebase/app";

import { 
  getAuth, 
  GoogleAuthProvider 
} from "firebase/auth";

import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";


const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD4jX5s0emTJ4l5FOAijd0Nl2MT7ubcLTI",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "memoraid-7cd9d.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "memoraid-7cd9d",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "memoraid-7cd9d.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "424814765916",
  appId: process.env.FIREBASE_APP_ID || "1:424814765916:web:aaba185d4dbab2af52c399"
};


let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

try {
  if (firebaseConfig.apiKey.includes("REMPLACER")) {
    console.warn("⚠️ Clés Firebase manquantes.");
  } else {

    // 🔥 Initialise Firebase
    app = initializeApp(firebaseConfig);

    // 🔐 Authentification
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    // 🗄️ Firestore avec persistance hors ligne
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  }
} catch (error) {
  console.warn("Firebase initialization failed:", error);
}

export { auth, db, googleProvider };
