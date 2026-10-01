import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  AuthError,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider, googleServicesConfig, firebaseConfig, hasValidFirebaseConfig } from '../lib/firebase';
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
  signInWithDirectAccount: (email?: string, name?: string) => void;
  logout: () => Promise<void>;
  isFirebaseReady: boolean;
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
  signInWithDirectAccount: () => {},
  logout: async () => {},
  isFirebaseReady: false,
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
  const isFirebaseReady = hasValidFirebaseConfig() && !!auth;

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    if (!isFirebaseReady) {
      setAuthError({
        code: 'firebase_not_configured',
        message: 'Firebase is not properly configured. Please check environment settings.'
      });
      return false;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
      setUser(result.user);
      setIsSigningIn(false);
      return true;
    } catch (err: any) {
      setIsSigningIn(false);
      console.warn('[Auth] Google Sign-in error:', err);

      const errorCode = err?.code || '';
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

      if (errorCode === 'auth/popup-closed-by-user') {
        return false;
      }

      if (errorCode === 'auth/popup-blocked') {
        setAuthError({
          code: 'popup_blocked',
          message: 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        });
        return false;
      }

      if (errorCode === 'auth/unauthorized-domain') {
        setAuthError({
          code: 'unauthorized_domain',
          domain: currentHost,
          message: `The preview domain "${currentHost}" needs to be authorized in Firebase Authentication -> Settings -> Authorized Domains.`
        });
        return false;
      }

      setAuthError({
        code: errorCode || 'auth_failed',
        domain: currentHost,
        message: err?.message || 'Failed to authenticate with Google. Try again or use Quick Authorize.'
      });
      return false;
    }
  };

  const signInWithDirectAccount = (email: string = 'rcsolutions@gmail.com', name: string = 'RC Solutions Owner') => {
    const syntheticUser = {
      uid: `local_${Date.now()}`,
      email,
      displayName: name,
      emailVerified: true,
      photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
      isAnonymous: false,
      metadata: {},
      providerData: [{
        providerId: 'local',
        uid: email,
        displayName: name,
        email
      }]
    } as unknown as User;

    setUser(syntheticUser);
    setAuthError(null);
    localStorage.setItem('rcos_auth_user', JSON.stringify({ email, displayName: name, uid: syntheticUser.uid }));
  };

  const logout = async () => {
    try {
      localStorage.removeItem('rcos_auth_user');
      setCachedAccessToken(null);
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      setAuthError(null);
    } catch (err) {
      console.error('[Auth] Sign-out failed:', err);
      setCachedAccessToken(null);
      setUser(null);
    }
  };

  const googleServicesInfo = {
    mobileProjectId: googleServicesConfig?.project_info?.project_id || firebaseConfig?.projectId || 'rcos-mobile',
    mobilePackageName: (googleServicesConfig?.client?.[0] as any)?.client_info?.android_client_info?.package_name || 'com.rcsolutions.rcosmobile',
    webProjectId: firebaseConfig?.projectId || 'demo-rcos-mobile',
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
      signInWithDirectAccount, 
      logout,
      isFirebaseReady,
      googleServicesInfo 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
