import firebaseAppletConfig from '../../firebase-applet-config.json';
import googleServicesJson from '../../google-services.json';

// Firebase and Google Services configurations
export const firebaseConfig = {
  projectId: firebaseAppletConfig.projectId,
  appId: firebaseAppletConfig.appId,
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || "ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967",
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  measurementId: firebaseAppletConfig.measurementId || "",
  oAuthClientId: firebaseAppletConfig.oAuthClientId,
  recaptchaSiteKey: firebaseAppletConfig.recaptchaSiteKey || ""
};

export const googleServicesConfig = googleServicesJson;
