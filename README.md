# RC Solutions — RCOS Mobile Operating System

RCOS Mobile is a commercial-grade Mobile AI Operating System designed for **RC Solutions**. It combines an Express backend with a React + TypeScript + Tailwind CSS + Capacitor Android client to orchestrate:

- **24/7 AI Voice Phone Receptionist & Carrier Telephony (Twilio PSTN)**
- **Smart Job Dispatching, Field Routing & Work Order Management**
- **Automated Client Nurture & CRM Operations**
- **Gmail Workspace Integration & Communication Hub**
- **Human-In-The-Loop (HITL) Action Approvals with Immutable Audit Trails**
- **Real-Time Telemetry Streaming & Diagnostics**

---

## 1. Prerequisites

- **Node.js**: v20+ LTS
- **Package Manager**: `npm` v10+ or `bun`
- **Android Studio / Android SDK**: API Level 34+ (for native Android builds)
- **Java Development Kit**: OpenJDK 17 or 21 (for Gradle Android builds)

---

## 2. Repository Setup

Clone and install dependencies:
```bash
git clone <repository_url>
cd rcos-mobile-app
npm install
```

Copy the environment template:
```bash
cp .env.example .env
```

---

## 3. Environment Variables & Secret Separation

The project maintains strict separation between **Client-Safe** configuration and **Server-Only** secrets.

| Variable | Target | Scope | Description |
|---|---|---|---|
| `PORT` | Backend | Server Secret | Listening port for Express (default: `3000`) |
| `APP_URL` | Backend | Public HTTPS | Deployed public URL for Twilio webhooks and Android API calls |
| `GEMINI_API_KEY` | Backend | Server Secret | Google GenAI SDK API key (from Google AI Studio) |
| `TWILIO_ACCOUNT_SID` | Backend | Server Secret | Twilio Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | Backend | Server Secret | Twilio Authentication Token |
| `TWILIO_PHONE_NUMBER` | Backend | Server Secret | Inbound/Outbound PSTN carrier phone number |
| `OPERATOR_FORWARDING_PHONE` | Backend | Server Secret | Default human operator transfer phone number |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Public | Firebase Project ID (`rcos-mobile`) |
| `VITE_FIREBASE_DATABASE_ID` | Frontend | Public | Firestore database ID (`ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967`) |
| `VITE_FIREBASE_API_KEY` | Frontend | Public | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN`| Frontend | Public | Firebase Authentication domain |
| `VITE_FIREBASE_APP_ID` | Frontend | Public | Firebase Web App ID |
| `VITE_API_URL` | Frontend | Public | Optional base URL override for Android native builds |

> **Security Mandate**: Never prefix secret keys (`GEMINI_API_KEY`, `TWILIO_AUTH_TOKEN`, etc.) with `VITE_`. Vite embeds all `VITE_*` variables into client JavaScript bundles.

---

## 4. Firebase & Firestore Setup

1. **Database ID**: The application connects to Cloud Firestore database:
   `ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967`.
2. **Deploy Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```
   Security rules enforce strict tenant isolation: users can only read and write data belonging to businesses they own (`businesses/{businessId}/...`), with tamper-proof immutable audit logs (`auditLogs`).
3. **Authorized Domains**:
   In the Firebase Console (`Authentication > Settings > Authorized Domains`), verify that the following are listed:
   - `localhost`
   - `rcos-mobile.firebaseapp.com`
   - Your production domain (e.g. `ais-pre-fft6xjt5rur3koiv4vsfjv-548256682184.us-west2.run.app`)

---

## 5. Google OAuth & Gmail Integration

- **Android Native Notice**: On native Android builds, Google OAuth strictly disallows popup logins inside WebViews (`403: disallowed_useragent`). The app includes an automatic mobile 1-tap connection button that binds the operator session (`rcsoulutions@gmail.com`) directly.
- **Gmail Scopes**: Uses minimal read and compose scopes for managing client work orders, appointment notices, and service receipts.

---

## 6. Twilio PSTN Phone System Setup

1. In the **Twilio Console** (`Phone Numbers > Manage > Active Numbers`):
   - Set **A Call Comes In** (Webhook) to:
     `POST https://<YOUR_APP_URL>/api/twilio/voice/incoming`
   - Set **A Message Comes In** (Webhook) to:
     `POST https://<YOUR_APP_URL>/api/twilio/sms/incoming`
   - Set **Call Status Changes** to:
     `POST https://<YOUR_APP_URL>/api/twilio/voice/status`
2. Test connectivity inside the app using the **Real Phone Setup** modal (`Phone > Connect Real Carrier Line > Test Carrier Credentials`).

---

## 7. Local Development

Start the full-stack development server:
```bash
npm run dev
```
The application will launch on `http://localhost:3000` with Express handling API routes and Vite serving frontend hot modules.

---

## 8. Android Native Build (Capacitor)

The repository uses **one authoritative source** for web assets: `src/` and `public/`. Generated Android assets are compiled and copied automatically:

```bash
# 1. Typecheck and lint
npm run lint

# 2. Build web bundle and sync to Android project
npm run build:android-web

# 3. Open in Android Studio to build APK or AAB
npx cap open android
```

To compile a debug APK directly via command line:
```bash
cd android
./gradlew assembleDebug
```
The resulting APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 9. Testing & Quality Verification

```bash
# Static TypeScript validation (strict zero emit)
npm run lint

# Production bundle compilation test
npm run build
```

---

## 10. Production Checklist

Refer to [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) for the complete list of security, database, telephony, AI, and mobile release criteria before deploying to production.
