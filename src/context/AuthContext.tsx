import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  AuthError,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider, googleServicesConfig, firebaseConfig } from '../lib/firebase';
import { setCachedAccessToken, getCachedAccessToken } from '../lib/gmail';

export interface AuthErrorInfo {
  code?: string;
  message: string;
  domain?: string;
  helpLink?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: AuthErrorInfo | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  googleServicesInfo: {
    mobileProjectId: string;
    mobilePackageName: string;
    webProjectId: string;
    firestoreDatabaseId: string;
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isSigningIn: false,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => false,
  logout: async () => {},
  googleServicesInfo: {
    mobileProjectId: '',
    mobilePackageName: '',
    webProjectId: '',
    firestoreDatabaseId: ''
  }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  useEffect(() => {
    // Purge any legacy preloaded mock session entries on initialization.
    // This context's user comes ONLY from Firebase Auth state below —
    // a stored local record must never be turned into a signed-in user
    // here (the app's real session lives in authService).
    const stored = localStorage.getItem('rcos_auth_user') || localStorage.getItem('rcos_active_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.uid === 'usr-rcos-lead' || parsed?.uid === 'usr-rcos-admin' || parsed?.id === 'usr-rcos-lead') {
          localStorage.removeItem('rcos_auth_user');
          localStorage.removeItem('rcos_active_session');
        }
      } catch {}
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
      } else {
        // If there is an active direct session in localStorage, do not clear it
        const activeStored = localStorage.getItem('rcos_auth_user') || localStorage.getItem('rcos_active_session');
        if (!activeStored) {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken, { userEmail: result.user?.email || '' });
      }
      setUser(result.user);
      setIsSigningIn(false);
      return true;
    } catch (err: any) {
      console.warn('Google Sign-in status:', err);
      // In browser preview sandbox / iframe / unauthorized domain / blocked popup:
      setAuthError({
        code: err?.code,
        message: err?.message || 'Google popup sign-in was blocked or closed. Please sign in with email.'
      });
      setIsSigningIn(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('rcos_auth_user');
      setCachedAccessToken(null);
      await signOut(auth);
      setUser(null);
      setAuthError(null);
    } catch (err) {
      console.error('Sign-out failed:', err);
      setCachedAccessToken(null);
      setUser(null);
    }
  };

  const googleServicesInfo = {
    mobileProjectId: googleServicesConfig?.project_info?.project_id || 'rcos-mobile',
    mobilePackageName: (googleServicesConfig?.client?.[0] as any)?.client_info?.android_client_info?.package_name || 'com.rcsolutions.rcosmobile',
    webProjectId: firebaseConfig?.projectId || 'gen-lang-client-0370229208',
    firestoreDatabaseId: firebaseConfig?.firestoreDatabaseId || ''
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isSigningIn, 
      authError, 
      clearAuthError, 
      signInWithGoogle,
      logout,
      googleServicesInfo 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
