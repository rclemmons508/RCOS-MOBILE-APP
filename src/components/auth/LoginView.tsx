import React, { useState } from 'react';
import { User, UserPreferences } from '../../types';
import { authService } from '../../services/authService';
import { setCachedBusiness, setOnboardingCompleted } from '../../utils/businessStorage';
import { BIOMETRICS_ENABLED } from '../../services/biometricService';
import { teamService } from '../../services/teamService';
import { useBiometrics } from '../../context/BiometricContext';
import { RCLogo } from '../RCLogo';
import { BiometricSetupModal } from '../biometrics/BiometricSetupModal';
import { haptic } from '../../utils/haptics';
import { INDUSTRY_PRESETS, getStaffRolesForIndustry } from '../../data/presets';
import { Capacitor } from '@capacitor/core';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Fingerprint, 
  Scan, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Building2, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  KeyRound,
  Check
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { isEnrolled, enrolledInfo, biometryType, biometryLabel } = useBiometrics();
  
  const [tab, setTab] = useState<'signin' | 'register' | 'join'>('signin');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  // Google sign-in cannot run real OAuth inside the native WebView, so the
  // button is hidden there entirely (no fake fallback login exists anymore).
  const isNativeApp = Capacitor.isNativePlatform();

  // Sign In Form State - Secure empty defaults
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBackupPin, setRegBackupPin] = useState('');
  const [regIndustryId, setRegIndustryId] = useState('general_small_business');
  // Role options follow the selected industry; default to its first role.
  const regRoleOptions = getStaffRolesForIndustry(regIndustryId);
  const [regRole, setRegRole] = useState<string>(regRoleOptions[0]);
  const [regOrganization, setRegOrganization] = useState('');
  const [regAutoDispatch, setRegAutoDispatch] = useState<'all' | 'critical' | 'manual'>('all');
  const [regRingerMode, setRegRingerMode] = useState<'sound' | 'vibrate' | 'silent'>('sound');
  const [regEnableBiometrics, setRegEnableBiometrics] = useState(true);

// Join a Company — invite code from the team owner + this person's details.
// The server never sees the password: it only checks the invite code and
// adds this email to the company's team. The app creates the local login.
const [joinCode, setJoinCode] = useState('');
const [joinFullName, setJoinFullName] = useState('');
const [joinEmail, setJoinEmail] = useState('');
const [joinPassword, setJoinPassword] = useState('');
const [joinPin, setJoinPin] = useState('');

  const handleIndustryChange = (presetId: string) => {
    setRegIndustryId(presetId);
    // Reset the role to the new industry's first option so a stale role
    // from another industry can never be submitted.
    const roles = getStaffRolesForIndustry(presetId);
    setRegRole(roles[0]);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-zinc-800' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2 || score === 3) return { score: 65, label: 'Good', color: 'bg-amber-500' };
    return { score: 100, label: 'Strong Security', color: 'bg-lime-500' };
  };

  // Google Login Handler (real Google auth only; unavailable in native builds)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await authService.loginWithGoogle();
      await haptic.success();
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In failed. Please try again or use email login.');
    } finally {
      setIsLoading(false);
    }
  };

  // Biometrics Login Handler
  const handleBiometricsLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await authService.loginWithBiometrics();
      await haptic.success();
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric authentication was dismissed. You can also sign in with email or Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Email Sign In Handler
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMsg('Please enter an email address.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await authService.loginWithEmail(loginEmail, loginPassword);
      await haptic.success();
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim()) {
      setErrorMsg('Please enter an email address.');
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    // A backup PIN is required when biometric login is on — it is the only
    // way back in if the sensor ever fails.
    if (BIOMETRICS_ENABLED && regEnableBiometrics && !/^\d{4}$/.test(regBackupPin)) {
      setErrorMsg('Please set a 4-digit backup PIN in case biometrics fail.');
      return;
    }
    if (regBackupPin && !/^\d{4}$/.test(regBackupPin)) {
      setErrorMsg('Backup PIN must be exactly 4 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const industryPreset = INDUSTRY_PRESETS.find((p) => p.id === regIndustryId);
      const user = await authService.registerUser({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        organization: regOrganization,
        backupPin: regBackupPin || undefined,
        enableBiometrics: BIOMETRICS_ENABLED && regEnableBiometrics,
        preferences: {
          industryProfile: industryPreset ? industryPreset.name : regIndustryId,
          autoDispatchThreshold: regAutoDispatch as any,
          ringerMode: regRingerMode,
          biometricsEnabled: BIOMETRICS_ENABLED && regEnableBiometrics
        }
      });

      await haptic.success();
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Join a Company Handler — invite code first, then local login.
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Please enter the invite code from your team owner.');
      return;
    }
    if (!joinFullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!joinEmail.trim()) {
      setErrorMsg('Please enter an email address.');
      return;
    }
    if (!joinPassword) {
      setErrorMsg('Please create a password.');
      return;
    }
    if (joinPin && !/^\d{4}$/.test(joinPin)) {
      setErrorMsg('Backup PIN must be exactly 4 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { business } = await teamService.joinCompany({
        code,
        fullName: joinFullName.trim(),
        email: joinEmail.trim()
      });
      const existing = authService
        .getRegisteredUsers()
        .find((u) => u.email.toLowerCase() === joinEmail.trim().toLowerCase());
      if (existing) {
        // This phone already has a login for that email — joining only
        // attached the company to it. Sign in with the existing account.
        setErrorMsg(`You're on the ${business.name} team now. Sign in with your existing account to open it.`);
        setTab('signin');
        setLoginEmail(joinEmail.trim());
        return;
      }
      const user = await authService.registerUser({
        fullName: joinFullName.trim(),
        email: joinEmail.trim(),
        password: joinPassword,
        role: 'Team Member',
        organization: business.name,
        backupPin: joinPin || undefined,
        enableBiometrics: false,
        businessId: business.id
      });

      // Point this phone at the joined company and skip company setup —
      // the company already exists, and onboarding would make a second one.
      // Scoped to the joining operator: the old global keys handed the
      // next operator this company.
      setCachedBusiness({ email: joinEmail.trim() }, business);
      setOnboardingCompleted({ email: joinEmail.trim() });
      await haptic.success();
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not join that company.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <RCLogo variant="compact" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white tracking-tight">RC SOLUTIONS</span>
            <span className="text-[10px] text-zinc-400 font-mono">Autonomous Field OS</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-lime-400">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
          <span>v8.5.2 • SECURE</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-6 space-y-6">
        {/* Welcome Headline */}
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Operator Access Portal
          </h1>
          <p className="text-xs text-zinc-400">
            Sign in to unlock dispatch, SCADA telemetry, and multi-agent systems
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* PRIMARY AUTH OPTION 1: GOOGLE SIGN-IN (web only — hidden in native builds) */}
        {!isNativeApp && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white font-bold text-xs flex items-center justify-center gap-3 shadow-md transition active:scale-98 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
        )}

        {BIOMETRICS_ENABLED && (
          <>
        {/* PRIMARY AUTH OPTION 2: BIOMETRIC LOGIN */}
        <div className="relative">
          <button
            type="button"
            onClick={handleBiometricsLogin}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-2xl border flex items-center justify-between shadow-md transition active:scale-98 cursor-pointer ${
              isEnrolled
                ? 'bg-gradient-to-r from-lime-500/10 to-emerald-500/10 border-lime-500/40 hover:border-lime-400 text-white'
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-lime-500/20 text-lime-400">
                {biometryType === 'face' ? <Scan className="w-5 h-5" /> : <Fingerprint className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Sign In with {biometryLabel}</span>
                  {isEnrolled && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-lime-500 text-black font-extrabold uppercase">
                      LINKED
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                  {isEnrolled ? `Linked to ${enrolledInfo.userEmail}` : 'Tap to enroll sensor for 1-touch login'}
                </div>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-lime-400" />
          </button>

          {!isEnrolled && (
            <button
              type="button"
              onClick={() => setIsSetupModalOpen(true)}
              className="text-[10px] text-lime-400 hover:underline mt-1.5 text-center w-full block cursor-pointer"
            >
              + Set Up Biometric Hardware Profile
            </button>
          )}
        </div>
          </>
        )}

        {/* DIVIDER */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-900 w-full" />
          <span className="bg-black px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest shrink-0">
            or sign in with email
          </span>
        </div>

        {/* PRIMARY AUTH OPTION 3: EMAIL SIGN-IN & REGISTRATION */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-xl space-y-4">
          {/* Segmented Tab Toggle: Sign In vs Register */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl transition cursor-pointer ${
                tab === 'signin'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl transition cursor-pointer ${
                tab === 'register'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Register Account
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl transition cursor-pointer ${
                tab === 'join'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Join Company
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {tab === 'signin' && (
            <form onSubmit={handleEmailSignIn} autoComplete="off" className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Operator Email:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Password:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-lime-500 focus:ring-0"
                  />
                  <span>Stay logged in</span>
                </label>
                <button
                  type="button"
                  onClick={() => setErrorMsg('Enter your email and password to sign in, or click Register Account to create one.')}
                  className="text-zinc-400 hover:text-white cursor-pointer text-[10px]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition active:scale-98 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Operations Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER ACCOUNT */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} autoComplete="off" className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Full Name:</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Work Email:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Create Password:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {regPassword && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getPasswordStrength(regPassword).color} transition-all duration-300`} 
                        style={{ width: `${getPasswordStrength(regPassword).score}%` }} 
                      />
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400">
                      {getPasswordStrength(regPassword).label}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400">Backup PIN:</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="new-password"
                    value={regBackupPin}
                    onChange={(e) => setRegBackupPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="4 digits"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono text-center tracking-[0.3em]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400">Organization:</label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    value={regOrganization}
                    onChange={(e) => setRegOrganization(e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
              <p className="-mt-1 text-[10px] text-zinc-500">
                Your backup PIN unlocks the app if your fingerprint or face ever fails. Only you know it.
              </p>

              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400">Operator Role:</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    {regRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PERSONAL PREFERENCES SETUP */}
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-lime-400" />
                  <span>Personal App Preferences</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Industry Focus:</label>
                    <select
                      value={regIndustryId}
                      onChange={(e) => handleIndustryChange(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                    >
                      {INDUSTRY_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Alert Sound Profile:</label>
                    <select
                      value={regRingerMode}
                      onChange={(e) => setRegRingerMode(e.target.value as any)}
                      className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                    >
                      <option value="sound">Sound (Full)</option>
                      <option value="vibrate">Vibrate Only</option>
                      <option value="silent">Silent</option>
                    </select>
                  </div>
                </div>

                {BIOMETRICS_ENABLED && (
                  <>
                {/* Biometrics Toggle for New Account */}
                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-lime-400" />
                    <span>Enroll Biometric Login on this device</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={regEnableBiometrics}
                    onChange={(e) => setRegEnableBiometrics(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-lime-500 focus:ring-0"
                  />
                </label>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition active:scale-98 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account & Enrolling...</span>
                  </>
                ) : (
                  <>
                    <span>Register & Open Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: JOIN A COMPANY */}
          {tab === 'join' && (
            <form onSubmit={handleJoinSubmit} autoComplete="off" className="space-y-3.5">
              <p className="text-[11px] text-zinc-400">
                Got an invite code from your team owner? Enter it below to join their company instead of creating a new one.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Invite Code:</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. K7Q2X9MZ"
                  maxLength={8}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono tracking-[0.25em] text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Full Name:</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  value={joinFullName}
                  onChange={(e) => setJoinFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Work Email:</label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Create Password:</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Backup PIN (optional):</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="4 digits"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono text-center tracking-[0.3em]"
                />
              </div>
              <p className="-mt-1 text-[10px] text-zinc-500">
                Your backup PIN unlocks the app if your fingerprint or face ever fails. Only you know it.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition active:scale-98 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Joining Company...</span>
                  </>
                ) : (
                  <>
                    <span>Join Company & Open Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-md mx-auto text-center text-[10px] text-zinc-600 font-mono py-2">
        RC Solutions Autonomous Telecommunications & Industrial Operations • Protected by Hardware Keystore
      </div>

      {/* Biometric Setup Modal */}
      <BiometricSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        currentUser={{
          id: 'temp',
          email: loginEmail,
          fullName: 'RC Solutions Operator',
          role: 'Operations Lead',
          avatar: '',
          organization: 'RC Solutions',
          authenticated: false
        }}
        onEnrollmentComplete={() => {
          handleBiometricsLogin();
        }}
      />
    </div>
  );
};
