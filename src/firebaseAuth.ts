import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');

export const getAccessToken = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        // Since we're using popup, we don't get the OAuth token again here easily,
        // unless we store it or ask for it.
        // But for Google APIs we need the *Google OAuth token*, not Firebase ID token.
        // If we didn't store it during signIn, we might need a different approach.
        // Let's assume we store it in localStorage or server side, but wait, 
        // the client needs it for fetch calls to googleapis.com.
        const token = localStorage.getItem('google_oauth_token');
        resolve(token);
      } else {
        resolve(null);
      }
    });
  });
};

export const googleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    // Send token to our server for Calendar Sync if needed
    if (token) {
        localStorage.setItem('google_oauth_token', token);
        await fetch('/api/set-google-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });
    }

    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
        localStorage.removeItem('google_oauth_token');
        await fetch('/api/clear-google-token', { method: 'POST' });
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
}

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };
