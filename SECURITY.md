# Security Policy

## Environment Variables

This application requires sensitive configuration to be provided via environment variables. **Never commit secrets to the repository.**

### Client-Side Configuration (Safe to expose)
These values are visible in the browser and bundled with the app:
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY` (restricted to web domain in Firebase console)
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_FIRESTORE_DB_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_OAUTH_CLIENT_ID`
- `VITE_FIREBASE_RECAPTCHA_SITE_KEY`

### Server-Side Configuration (NEVER expose to client)
These values must only be set on your backend/server environment:
- `GEMINI_API_KEY` - Google Gemini API key
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPERATOR_FORWARDING_PHONE` - Internal operator phone
- `DISPATCH_FORWARDING_PHONE` - Dispatch team phone
- `EMERGENCY_FORWARDING_PHONE` - Emergency line phone
- `BILLING_FORWARDING_PHONE` - Billing department phone
- `SALES_FORWARDING_PHONE` - Sales team phone
- `APP_URL` - Application URL for callbacks

## Setup Instructions

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual values in `.env.local`:
   - Get Firebase values from [Firebase Console](https://console.firebase.google.com)
   - Get Gemini API key from [Google AI Studio](https://aistudio.google.com)
   - Get Twilio values from [Twilio Console](https://www.twilio.com/console)

3. **IMPORTANT**: Never commit `.env.local` - it's already in `.gitignore`

4. For production deployment:
   - Use your hosting platform's secrets management (GitHub Secrets, Vercel Env, etc.)
   - Never hardcode values in code or config files
   - Rotate credentials regularly
   - Use IAM roles and principle of least privilege

## Firebase Security

1. Restrict your Firebase API key to web domain in Firebase Console:
   - Go to Firebase Console → Project Settings → API keys
   - Edit the Web API key
   - Set Application restrictions to "HTTP referrers (web sites)"
   - Add your domain(s)

2. Configure Firestore rules in `firestore.rules`:
   - Require authentication for sensitive data
   - Use custom claims for role-based access
   - Test rules with the emulator

3. Enable security checklist items in Firebase Console:
   - Enable Authentication providers
   - Configure authorized domains
   - Review and restrict Firestore rules

## Reporting Security Issues

If you discover a security vulnerability, please email security@rcsolutions.com instead of using the public issue tracker.

## Production Checklist

- [ ] All environment variables are set in production
- [ ] `.env.local` is NOT deployed
- [ ] Firebase API key is restricted to production domain
- [ ] Firestore rules are properly configured
- [ ] HTTPS is enabled for all endpoints
- [ ] CORS is properly configured
- [ ] Secrets are rotated regularly
- [ ] Audit logging is enabled
- [ ] Security headers are configured
- [ ] Dependency vulnerabilities are addressed (`npm audit`)
