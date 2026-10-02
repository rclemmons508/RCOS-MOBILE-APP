# RCOS Mobile App - Security & Setup Guide

Welcome to the **RCOS Mobile Operating System** repository. This guide explains how to securely configure and run the application in development, testing, and production environments.

---

## 1. Environment Configuration

1. Copy `.env.example` to `.env.local` (or `.env`):
   ```bash
   cp .env.example .env.local
   ```
2. Populate the environment variables with your Firebase project credentials from the [Firebase Console](https://console.firebase.google.com/):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID` (if using custom named Firestore database)
   - `VITE_FIREBASE_OAUTH_CLIENT_ID`
3. **Security Rule:** Never commit `.env.local` or production API credentials to Git. `.gitignore` is pre-configured to ignore all `.env*` files except `.env.example`.

---

## 2. Authentication & Demo Mode Policy

- **Production Mode (`VITE_ENABLE_DEMO_AUTH=false`):**
  - Form input fields default to empty strings requiring explicit operator credentials.
  - Silent Google OAuth fallbacks are disabled. If Google authentication is closed or cancelled by the user, a descriptive error message is presented.
  - Direct backdoor bypass links are disabled.
- **Development Demo Mode (`VITE_ENABLE_DEMO_AUTH=true`):**
  - Displays a visible top security banner: `DEMO MODE - Development Data Only`.
  - Enables pre-seeded development shortcuts for offline UI testing without internet access.

---

## 3. Running the Application

### Web Development Server
```bash
# Install dependencies
bun install   # or npm install

# Start development server on port 3000
npm run dev
```

### Production Build & Verification
```bash
# Type check and lint
npm run lint

# Build production web bundle
npm run build
```

---

## 4. Mobile (Capacitor Android) Builds

After changing web assets or React source code, compile and synchronize Android assets:
```bash
# Build web bundle and copy to Android assets
npm run build:android-web

# Or perform full Capacitor sync
npm run cap:sync
```

Generated build bundles under `android/app/src/main/assets/public/assets/` are derived artifacts and should be rebuilt on deployment rather than treated as source files.

---

## 5. Security & API Endpoints

- Sensitive configuration files (`google-services.json`, `firebase-applet-config.json`, `rcos_db.json`) must **never** be exposed via public HTTP endpoints.
- Server health is verified via `/api/health`, which returns `{ status: "ok", timestamp: "..." }` with no sensitive environmental leaks.
