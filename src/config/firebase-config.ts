// Firebase and Google Services configurations using environment variables
export const firebaseConfig = {
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: "",
  oAuthClientId: process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID,
  recaptchaSiteKey: "",
};

export const googleServicesConfig = {
  project_info: {
    project_number: process.env.EXPO_PUBLIC_GOOGLE_PROJECT_NUMBER,
    project_id: process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID,
    storage_bucket: process.env.EXPO_PUBLIC_GOOGLE_STORAGE_BUCKET,
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: process.env.EXPO_PUBLIC_MOBILESDK_APP_ID,
        android_client_info: {
          package_name: "com.rcsolutions.rcosmobile",
        },
      },
      oauth_client: [],
      api_key: [
        {
          current_key: process.env.EXPO_PUBLIC_GOOGLE_SERVICES_API_KEY,
        },
      ],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [],
        },
      },
    },
  ],
  configuration_version: "1",
};

