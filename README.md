# RCOS Mobile

RCOS Mobile is an AI workforce app for small service businesses. It answers the phone, follows up with customers, and runs the day-to-day work — quotes, jobs, invoices, and team chat — from one Android app.

It is built by RC Solutions and sold to other business owners, not just used in-house. The live product site is https://rcsolutionsai.netlify.app/

## What it does now

- **24/7 AI receptionist (in-app voice).** Answers calls, routes between departments (Sales, Support, Billing, Emergency, and Dispatch for field trades), and hands off between AI personas inside the app. Calls start on the phone earpiece, with an on-screen speakerphone switch.
- **Morning Briefing + Agent Inbox.** The dashboard briefs the owner each day, and AI assistants proactively surface alerts, suggestions, and questions. Each item can be replied to, snoozed until tomorrow, dismissed, or opened in the right screen.
- **Global search.** Search from the dashboard across Jobs, Clients, Requests, Quotes, and Invoices.
- **Pipeline Health.** Read-only flags for problems worth a look: an approved quote with no job, an invoice unpaid for over a week, and a good customer gone quiet.
- **The money loop.** Quote approved → Schedule Job → Job completed → Create Invoice → Mark Paid. The briefing shows money owed and quotes waiting.
- **Customer Requests + public booking.** Customers can book through a public booking page for a business, and requests arrive with SLA badges.
- **Automations + follow-ups.** Rules for welcome texts to new customers, sorry-we-missed-you after a missed call, and review requests after a finished job. A master switch pauses everything, non-urgent automations hold during quiet hours, and a Recently Fired log shows what ran.
- **Teach Your Team.** In Settings, each business can paste its own reference notes — services, prices, policies, FAQs — and the assistants use them when answering. Those notes can never override the honesty rule or approval rules.
- **Team Messenger + Join Company.** Owners invite teammates by email with an 8-character code (7-day expiry). Team Chat sits one tap from the main screen.
- **Per-user Gmail.** Every teammate connects and sees only their own Gmail. Nobody ever sees, or gets preloaded with, another user's inbox.
- **Simple by design.** New builds always open at the login menu, signed out, with nothing pre-filled. Biometrics login is removed for now.

## Pricing (as published on the product site)

| Plan | Monthly | What it is for |
| --- | --- | --- |
| Starter | $49 | Small businesses getting started with the AI receptionist |
| Growth | $129 | The core offer: receptionist plus the full business system |
| Scale | $249 | Larger teams with more AI minutes |

All plans include a 14-day free trial. Annual billing gets 2 months free. AI-minute caps are 200 / 600 / 1,500, with overage at 10¢ / 9¢ / 8¢ per minute.

## Tech stack

- **Client:** React + TypeScript + Tailwind CSS, wrapped with Capacitor for Android
- **Server:** Express (TypeScript), deployed on Railway
- **Data:** Firebase Authentication + Cloud Firestore (project `rcos-mobile`)
- **Voice:** LiveKit + Gemini realtime voice
- **SMS:** Vonage

## Local setup

Prerequisites: Node.js 22, npm, Android Studio / Android SDK (API Level 34+) and OpenJDK 17 or 21 for native Android builds.

```bash
git clone <repository_url>
cd rcos-mobile-app
npm install
cp .env.example .env
```

Start the server:

```bash
npm start
```

`npm start` runs `start.ts`, which routes by `SERVICE_MODE`: the default runs the Express server, and `SERVICE_MODE=voice-agent` runs the LiveKit voice worker (`server/voice-agent.ts`).

## Environment variables

Never commit real secrets. `VITE_*` values are embedded in the client bundle, so only client-safe configuration may use that prefix.

| Variable | Where it lives | Notes |
| --- | --- | --- |
| `PORT` | Server | Listening port (Railway uses `$PORT`) |
| `APP_URL` | Server | Public URL of the deployed server |
| `GEMINI_API_KEY` | Server secret | Google AI Studio key |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Server secret | LiveKit Cloud voice |
| `VOICE_AGENT_SECRET` | Server secret | Shared secret for voice-agent routing logs |
| `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` | Client-safe | Firebase web config for project `rcos-mobile` |
| `VITE_API_URL` | Client-safe | Optional API base override for Android native builds (empty in web dev) |
| `FIREBASE_SERVICE_ACCOUNT` | Server secret | Firebase service-account JSON, one line. Until this is set, the API login gate stays off (see below) |

The GitHub Actions Android workflow (`Build Android APK`) passes the `VITE_FIREBASE_*` values from repo Variables into the web build. A build made before those variables were set will carry a placeholder Firebase key and sign-in will fail — always build from main after the variables are set.

## Android build

```bash
# 1. Typecheck
npm run lint

# 2. Build the web bundle and copy it into the Android project
npm run build:android-web

# 3. Open in Android Studio to build an APK or AAB
npx cap open android
```

Or build a debug APK directly:

```bash
cd android
./gradlew assembleDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Checks before a release

```bash
npm run lint   # tsc --noEmit
npm run build  # vite build
```

There is no automated test suite in this repo — verification is typecheck + production build + a real phone proof on the installed build.

## Current status — read before treating this as production-hardened

- **Login gate is OFF.** `FIREBASE_SERVICE_ACCOUNT` is not set, so API routes are not yet gated by Firebase ID tokens and Firestore rules are still permissive. Do not rely on per-business API authorization until the gate is on and the rules are hardened.
- **No carrier phone line is connected.** The Phone tab is in-app calling only. The old Twilio carrier path is not the current path and its trial has expired — do not configure Twilio expecting live carrier calls.
- **External-number transfer is unproven.** Department transfers today are handoffs between AI personas inside the app, not transfers to a real outside phone number.
- **Stripe billing is not built yet.** Pricing above is the published plan; checkout and subscription billing are still to come.
- **New builds start signed out.** If a build opens already logged in, that is a bug, not a feature.

See `PRODUCTION_CHECKLIST.md` for the full release criteria.
