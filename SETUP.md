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
5. Push is enabled: `PUSH_CONFIGURED = true` in `src/lib/pushNotifications.ts` — flipped once the steps above were complete. If the Firebase setup is ever removed, flip it back to `false` until the file and secret are back in place (see below).

The flag is the safety net: without `google-services.json` in the build, the app MUST NOT call the native push plugin — with no native FirebaseApp, `register()` throws on the native side and crashes the app the moment notification permission is granted (and on every launch after that, because the permission stays granted). Setting `PUSH_CONFIGURED = false` in `src/lib/pushNotifications.ts` keeps every native push call off until the setup above is done, so the app opens and runs normally; the Calls screen's live-call view still shows the call.

### Receptionist calls in the Calls log

When a receptionist call ends, the server writes one record to the Calls log (caller, time, duration) — it shows in the Calls list and counts on the weekly calls answered card. The record is written from the LiveKit webhook when the caller hangs up or the room closes; only a call the receptionist actually answered is logged, and the record id is the LiveKit room, so a redelivered call-end signal updates the same record instead of writing a second one. The record carries no business id — it is attributed to the phone line's business (the only business on the server), the same rule the live-call list uses.

This depends on the webhook actually reaching the API service: the webhook is registered in LiveKit Cloud (project **rcos-mobile** → Settings → Webhooks) at `https://rcos-mobile-app-production.up.railway.app/api/livekit/webhook`, and the API service (not just the voice worker) needs its own `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in Railway — without them the webhook answers 503 and no call is ever logged. Settings → Diagnostics shows the Voice Calling (LiveKit) state.

### Outbound calling (dial out from the app)

The Calls tab's **Dial out** keypad calls a real phone number from the app: the server creates a LiveKit room and dials the number into it as a SIP participant (`POST /api/calls/dial`), and the owner talks through the room. LiveKit cannot dial out on its own number alone — it needs a stored **outbound SIP trunk** from a SIP provider. The business already has a Vonage account (SMS + number), so Vonage is the trunk provider — no new signup and no work email needed.

1. **Create a Vonage SIP trunk.** In the Vonage developer dashboard, go to **Build → Voice → SIP** and run the SIP Trunking wizard. Vonage creates a domain (e.g. `yourcompany`), a digest username, and a password — note all three. Link a Vonage number to the trunk (buy one in the dashboard if the account has none) so it can be used as the outbound caller ID. (If outbound calling is off on the account — Vonage disables it for new members — enable it in the trunk's Outbound Calling settings.)
2. **Create the outbound trunk in LiveKit.** In the LiveKit Cloud dashboard (project **rcos-mobile** → **Telephony → SIP trunks**), create a new **Outbound** trunk:
   - **Address:** your Vonage SIP endpoint, e.g. `yourcompany.sip-us.vonage.com:5061` (TLS; use `5060` for UDP). Use the region nearest you (`sip-us`, `sip-eu`).
   - **Authentication:** username + password from step 1.
   - **Numbers:** the Vonage number(s) from step 1, in E.164 format (e.g. `+14705550100`).
   - Copy the trunk **id** LiveKit shows after creating it.
3. **Set the server variable.** In Railway (service `RCOS-MOBILE-APP` → Variables), set `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` to the trunk id from step 2 and redeploy. Optional: `LIVEKIT_SIP_OUTBOUND_CALLER_ID` overrides the caller ID shown to the callee (defaults to the trunk's own number). Optional: `OUTBOUND_CALLS_DAILY_CAP` caps outbound calls per business per day (default 100); `OUTBOUND_ALLOWED_COUNTRY_CODES` widens the destination allow-list (default `1`, US/Canada only — Caribbean and premium-rate +1 numbers are always blocked).

Until the trunk id is set, `POST /api/calls/dial` answers 503 (`outbound_trunk_not_configured`) and the dialer shows these setup steps instead of a working Call button — it never pretends a call went out. Settings → Diagnostics shows the trunk state (`Outbound Calling (SIP trunk)`), and `GET /api/calls/outbound-status` reports it to the app. Calls are billed by the SIP provider (Vonage) at its voice rates; hanging up deletes the LiveKit room, which drops the SIP leg. The receptionist never joins an outbound room, and outbound rooms never appear in the live-receptionist-calls list.

### AI Assistant page (no extra setup)

The Assistant page (Morgan Vance) needs nothing beyond what is already running: its Talk button uses the same `rcos-voice-agent` worker and `POST /api/voice/token` as the agent talk console (executive persona), and its documents live in Firestore (`assistantDocuments`, server-only — see `firestore.rules`), so they survive redeploys. Endpoints, all behind the login gate: `POST /api/assistant/documents` (upload — PDF, Word, text, or CSV, 10 MB max; the server extracts the text and the client details), `GET /api/assistant/documents`, `DELETE /api/assistant/documents/:id`. Attaching a document sends its id with the chat (`POST /api/chat` `documentIds`), and the server only reads documents for a business the caller is a member of.

Morgan also asks about waiting items inside the chat itself (`src/utils/morganAlerts.ts`, wired in `AssistantTab`): the same five approved triggers as the Operations feed — new pending request, quote awaiting approval, unpaid approved invoice, real missed call, job stalled 48 hours or more (first-seen tracking, shared with the feed in `src/utils/mainAiAlerts.ts`) — each raised as her question with the choice attached. Approving a quote calls the same `POST /api/business/:id/actions/:actionId/decide` the Approvals screen uses, and marking an invoice paid calls `POST /api/business/:id/actions/:actionId/mark-paid`; both report only what the server confirmed. Morgan's raised/answered record lives on the device (`rcos_morgan_alerts_<businessId>` in local storage): a record speaks up once, then once more a day later only if it is still waiting and unanswered, then never again — any tap on the card (approve, mark paid, view, not now) counts as answered. When nothing is waiting, she stays quiet. The Operations feed still carries every item as the backup.

---

## 5. Security & API Endpoints

- Sensitive configuration files (`google-services.json`, `firebase-applet-config.json`, `rcos_db.json`) must **never** be exposed via public HTTP endpoints.
- Server health is verified via `/api/health`, which returns `{ status: "ok", timestamp: "..." }` with no sensitive environmental leaks.
- **Ownerless business repair (`POST /api/businesses`).** Company setup always sends the signed-in user as the business owner (`ownerId` + owner `members` entry + `contactEmail`). If a server record was created before that fix and has no owner identity at all, its owner can adopt it by re-saving the business from the app: the server allows the update only when the existing record has no `ownerId`, no members, no `contactEmail` and no `ownerEmail`, and the request names the caller's own verified token uid as owner (`canAdoptOwnerlessBusiness` in `server/tenancy.ts`). A record with any owner identity still answers 409, and nobody can adopt a record as someone else.
