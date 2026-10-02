// src/config/firebase-config.ts
// Secure configuration loader reading from import.meta.env (Vite environment variables)
// with fallback to local applet configuration if present.

let fallbackConfig: Record<string, any> = {};
try {
  // Dynamically attempt loading fallback config if it exists on disk
  const modules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
  const key = Object.keys(modules)[0];
  if (key && (modules[key] as any)?.default) {
    fallbackConfig = (modules[key] as any).default;
  }
} catch {
  fallbackConfig = {};
}

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, any>);

export const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId || '',
  appId: env.VITE_FIREBASE_APP_ID || fallbackConfig.appId || '',
  apiKey: env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain || '',
  firestoreDatabaseId:
    env.VITE_FIREBASE_DATABASE_ID ||
    fallbackConfig.firestoreDatabaseId ||
    'ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId || '',
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || fallbackConfig.oAuthClientId || '',
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || fallbackConfig.recaptchaSiteKey || ''
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
