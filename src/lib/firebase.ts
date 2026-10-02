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
import { firebaseConfig, googleServicesConfig, hasValidFirebaseConfig } from '../config/firebase-config';

// Initialize Firebase only if config is valid
let app: any;
let db: any;
let auth: any;

if (hasValidFirebaseConfig()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);

    // Ensure browser local session persistence
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase] Session persistence warning:', err);
    });

    // Startup connection verification
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('[Firebase] Connection test passed');
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.warn('[Firebase] Client is offline - will retry on reconnect');
        }
      }
    }
    testConnection();
  } catch (err: any) {
    console.error('[Firebase] Initialization failed:', err?.message);
    console.info('[Firebase] Running in demo mode - features will be limited');
  }
} else {
  console.warn(
    '[Firebase] Configuration incomplete. Please set VITE_FIREBASE_API_KEY and other required environment variables.'
  );
}

export { db, auth, firebaseConfig, googleServicesConfig };

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
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
  if (!auth) {
    throw new Error('Firebase not initialized. Check environment configuration.');
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[Firestore] Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
