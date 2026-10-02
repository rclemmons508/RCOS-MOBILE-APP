# Development Guide for RCOS Mobile App

## Prerequisites

- Node.js 18+ (or use nvm: `nvm use`)
- npm or yarn package manager
- Git

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/rclemmons508/RCOS-MOBILE-APP.git
cd RCOS-MOBILE-APP
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase and Twilio credentials
```

### 3. Run Development Server

```bash
npm run dev
# App runs at http://localhost:5173
```

## Project Structure

```
src/
├── components/     # React UI components
│   ├── auth/      # Authentication components
│   ├── tabs/      # Main app tabs
│   └── ...        # Other feature components
├── config/        # Configuration loaders (environment-based)
├── context/       # React context providers
├── data/          # Mock data and constants
├── lib/           # Core libraries (Firebase, Gmail, etc.)
├── services/      # Business logic services
├── types.ts       # TypeScript type definitions
├── App.tsx        # Root app component
└── main.tsx       # Entry point

server/
├── db.ts          # Database layer
├── engine.ts      # AI orchestration engine
├── gemini.ts      # Gemini API wrapper
└── telephony.ts   # Twilio telephony integration

server.ts         # Express server entry point
```

## Key Features

### Authentication
- Google OAuth integration via Firebase
- Local demo accounts for testing
- Biometric auth support (Capacitor)
- Session persistence in localStorage

### Phone System
- Inbound call handling with Twilio
- AI voice receptionist (Gemini)
- Call recording and transcription
- Department routing

### Job Dispatch
- Smart job routing based on priority and location
- Technician assignment
- Real-time status tracking
- Mobile job packs with workflows

### AI Integration
- Multi-agent orchestration
- Gemini API for AI responses
- Fallback engine for offline capability
- Context-aware routing

## Common Tasks

### Build for Production

```bash
npm run build
# Output in dist/ directory
```

### Type Checking

```bash
npm run lint
# Or for watch mode:
npm run type-check
```

### Running Tests

```bash
# Tests not yet configured
# Placeholder for future test suite
```

### Building Android APK

```bash
# Requires Android Studio and Capacitor
npm run build
capacitor copy
capacitor open android
# Build in Android Studio
```

## Debugging

### Browser DevTools
- Open http://localhost:5173
- Press F12 or Cmd+Option+I
- Check Console for errors
- Inspect localStorage for auth state

### Firebase Console
- Monitor Firestore operations
- Check Authentication logs
- Review Security Rules in Firestore tab

### Vite Debug
- Vite provides source maps in dev mode
- Use `debugger;` statements in code
- Check Network tab for API calls

## Troubleshooting

### Firebase Not Connecting

**Problem**: "Firebase not initialized" errors

**Solution**:
1. Check `.env.local` has `VITE_FIREBASE_API_KEY`
2. Verify Firebase project ID matches
3. Check authorized domains in Firebase Console
4. Ensure your domain is added to Firestore rules

### Environment Variables Not Loading

**Problem**: App uses demo values instead of your config

**Solution**:
1. Restart dev server after changing `.env.local`
2. Verify variable names start with `VITE_` for client-side
3. Check browser console for environment variable logs

### Authentication Failing

**Problem**: Google sign-in popup blocked or fails

**Solution**:
1. Allow popups in browser settings for localhost
2. Add localhost to Firebase authorized domains
3. Check browser console for specific error codes
4. Use "Fast Login as Lead Operator" to test without OAuth

### Phone/Twilio Not Working

**Problem**: Twilio integration failing

**Solution**:
1. Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` on server
2. Check phone number format (E.164: +1234567890)
3. Ensure Twilio webhook URLs are correct
4. Check Twilio console logs for errors

## Performance Tips

1. **Code Splitting**: Vite automatically splits code by route
2. **Lazy Loading**: Use React.lazy() for heavy components
3. **Memoization**: Use React.memo for expensive renders
4. **Firebase Indexing**: Add composite indexes for complex queries
5. **Caching**: Use browser cache headers for static assets

## Security Checklist

- [ ] Never commit `.env.local` or secrets
- [ ] Use HTTPS in production
- [ ] Restrict Firebase API key to domain
- [ ] Review Firestore security rules
- [ ] Enable CORS only for your domain
- [ ] Use environment variables for all secrets
- [ ] Keep dependencies updated (`npm audit fix`)
- [ ] Rotate API keys regularly

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Capacitor Documentation](https://capacitorjs.com/)
- [Twilio Documentation](https://www.twilio.com/docs)
- [Gemini API Documentation](https://ai.google.dev/)
