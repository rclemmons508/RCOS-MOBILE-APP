import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rcsolutions.rcosmobile',
  appName: 'RC Solutions - RCOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
