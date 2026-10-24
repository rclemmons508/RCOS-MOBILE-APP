// src/config/firebase-config.ts
// Direct import of project Firebase configuration with env override support
import rawConfig from '../../firebase-applet-config.json';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, any>);

// The actual Firestore database ID provisioned in Google Cloud Firestore
const CANONICAL_FIRESTORE_DATABASE_ID = 'ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967';

// Determine the correct firestore database ID.
// Note: If an env variable or config accidentally equals 'rcos-mobile' (the GCP project ID instead of a database ID),
// fallback directly to the canonical database ID to prevent "@firebase/firestore: Database 'rcos-mobile' not found" runtime errors.
function resolveFirestoreDatabaseId(): string {
  const candidate = env.VITE_FIREBASE_DATABASE_ID || rawConfig.firestoreDatabaseId;
  if (!candidate || candidate === 'rcos-mobile' || candidate === '(default)') {
    return CANONICAL_FIRESTORE_DATABASE_ID;
  }
  return candidate;
}

// The bundled config ships with a placeholder API key
// ('__SET_VIA_VITE_FIREBASE_API_KEY__') that only a build-time env var
// can replace. A placeholder is NOT a key: Firebase must not be
// reported as "configured" while it is in place, or the app silently
// ends up with no Firebase session and no token on its API calls.
// validateFirebaseConfig (src/lib/firebase.ts) checks for it via this
// helper. The raw value still flows into initializeApp untouched —
// emptying it would make getAuth() throw at startup and take the
// whole app down, which is worse than an honestly-reported gap.
export function hasPlaceholderApiKey(): boolean {
  const candidate = env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '';
  return candidate.startsWith('__SET_VIA_');
}

export const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || 'rcos-mobile',
  appId: env.VITE_FIREBASE_APP_ID || rawConfig.appId || '',
  apiKey: env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || 'rcos-mobile.firebaseapp.com',
  firestoreDatabaseId: resolveFirestoreDatabaseId(),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || 'rcos-mobile.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || rawConfig.measurementId || '',
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || rawConfig.oAuthClientId || '',
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || rawConfig.recaptchaSiteKey || ''
};

export const googleServicesConfig = {
  project_info: {
    project_id: firebaseConfig.projectId
  },
  client: [
    {
      client_info: {
        android_client_info: {
          package_name: 'com.rcsolutions.rcosmobile'
        }
      }
    }
  ]
};
