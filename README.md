# RCOS Mobile

RCOS Mobile is an AI workforce app for small service businesses. It answers the phone, follows up with customers, and runs the day-to-day work — quotes, jobs, invoices, and team chat — from one Android app.

It is built by RC Solutions and sold to other business owners, not just used in-house. The live product site is https://rcsolutionsai.netlify.app/

## What it does now

- **24/7 AI receptionist (in-app voice).** Answers calls, routes between departments (Sales, Support, Billing, Emergency, and Dispatch for field trades), and hands off between AI personas inside the app. Calls start on the phone earpiece, with an on-screen speakerphone switch. During a call, a Keypad button opens a DTMF dial pad (1–9, *, 0, #) that sends each digit to the live call with LiveKit SIP DTMF, so menus (“press 1”), extensions, and PINs work from inside the app. The Calls screen also shows the receptionist's live phone calls as they happen — caller number, how long the call has been going, and whether she has answered — with a Listen in button that joins the call muted (you hear it, they can't hear you). When she answers, the business owner's phone also gets a push notification (tap it to open the live call); while the app is open the alert arrives as an in-app toast instead. Push needs the Android app registered in Firebase and `google-services.json` in `android/app/` — see SETUP.md §4; without it the build still works, only the alert stays silent. Live calls come from a LiveKit webhook: register `https://rcos-mobile-app-production.up.railway.app/api/livekit/webhook` in the LiveKit Cloud dashboard (project Settings → Webhooks) or the Calls screen honestly shows no live calls. Taking a call over from the receptionist is not in this build — the agent has no handoff path for it yet.
- **Morning Briefing + Agent Inbox.** The dashboard briefs the owner each day, and AI assistants proactively surface alerts, suggestions, and questions. Each item can be replied to, snoozed until tomorrow, dismissed, or opened in the right screen.
- **Global search.** Search from the dashboard across Jobs, Clients, Requests, Quotes, and Invoices.
- **Pipeline Health.** Read-only flags for problems worth a look: an approved quote with no job, an invoice unpaid for over a week, and a good customer gone quiet.
- **The money loop.** Quote approved → Schedule Job → Job completed → Create Invoice → Mark Paid. The briefing shows money owed and quotes waiting.
- **Schedule + Invoices.** The Jobs screen has a calendar strip: tap a day to see the jobs booked that day (jobs carry the date they were booked; older jobs without a date show in the full list). Job categories come from the business itself — its own services first, then its industry preset's default services — so the Dispatch New Job picker, the category filter, and the job editor all list the business's real work instead of a fixed trade list. The Jobs list is split into Active and Completed views: finishing a job moves it to Completed on its own, so the active list only ever shows work still to do, and completed jobs keep their Create Invoice / Invoiced actions in the Completed view. The Invoices screen lists every invoice with All / Unpaid / Paid / Overdue filters from the real invoice states — overdue means past the due terms on the invoice — and tapping a row opens its Approve / Edit / Reject or Mark Paid actions. Create Invoice opens the real invoice flow. Approved quotes keep their own section with Schedule Job, and quotes waiting for sign-off stay in the approval queue above the invoices.
- **Reports + Settings.** The drawer Reports screen shows revenue from invoices actually paid, jobs booked, new leads, and the call answer rate for the last 7 / 30 / 90 days or 12 months, with a revenue chart — no percentage changes or forecasts, since there is no prior-period baseline. Total customers, jobs, and revenue are shown as all-time figures (the customer record carries no creation date, so new customers can't be counted per period). Settings and the Automation rules are restyled to the same sidebar look; every setting still works the same way, and the Home header keeps its real Online/Offline badge.
- **Readability + one color, one icon.** The smallest text anywhere in the app is 12px, and buttons have a 48dp minimum touch target. The brand accent is one green (#22EC72) on every screen — buttons, badges, active states, and the logo. The app icon is the same full RC Solutions logo everywhere: in the app, on the home screen, and in the browser. The header Online/Offline badge is live: it reads the real server connection and shows Checking… while it finds out, never a fixed ONLINE label. The old floating AI button is gone — the Assistant page is in the drawer, right under Dashboard.
- **AI Assistant page.** Morgan Vance, the Executive Assistant, has her own page (drawer, right under Dashboard; also from More and the + sheet's Ask AI). Text chat with the same 60-second answer window as AI chat; a Talk button for a live voice conversation over the same LiveKit/Gemini realtime engine as the phone calls (executive persona, earpiece by default with a speakerphone switch); and document upload (PDF, Word, text, CSV, 10 MB max) — attach a document and Morgan answers questions about it, and the details it actually states (company, contact, phone, email, notes) can be pulled into a real job (through the chat's confirmation card) or a real client (tap twice to confirm). The page also opens with a short briefing — quotes waiting, money owed, today's jobs, new requests, missed calls — computed from the same real records as the Dashboard, and it says plainly when nothing needs attention. Documents live in Firestore, so a server restart never loses them; the chat only ever reads a document for a business the caller is on.
- **AI chat waits for its answer.** AI chat gives the server a full 60 seconds to reply (the server allows its AI up to 45 seconds), so messages no longer fail after 15 seconds with "couldn't reach the server." The chat also opens on the agent the saved conversation is actually with, so the message box names the right assistant instead of always saying Executive Assistant.
- **Customer Requests + public booking.** Customers can book through a public booking page for a business, and requests arrive with SLA badges.
- **Automations + follow-ups.** Rules for welcome texts to new customers, sorry-we-missed-you after a missed call, and review requests after a finished job. A master switch pauses everything, non-urgent automations hold during quiet hours, and a Recently Fired log shows what ran.
- **Teach Your Team.** In Settings, each business can paste its own reference notes — services, prices, policies, FAQs — and the assistants use them when answering. Those notes can never override the honesty rule or approval rules.
- **Team Messenger + Join Company.** Owners invite teammates by email with an 8-character code (7-day expiry). Team Chat sits one tap from the main screen.
- **Per-user Gmail.** Every teammate connects and sees only their own Gmail. Nobody ever sees, or gets preloaded with, another user's inbox. Gmail login tokens are stored encrypted in Firestore (not in a file on the server), so a server restart or new release never logs Gmail out — the Gmail tab also retries once if its first check after a page change fails, instead of flashing "not connected". Email bodies render in a forced readable style (sender colors that made light text on a white box are stripped, links stay green, quoted text stays legible), and each folder shows its full page of mail — the list scrolls with the tab and a Load more button fetches older pages — instead of stopping at the few cards that fit the screen.
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

- **Login gate is ON.** `FIREBASE_SERVICE_ACCOUNT` is set, so signed-in /api routes require a Firebase ID token (unsigned calls answer 401) and Firestore rules enforce per-business tenancy. Rollback: delete `FIREBASE_SERVICE_ACCOUNT` in Railway and redeploy, or set `ALLOW_OPEN_API=true`.
- **No carrier phone line is connected.** The Phone tab is in-app calling only (LiveKit voice). There is no Twilio dependency in the build — the carrier was removed entirely. SMS follow-ups send through Vonage when it is configured.
- **No mock or demo data anywhere in the build.** Every list starts empty and fills from the business's real records only — no fake voicemails, calls, jobs, clients, or companies are baked into the code.
- **External-number transfer is unproven.** Department transfers today are handoffs between AI personas inside the app, not transfers to a real outside phone number.
- **Stripe billing is intentionally out of scope for now.** Pricing above is the published plan; checkout and subscription billing are still to come.
- **New builds start signed out.** If a build opens already logged in, that is a bug, not a feature.

See `PRODUCTION_CHECKLIST.md` for the full release criteria.
