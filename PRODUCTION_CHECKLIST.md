# RCOS Mobile App — Production Release & Hardening Checklist

This document provides the mandatory operational verification checklist for commercial deployment of the **RC Solutions — RCOS Mobile App**.

---

## 1. Firebase Authentication & Identity
- [x] **Firebase Auth Initialized**: Configured with project `rcos-mobile`.
- [x] **Google Sign-In Web / Android Support**: Android WebView compatibility layer active; fallback direct authentication for operator session (`rcsoulutions@gmail.com`).
- [x] **Session Persistence**: Session cached via LocalStorage (`LOCAL` persistence) with auto-restoration on app resume.
- [x] **Biometric UI Lock**: Device biometric authentication protects local UI interaction without replacing backend Firebase identity tokens.
- [x] **Authorized Domains**: Added `rcos-mobile.firebaseapp.com`, `localhost`, and Cloud Run hostnames to Firebase Auth Authorized Domains.

---

## 2. Cloud Firestore & Multi-Tenant Security
- [x] **Dedicated Database ID**: Set to `ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967`.
- [x] **Strict Tenant Isolation**: All entity subcollections (`/businesses/{businessId}/...`) enforce `request.auth.uid == resource.data.ownerId`.
- [x] **Immutable Audit Trail**: Append-only log subcollection (`/businesses/{businessId}/auditLogs/{logId}`) with update and delete strictly denied (`allow update, delete: if false`).
- [x] **Public Intake Protection**: Public customer service requests require valid ID, customer name <= 100 chars, description <= 2000 chars, and cannot read existing business documents.
- [x] **Idempotent HITL Approvals**: `decideActionApproval` atomic transaction prevents double approvals and updates immutable audit log simultaneously.

---

## 3. Server Architecture & Secret Management
- [x] **Zero Client Secrets**: No Gemini API keys, Twilio Auth Tokens, or private keys in the frontend bundle or Android assets.
- [x] **Server-Side Gemini SDK**: All AI model calls route through `server/gemini.ts` using `@google/genai` with fallback candidate model chains (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`).
- [x] **Carrier PSTN Telephony**: Real Twilio client initialization with TwiML responses, `<Gather>` speech recognition, call status webhooks, and department forwarding.
- [x] **Rate Limiting**: In-memory token bucket rate limiters protect expensive AI endpoints (60 req/min) and public intake forms (30 req/min).
- [x] **CORS & Security Headers**: Enforced `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and explicit origin filtering allowing `https://localhost`, `capacitor://localhost`, and production HTTPS domains.

---

## 4. Android Native & Capacitor Packaging
- [x] **Single Authoritative Source**: `src/` & `public/` -> `npm run build` -> `dist/` -> `npx cap copy android` -> `android/app/src/main/assets/public/`.
- [x] **App ID & Package Name**: `com.rcsolutions.app`.
- [x] **Custom Launcher Icon**: Official brand icon deployed across all Android densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi` for `ic_launcher.png`, `ic_launcher_round.png`, and `ic_launcher_foreground.png`).
- [x] **Permissions Audit**: Only `INTERNET`, `USE_BIOMETRIC`, and `USE_FINGERPRINT` declared in `AndroidManifest.xml`. No extraneous dangerous permissions.
- [x] **Production API Base URL**: `src/config/api.ts` automatically routes native APK calls to HTTPS backend rather than localhost.

---

## 5. Gmail Workspace Integration
- [x] **Least-Privilege Scopes**: Restricted to Gmail metadata, message read/send, and profile.
- [x] **Token Management**: Secure access tokens used for synchronous requests; no plaintext token leakage into public logs.
- [x] **Material Design UI**: Integrated Google Sign-In button with seamless account switching and quick reconnect.

---

## 6. Observability, Logging & Error Handling
- [x] **Sanitized Logging**: No passwords, tokens, or PII logged to console in production.
- [x] **App-Wide Error Boundaries**: Network timeouts (15s abort controller) and structured error models (`ApiError`) prevent screen crashes.
- [x] **Real-Time Telemetry Streaming**: System latency, CPU, active call counts, and field dispatch counters stream into live dashboard charts.

---

## 7. CI/CD & Build Verification
- [x] `npm run lint` (`tsc --noEmit`) passes with zero errors.
- [x] `npm run build` generates production Vite bundle in `dist/`.
- [x] `npm run build:android-web` compiles and copies web assets into Android public assets.
