import React, { useState } from 'react';
import { User, UserPreferences } from '../../types';
import { authService, SEED_USERS } from '../../services/authService';
import { useBiometrics } from '../../context/BiometricContext';
import { RCLogo } from '../RCLogo';
import { BiometricSetupModal } from '../biometrics/BiometricSetupModal';
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
  
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDemoAuthEnabled = import.meta.env?.VITE_ENABLE_DEMO_AUTH === 'true';

  // Sign In Form State - Secure empty defaults
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<User['role']>('Operations Lead');
  const [regOrganization, setRegOrganization] = useState('RC Solutions Enterprise');
  const [regIndustry, setRegIndustry] = useState('Commercial HVAC');
  const [regAutoDispatch, setRegAutoDispatch] = useState<'all' | 'critical' | 'manual'>('all');
  const [regRingerMode, setRegRingerMode] = useState<'sound' | 'vibrate' | 'silent'>('sound');
  const [regEnableBiometrics, setRegEnableBiometrics] = useState(true);

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

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await authService.loginWithGoogle();
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

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await authService.registerUser({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        organization: regOrganization,
        enableBiometrics: regEnableBiometrics,
        preferences: {
          industryProfile: regIndustry,
          autoDispatchThreshold: regAutoDispatch as any,
          ringerMode: regRingerMode,
          biometricsEnabled: regEnableBiometrics
        }
      });

      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSeedLogin = async (user: User) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const logged = await authService.loginWithEmail(user.email);
      onLoginSuccess(logged);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Quick login failed.');
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

        {/* PRIMARY AUTH OPTION 1: GOOGLE SIGN-IN */}
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

        {/* Demo Mode Security Banner if enabled */}
        {isDemoAuthEnabled && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono text-center font-bold">
            DEMO MODE - This is development data only
          </div>
        )}

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
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-bold">
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
          </div>

          {/* TAB 1: SIGN IN */}
          {tab === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Operator Email:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="operator@rcsolutions.com"
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
                  onClick={() => setErrorMsg('Enter your email and click Sign In to access your account.')}
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

              {/* Quick Preset Accounts (Only in Demo Mode) */}
              {isDemoAuthEnabled && (
                <div className="pt-2 border-t border-zinc-900">
                  <span className="text-[10px] text-amber-400 font-mono block mb-1.5 font-bold">
                    Quick Demo Accounts (Dev Only):
                  </span>
                  <div className="flex gap-2">
                    {SEED_USERS.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickSeedLogin(u)}
                        className="flex-1 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition cursor-pointer"
                      >
                        <div className="text-[11px] font-bold text-white truncate">{u.fullName}</div>
                        <div className="text-[9px] text-lime-400 font-mono truncate">{u.role}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: REGISTER ACCOUNT */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Full Name:</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Marcus Vance"
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
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="marcus@rcsolutions.com"
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
                  <label className="text-[10px] font-mono text-zinc-400">Operator Role:</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Operations Lead">Operations Lead</option>
                    <option value="Field Manager">Field Manager</option>
                    <option value="Field Technician">Field Technician</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="AI Specialist">AI Specialist</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400">Organization:</label>
                  <input
                    type="text"
                    value={regOrganization}
                    onChange={(e) => setRegOrganization(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  />
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
                      value={regIndustry}
                      onChange={(e) => setRegIndustry(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                    >
                      <option value="Commercial HVAC">Commercial HVAC</option>
                      <option value="Industrial Electrical">Industrial Electrical</option>
                      <option value="Smart Automation">Smart Automation</option>
                      <option value="Facilities & Energy">Facilities & Energy</option>
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
