import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword as firebaseSignInEmail, 
  signOut as firebaseSignOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";

const isMockAuth = import.meta.env.VITE_MOCK_AUTH === "true";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy",
};

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  getIdToken: () => Promise<string>;
  role: string;
}

class MockAuthManager {
  private listeners: ((user: AppUser | null) => void)[] = [];
  private current: AppUser | null = null;

  constructor() {
    const saved = localStorage.getItem("mock_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.current = {
          ...parsed,
          getIdToken: async () => parsed.token
        };
      } catch {
        this.current = null;
      }
    }
  }

  get currentUser() {
    return this.current;
  }

  onAuthStateChanged(callback: (user: AppUser | null) => void) {
    this.listeners.push(callback);
    callback(this.current);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithEmailAndPassword(email: string, role: string = "admin") {
    // Return custom mock uid suffix that will be parsed by app/auth.py
    const uid = `mock_${role}_uid_${Math.random().toString(36).substring(7)}`;
    const user = {
      uid,
      email,
      displayName: `Mock ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      token: uid,
      role
    };
    
    this.current = {
      ...user,
      getIdToken: async () => user.token
    };
    
    localStorage.setItem("mock_user", JSON.stringify(user));
    this.notify();
    return { user: this.current };
  }

  async signInWithGoogle(role: string = "admin") {
    return this.signInWithEmailAndPassword("google_mock@example.com", role);
  }

  async signOut() {
    this.current = null;
    localStorage.removeItem("mock_user");
    this.notify();
  }

  async signUpWithEmailAndPassword(email: string, password: string, role: string = "admin") {
    return this.signInWithEmailAndPassword(email, role);
  }

  async sendPasswordResetEmail(email: string) {
    return;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}

// Instantiate Auth
let authInstance: any;
if (isMockAuth) {
  authInstance = new MockAuthManager();
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const rawAuth = getAuth(app);
    
    // Adapt raw Firebase auth to match our AppUser interface
    authInstance = {
      get currentUser() {
        const u = rawAuth.currentUser;
        if (!u) return null;
        return {
          uid: u.uid,
          email: u.email || "",
          displayName: u.displayName,
          getIdToken: async () => await u.getIdToken(),
          role: "annotator" // Role will be loaded from DB on first API request
        };
      },
      onAuthStateChanged(callback: (user: AppUser | null) => void) {
        return rawAuth.onAuthStateChanged(async (u) => {
          if (!u) {
            callback(null);
          } else {
            callback({
              uid: u.uid,
              email: u.email || "",
              displayName: u.displayName,
              getIdToken: async () => await u.getIdToken(),
              role: "annotator"
            });
          }
        });
      },
      async signInWithEmailAndPassword(email: string, password: string = "password") {
        const cred = await firebaseSignInEmail(rawAuth, email, password);
        return {
          user: {
            uid: cred.user.uid,
            email: cred.user.email || "",
            displayName: cred.user.displayName,
            getIdToken: async () => await cred.user.getIdToken(),
            role: "annotator"
          }
        };
      },
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(rawAuth, provider);
        return {
          user: {
            uid: cred.user.uid,
            email: cred.user.email || "",
            displayName: cred.user.displayName,
            getIdToken: async () => await cred.user.getIdToken(),
            role: "annotator"
          }
        };
      },
      async signUpWithEmailAndPassword(email: string, password: string) {
        const cred = await createUserWithEmailAndPassword(rawAuth, email, password);
        return {
          user: {
            uid: cred.user.uid,
            email: cred.user.email || "",
            displayName: cred.user.displayName,
            getIdToken: async () => await cred.user.getIdToken(),
            role: "annotator"
          }
        };
      },
      async sendPasswordResetEmail(email: string) {
        await sendPasswordResetEmail(rawAuth, email);
      },
      async signOut() {
        await firebaseSignOut(rawAuth);
      }
    };
  } catch (e) {
    console.error("Firebase failed to initialize, falling back to mock auth.", e);
    authInstance = new MockAuthManager();
  }
}

export const auth = authInstance;
export const isMock = isMockAuth;
export const googleProvider = new GoogleAuthProvider();
