# RCOS Mobile App - Security & Setup Guide

Welcome to the **RCOS Mobile Operating System** repository. This guide explains how to securely configure and run the application in development, testing, and production environments.

---

## 1. Environment & Firebase Configuration

Firebase is automatically configured for this app via `firebase-applet-config.json` provisioned directly by AI Studio. No manual environment variable entry or `.env` files are required.

The app automatically reads credentials from `firebase-applet-config.json` for:
- Firebase Auth & Google Sign-In
- Firestore Database
- Cloud Storage

Optional server overrides can be defined in `.env`:
- `PORT` (default 3000)
- `NODE_ENV` (development/production)

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
