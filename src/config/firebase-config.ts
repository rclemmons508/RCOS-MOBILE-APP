/**
 * Firebase Configuration
 * Loads Firebase config from environment variables for security.
 * Never import or use raw credential files in client code.
 */

const loadFirebaseConfig = () => {
  // Client-safe Firebase config - these values are exposed but non-sensitive
  // Real API keys should be restricted to client app domains in Firebase console
  const config = {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-rcos-mobile',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-rcos-mobile.firebaseapp.com',
    firestoreDatabaseId:
      import.meta.env.VITE_FIREBASE_FIRESTORE_DB_ID ||
      'demo-rcos-mobile',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-rcos-mobile.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || '000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
    recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || ''
  };

  // Validate required config
  if (!config.apiKey) {
    console.warn(
      '[Firebase] API key not configured. Set VITE_FIREBASE_API_KEY environment variable. Using demo mode.'
    );
  }

  return config;
};

export const firebaseConfig = loadFirebaseConfig();

export const googleServicesConfig = {
  project_info: {
    project_id: firebaseConfig.projectId
  },
  client: [{
    client_info: {
      android_client_info: {
        package_name: 'com.rcsolutions.rcosmobile'
      }
    }
  }]
};

// Export validation helper
export const hasValidFirebaseConfig = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);
};
