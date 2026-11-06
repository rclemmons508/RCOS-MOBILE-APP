import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  FirestoreError
} from 'firebase/firestore';
import { firebaseConfig, googleServicesConfig, hasPlaceholderApiKey } from '../config/firebase-config';

// Validate Firebase configuration to avoid runtime crashes when env variables are unset
export const validateFirebaseConfig = (): boolean => {
  const required: (keyof typeof firebaseConfig)[] = ['apiKey', 'projectId', 'authDomain', 'appId'];
  const missing: string[] = required.filter((key) => !firebaseConfig[key]);
  // A placeholder key ('__SET_VIA_...') counts as missing: with it,
  // every Firebase Auth call fails, so reporting "configured" would
  // hide the fact that the app has no real Firebase session.
  if (hasPlaceholderApiKey() && !missing.includes('apiKey')) {
    missing.push('apiKey (placeholder — set VITE_FIREBASE_API_KEY at build time)');
  }
  if (missing.length > 0) {
    console.warn(
      `[Firebase] Missing configuration keys: ${missing.join(', ')}. Configure in .env.local or consult SETUP.md.`
    );
    return false;
  }
  return true;
};

export const isFirebaseConfigured = validateFirebaseConfig();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/**
 * Gmail OAuth scopes — the MINIMUM the client code uses (audit #9).
 * Every call in src/lib/gmail.ts and what covers it:
 *   GET  /profile, /labels, /messages, /messages/{id}   → gmail.modify (read)
 *   POST /messages/{id}/modify (read/unread, star)      → gmail.modify
 *   POST /messages/{id}/trash, /untrash                 → gmail.modify
 *   POST /drafts                                        → gmail.modify (compose)
 *   POST /messages/send                                 → gmail.send (also within modify;
 *                                                         listed so the consent screen says "send")
 * Dropped: full https://mail.google.com/ (only needed for PERMANENT delete —
 * "Delete permanently" now falls back to Trash, which Gmail empties after
 * 30 days; see deleteGmailMessage), gmail.settings.basic/.sharing,
 * gmail.insert, gmail.labels/.metadata/.readonly/.compose (all covered by
 * gmail.modify) and every gmail.addons.* scope (Workspace add-on only).
 * NOTE: the server-side native OAuth flow (server/gmail-oauth.ts) keeps
 * its own copy of this list and should be cut to match.
 */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
];

// Configure Standard Google Auth Provider for user login (only profile, email, openid)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.addScope('openid');

// Separate provider specifically for Google Workspace Gmail API integration
export const gmailOAuthProvider = new GoogleAuthProvider();
gmailOAuthProvider.setCustomParameters({
  prompt: 'select_account'
});
gmailOAuthProvider.addScope('email');
gmailOAuthProvider.addScope('profile');
GMAIL_SCOPES.forEach((scope) => {
  gmailOAuthProvider.addScope(scope);
});

// Ensure browser local session persistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase session persistence warning:', err);
});

export { firebaseConfig, googleServicesConfig };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection verification
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client initial test note:", error.message);
    }
  }
}
testConnection();
