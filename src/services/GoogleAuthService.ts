// GoogleAuthService.ts
// Handles Google Sign-In / Sign-Up via Firebase popup (with redirect fallback)

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../config/firebase';

export interface GoogleUserResult {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  isNewUser: boolean;
}

export interface GoogleAuthResult {
  success: boolean;
  user?: GoogleUserResult;
  message: string;
}

const googleProvider = new GoogleAuthProvider();
// Always prompt account selection even if already signed in
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const googleAuthService = {
  /**
   * Opens a Google sign-in popup.
   * - If the user is new, creates a Firestore profile with role = 'student'.
   * - If the user already exists, updates their lastLoginAt.
   * Returns the Google user info on success.
   */
  signInWithGoogle: async (): Promise<GoogleAuthResult> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const uid = firebaseUser.uid;
      const name = firebaseUser.displayName || 'Google User';
      const email = firebaseUser.email || '';
      const photoURL = firebaseUser.photoURL || '';

      // Check if profile already exists in Firestore
      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const userSnap = await getDoc(userRef);
      const isNewUser = !userSnap.exists();

      if (isNewUser) {
        // Create student profile
        await setDoc(userRef, {
          uid,
          email,
          displayName: name,
          photoURL,
          role: 'student',
          provider: 'google',
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      } else {
        // Update last login timestamp
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
      }

      // Sign back out of Firebase Auth — the legacy AuthContext
      // manages its own session via localStorage. Keeping Firebase
      // signed in as well would cause a conflict on page reload.
      await signOut(auth);

      return {
        success: true,
        message: isNewUser ? 'Account created successfully!' : 'Logged in successfully!',
        user: { uid, name, email, photoURL, isNewUser },
      };
    } catch (error: any) {
      console.error('Google Sign-In error:', error);

      // User dismissed the popup — not a real error, just silence it
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        return { success: false, message: '' };
      }

      // Popup blocked or unauthorized domain — try redirect flow instead
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/unauthorized-domain'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          // Page will redirect; result handled by handleRedirectResult on reload
          return { success: false, message: '' };
        } catch (redirectError: any) {
          console.error('Redirect fallback failed:', redirectError);
        }
      }

      let message = 'Google Sign-In failed. Please try again.';
      if (error.code === 'auth/popup-blocked') {
        message = 'Popup was blocked. Redirecting to Google sign-in...';
      } else if (error.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorised for Google Sign-In. Please contact the admin.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/internal-error') {
        message = 'Internal error. Please try again.';
      }

      return { success: false, message };
    }
  },

  /**
   * Call once on app load to capture the result of a signInWithRedirect flow.
   * Returns a GoogleAuthResult (success=true) if a redirect just completed,
   * otherwise returns { success: false, message: '' }.
   */
  handleRedirectResult: async (): Promise<GoogleAuthResult> => {
    try {
      const result = await getRedirectResult(auth);
      if (!result) return { success: false, message: '' };

      const firebaseUser = result.user;
      const uid = firebaseUser.uid;
      const name = firebaseUser.displayName || 'Google User';
      const email = firebaseUser.email || '';
      const photoURL = firebaseUser.photoURL || '';

      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const userSnap = await getDoc(userRef);
      const isNewUser = !userSnap.exists();

      if (isNewUser) {
        await setDoc(userRef, {
          uid, email, displayName: name, photoURL,
          role: 'student', provider: 'google',
          createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
      }

      await signOut(auth);

      return {
        success: true,
        message: isNewUser ? 'Account created successfully!' : 'Logged in successfully!',
        user: { uid, name, email, photoURL, isNewUser },
      };
    } catch (error: any) {
      console.error('Redirect result error:', error);
      return { success: false, message: '' };
    }
  },
};

