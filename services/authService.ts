import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  User as FirebaseUser
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { User } from '../types';

// Helper to map Firebase User to our App User
export const mapFirebaseUser = (fbUser: FirebaseUser): User => {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Anonymous',
    email: fbUser.email || undefined,
    emailVerified: fbUser.emailVerified,
    avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
    status: 'online'
  };
};

export const authService = {
  // Register a new user
  register: async (username: string, email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

      // Update display name and avatar immediately in Auth
      await updateProfile(userCredential.user, {
        displayName: username,
        photoURL: photoURL
      });

      const mappedUser = mapFirebaseUser(userCredential.user);
      mappedUser.name = username; 
      mappedUser.avatar = photoURL;

      // SAVE TO FIRESTORE DATABASE (Graceful Fallback)
      try {
        // Private data
        await setDoc(doc(db, "users", userCredential.user.uid), {
          id: mappedUser.id,
          name: mappedUser.name,
          email: mappedUser.email,
          avatar: mappedUser.avatar,
          status: 'online',
          createdAt: serverTimestamp(),
          searchKey: username.toLowerCase() 
        });
        // Public data
        await setDoc(doc(db, "profiles", userCredential.user.uid), {
          id: mappedUser.id,
          name: mappedUser.name,
          avatar: mappedUser.avatar,
          status: 'online',
          bio: ''
        });
      } catch (dbError) {
        console.warn("Firestore profile creation failed (API likely disabled). Continuing with Auth only.", dbError);
      }

      // Send Verification Email
      try {
        await sendEmailVerification(userCredential.user);
      } catch (emailError) {
        console.warn("Failed to send verification email", emailError);
      }

      return { 
        success: true, 
        message: 'Identity created. Verification signal sent to email.', 
        user: mappedUser
      };
    } catch (error: any) {
      let msg = "Registration failed.";
      if (error.code === 'auth/email-already-in-use') {
        msg = "Account already exists. Please log in.";
      } else if (error.code === 'auth/weak-password') {
        msg = "Password is too weak (min 6 chars).";
      } else {
        console.error("Registration Error:", error); 
        if (error.code === 'auth/operation-not-allowed') msg = "Email/Password login is NOT enabled in Firebase Console.";
      }
      return { success: false, message: msg };
    }
  },

  // Login existing user
  login: async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Ensure Firestore documents exist (Graceful Fallback)
      try {
        const [userDoc, profileDoc] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "profiles", user.uid))
        ]);

        const mappedUser = mapFirebaseUser(user);

        if (!userDoc.exists()) {
          // Private data
          await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            name: mappedUser.name,
            email: user.email,
            avatar: mappedUser.avatar,
            status: 'online',
            createdAt: serverTimestamp(),
            searchKey: mappedUser.name.toLowerCase()
          });
        }

        if (!profileDoc.exists()) {
          // Public data
          await setDoc(doc(db, "profiles", user.uid), {
            id: user.uid,
            name: mappedUser.name,
            avatar: mappedUser.avatar,
            status: 'online',
            bio: ''
          });
        }
      } catch (dbError) {
        console.warn("Firestore profile check/creation failed on login.", dbError);
      }

      return { 
        success: true, 
        message: 'Access Granted.', 
        user: mapFirebaseUser(userCredential.user) 
      };
    } catch (error: any) {
      let msg = "Invalid credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        msg = "Identity not found or password incorrect.";
      } else if (error.code === 'auth/wrong-password') {
        msg = "Incorrect passcode.";
      } else {
        console.error("Login Error:", error);
        if (error.code === 'auth/operation-not-allowed') msg = "Email/Password login is NOT enabled in Firebase Console.";
      }
      return { success: false, message: msg };
    }
  },

  // Google Login
  loginWithGoogle: async (): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check/Create in DB (Graceful Fallback)
      try {
        const [userDoc, profileDoc] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "profiles", user.uid))
        ]);

        if (!userDoc.exists()) {
           // Private data
           await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            name: user.displayName || 'Anonymous',
            email: user.email,
            avatar: user.photoURL,
            status: 'online',
            createdAt: serverTimestamp(),
            searchKey: (user.displayName || '').toLowerCase()
          });
        }

        if (!profileDoc.exists()) {
          // Public data
          await setDoc(doc(db, "profiles", user.uid), {
            id: user.uid,
            name: user.displayName || 'Anonymous',
            avatar: user.photoURL,
            status: 'online',
            bio: ''
          });
        }
      } catch (dbError) {
        console.warn("Firestore profile fetch failed. Continuing with Auth only.", dbError);
      }

      return {
        success: true,
        message: 'Google Link Established.',
        user: mapFirebaseUser(user)
      };
    } catch (error: any) {
      console.error("Google Login Error:", error);
      let msg = "গুগল লগইন ব্যর্থ হয়েছে।";
      
      if (error.code === 'auth/popup-closed-by-user') {
        msg = "আপনি লগইন পপ-আপটি বন্ধ করে দিয়েছেন। দয়া করে আবার চেষ্টা করুন এবং উইন্ডোটি বন্ধ করবেন না।";
      }
      if (error.code === 'auth/popup-blocked') {
        msg = "আপনার ব্রাউজার পপ-আপ ব্লক করেছে। দয়া করে পপ-আপ অ্যালাউ (Allow) করুন।";
      }
      if (error.code === 'auth/unauthorized-domain') {
        msg = `ডোমেইন অনুমোদিত নয়। ফায়ারবেস কনসোলে '${window.location.hostname}' যুক্ত করুন।`;
      }
      
      return { success: false, message: msg };
    }
  },

  resendVerification: async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        return { success: true, message: 'Verification link re-transmitted.' };
      }
      return { success: false, message: 'No active session found.' };
    } catch (error) {
       console.error("Resend Error", error);
       return { success: false, message: 'Failed to resend link.' };
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  },

  resetPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: `Reset link sent to: ${email}` };
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      return { success: false, message: 'Failed to send reset link.' };
    }
  },

  updateUserPassword: async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        return { success: true, message: 'Security code updated.' };
      }
      return { success: false, message: 'No active user found.' };
    } catch (error: any) {
      console.error("Update Password Error:", error);
      if (error.code === 'auth/requires-recent-login') {
        return { success: false, message: 'Session stale. Please relogin to update password.' };
      }
      return { success: false, message: 'Failed to update password.' };
    }
  },

  deleteAccount: async (password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const user = auth.currentUser;
      if (!user) return { success: false, message: 'No active session.' };

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // Delete Auth user
      await deleteUser(user);
      
      return { success: true, message: 'Identity terminated.' };
    } catch (error: any) {
      console.error("Delete Account Error:", error);
      if (error.code === 'auth/wrong-password') {
        return { success: false, message: 'Incorrect passcode. Termination aborted.' };
      }
      if (error.code === 'auth/requires-recent-login') {
        return { success: false, message: 'Session stale. Please relogin to terminate account.' };
      }
      return { success: false, message: 'Failed to terminate account. System error.' };
    }
  }
};
