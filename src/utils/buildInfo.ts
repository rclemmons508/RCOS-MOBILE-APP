// Build marker. Bump this on every release build. When the app starts
// and the stored marker does not match, the session is cleared so a new
// APK always starts at the login screen — never already logged in as
// anyone. This is deliberate: a fresh install or a new build must never
// inherit the previous install's signed-in account.
export const APP_BUILD_ID = 'build-2026-10-16-fresh-login';
