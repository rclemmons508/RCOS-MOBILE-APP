// Build marker. The build injects a fresh marker on every release build
// (the CI commit SHA — see vite.config.ts), so a new APK always starts
// at the login screen: when the app starts and the stored marker does
// not match this build, the session is cleared and nobody starts
// already logged in. No manual bump is needed — every merge is a new
// commit, hence a new marker. The hardcoded value below is only a
// fallback for builds that do not go through vite's define.
declare const __APP_BUILD_ID__: string | undefined;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__.length > 0
    ? __APP_BUILD_ID__
    : 'build-2026-10-16-company-isolation';
