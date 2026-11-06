import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rcsolutions.rcosmobile',
  appName: 'RC Solutions - RCOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // Never load http:// content inside the https WebView.
    allowMixedContent: false
  },
  cordova: {
    // Written into android/app/src/main/res/xml/config.xml by `cap sync`.
    // Replaces the default <access origin="*" />. Only Cordova plugins that
    // honour the whitelist read it (none are installed today), so keep it to
    // the https/wss origins the app actually talks to.
    accessOrigins: [
      'https://rcos-mobile-app-production.up.railway.app',
      'https://*.googleapis.com',
      'https://*.google.com',
      'https://*.gstatic.com',
      'https://*.firebaseapp.com',
      'https://*.firebaseio.com',
      'https://*.livekit.cloud',
      'wss://*.livekit.cloud'
    ]
  }
};

export default config;
