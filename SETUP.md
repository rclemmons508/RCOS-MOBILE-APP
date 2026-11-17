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

## 3. Running the Application

### Web Development Server
```bash
# Install dependencies
npm install

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

### Push notifications (live-call alerts)

When the AI receptionist answers a call, the server sends the business owner a push notification (FCM) — tapping it opens the live call in the app. This only works once the Android app is registered in Firebase and its config file is in place:

1. In the Firebase console (project **rcos-mobile** → Project settings → Your apps), register an Android app with package name `com.rcsolutions.rcosmobile` if it is not listed yet, then download its `google-services.json`.
2. Place the file at `android/app/google-services.json`. It is gitignored — never commit it, and never serve it from a public endpoint.
3. For CI builds (GitHub Actions), the file is not in the repo, so add it as a secret and a workflow step — the workflow file can only be edited by the repo owner (the GitHub App cannot edit workflows):
   - Create the secret: `base64 -w0 android/app/google-services.json`, then paste the output into the repo's Settings → Secrets and variables → Actions as `GOOGLE_SERVICES_JSON`.
   - Add this step to `.github/workflows/android.yml`, before "Sync Capacitor Android Assets":
     ```yaml
     - name: Add google-services.json for push notifications
       run: printf '%s' "$GOOGLE_SERVICES_JSON" | base64 --decode > android/app/google-services.json
       env:
         GOOGLE_SERVICES_JSON: ${{ secrets.GOOGLE_SERVICES_JSON }}
     ```
4. The app asks for notification permission at sign-in and registers its FCM token with the server (`POST /api/push/register`); signing out unregisters it. Tokens live in Firestore (`pushTokens`, server-only — see `firestore.rules`) and only the business owner's tokens ever get a call alert.

Without `google-services.json`, the APK still builds and the app still works — push registration just fails quietly (logged) and the owner gets no alert; the Calls screen's live-call view still shows the call.

### AI Assistant page (no extra setup)

The Assistant page (Morgan Vance) needs nothing beyond what is already running: its Talk button uses the same `rcos-voice-agent` worker and `POST /api/voice/token` as the agent talk console (executive persona), and its documents live in Firestore (`assistantDocuments`, server-only — see `firestore.rules`), so they survive redeploys. Endpoints, all behind the login gate: `POST /api/assistant/documents` (upload — PDF, Word, text, or CSV, 10 MB max; the server extracts the text and the client details), `GET /api/assistant/documents`, `DELETE /api/assistant/documents/:id`. Attaching a document sends its id with the chat (`POST /api/chat` `documentIds`), and the server only reads documents for a business the caller is a member of.

---

## 5. Security & API Endpoints

- Sensitive configuration files (`google-services.json`, `firebase-applet-config.json`, `rcos_db.json`) must **never** be exposed via public HTTP endpoints.
- Server health is verified via `/api/health`, which returns `{ status: "ok", timestamp: "..." }` with no sensitive environmental leaks.
