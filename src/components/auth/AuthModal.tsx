import React, { useState } from 'react';
import { User } from '../../types';
import { authService } from '../../services/authService';
import { biometricService, BIOMETRICS_ENABLED } from '../../services/biometricService';
import { INDUSTRY_PRESETS, getStaffRolesForIndustry } from '../../data/presets';
import { Capacitor } from '@capacitor/core';
import { 
  Shield, 
  Lock, 
  Mail, 
  User as UserIcon, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Fingerprint, 
  LogOut, 
  X, 
  Building2 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'profile'>(
    currentUser?.authenticated ? 'profile' : 'login'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [industryId, setIndustryId] = useState('general_small_business');
  const roleOptions = getStaffRolesForIndustry(industryId);
  const [role, setRole] = useState<string>(roleOptions[0]);
  const [organization, setOrganization] = useState('RC Solutions Enterprise');
  const [rememberMe, setRememberMe] = useState(true);

  const handleIndustryChange = (presetId: string) => {
    setIndustryId(presetId);
    setRole(getStaffRolesForIndustry(presetId)[0]);
  };

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Stage 2 assembly (L5): one in-flight submit at a time — double-click /
  // double-Enter used to fire duplicate login/register calls.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Stage 2 assembly: hashless (Google-created) accounts cannot sign in
  // with email/password until a password is set. This inline form is the
  // entry point for authService.setLocalPassword — previously no UI
  // called it, so those accounts were stuck on native builds.
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // Real biometric state — never a hard-coded label. The kill switch
  // (BIOMETRICS_ENABLED, off since Oct 16, 2026) wins over stored
  // settings and enrollment: getSettings()/getEnrolledInfo() already
  // report the off state while it is off, and the switch is checked
  // explicitly here too, matching LoginView's pattern.
  const biometricUnlockActive =
    BIOMETRICS_ENABLED &&
    biometricService.getSettings().enabled &&
    biometricService.getEnrolledInfo().enrolled;

  if (!isOpen) return null;

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!email || !password) {
      setErrorMsg('Please enter email and password.');
      return;
    }
    setErrorMsg('');
    setShowSetPassword(false);
    setIsSubmitting(true);
    try {
      // Real sign-in: authService CHECKS the password. The old code
      // fabricated a signed-in user for any typed email, so anyone
      // could become any operator — including the RC Solutions owner —
      // and the app then loaded that company's data.
      const user = await authService.loginWithEmail(email, password);
      setSuccessMsg('Authentication successful!');
      setTimeout(() => {
        onLoginSuccess(user);
        setSuccessMsg('');
        onClose();
      }, 500);
    } catch (err: any) {
      const msg = err?.message || 'Sign-in failed. Please try again.';
      setErrorMsg(msg);
      // Hashless account: offer the set-a-password step inline instead of
      // leaving the user with no way forward.
      if (msg.includes('has no password yet')) setShowSetPassword(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await authService.setLocalPassword(email, newPassword);
      setShowSetPassword(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      setPassword('');
      setSuccessMsg('Password set — now sign in with it.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not set the password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    try {
      const user = await authService.loginWithGoogle();
      setSuccessMsg(`Welcome, ${user.fullName}!`);
      setTimeout(() => {
        onLoginSuccess(user);
        setSuccessMsg('');
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in was interrupted. Please try again.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!fullName || !email || !password) {
      setErrorMsg('Please complete all registration fields.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      // Real registration: salted password hash is stored, so the next
      // sign-in checks it. The old code fabricated an account with no
      // password at all.
      const user = await authService.registerUser({
        fullName,
        email,
        password,
        role,
        organization,
        preferences: { industryProfile: industryId },
      });
      setSuccessMsg('Account registered successfully!');
      setTimeout(() => {
        onLoginSuccess(user);
        setSuccessMsg('');
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
        
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 bg-black/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                RC Solutions Auth
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30 font-mono">
                  256-BIT SSL
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {mode === 'login' && 'Sign in to access RCOS System Controls'}
                {mode === 'register' && 'Create a new operator account'}
                {mode === 'profile' && 'Authenticated Operator Session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Status Banners */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-lime-950/60 border border-lime-500/50 text-lime-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW: AUTHENTICATED PROFILE CARD */}
          {mode === 'profile' && currentUser && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-zinc-900 to-black border border-lime-500/30 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.fullName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-lime-400"
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{currentUser.fullName}</h4>
                    <p className="text-xs text-zinc-400">{currentUser.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-400 border border-lime-500/30">
                        {currentUser.role}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">ID: {currentUser.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 space-y-2 text-xs text-zinc-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Organization:</span>
                    <span className="text-white font-sans">{currentUser.organization}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Last Authentication:</span>
                    <span className="text-lime-400">{currentUser.lastLogin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Session Security:</span>
                    <span className="text-zinc-400">Local session • Not server-verified</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Fingerprint className="w-4 h-4 text-lime-400" />
                    <span>Biometric Quick Unlock</span>
                  </div>
                  {biometricUnlockActive ? (
                    <span className="text-xs text-lime-400 font-bold">ACTIVE</span>
                  ) : (
                    <span className="text-xs text-zinc-500 font-bold">OFF</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  {biometricUnlockActive
                    ? 'TouchID / FaceID enabled for instant RCOS system access.'
                    : 'Biometric unlock is turned off. Sign in with your email and password.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out / End Session</span>
              </button>
            </div>
          )}

          {/* VIEW: LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Operator Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@rcsolutions.com"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:border-lime-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-300">System Password</label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white focus:border-lime-500 focus:outline-none font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                  />
                  <span>Keep Session Active</span>
                </label>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-lime-500/20 active:scale-98 cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSubmitting ? 'Signing in…' : 'Authenticate Operator'}</span>
                </button>

                {showSetPassword && (
                  <form onSubmit={handleSetPasswordSubmit} className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-xs font-bold text-amber-300">Set a password for {email}</p>
                    <p className="text-[11px] text-zinc-400">This account was created with Google sign-in and has no password yet. Set one to sign in with email and password.</p>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (at least 6 characters)"
                      className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-lime-500 focus:outline-none font-mono"
                      required
                    />
                    <input
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-lime-500 focus:outline-none font-mono"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting ? 'Setting password…' : 'Set Password'}
                    </button>
                  </form>
                )}

                {!Capacitor.isNativePlatform() && (
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn()}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-98"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
                )}

              </div>

              <div className="pt-2 border-t border-zinc-800/80 text-center text-xs text-zinc-400">
                Need a new operator account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-lime-400 font-bold hover:underline cursor-pointer"
                >
                  Register Account
                </button>
              </div>
            </form>
          )}

          {/* VIEW: REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} autoComplete="off" className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    autoComplete="off"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Industry</label>
                <select
                  value={industryId}
                  onChange={(e) => handleIndustryChange(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl p-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                >
                  {INDUSTRY_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@rcsolutions.com"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 block">Operator Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 block">Organization</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-zinc-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="RC Solutions"
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-2 py-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-lime-500 focus:outline-none font-mono"
                    required
                  />
                </div>
                {password && (
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 block font-mono">
                      Security Strength: <strong className="text-white">{strength.label}</strong>
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-lime-500/20 mt-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? 'Creating account…' : 'Create Registered Account'}
              </button>

              <div className="pt-2 text-center text-xs text-zinc-400">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-lime-400 font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Password recovery was removed (audit H13): the old flow sent
              no email, accepted any 4+ digit code, showed false success,
              and never changed the password. No recovery UI ships until a
              real emailed-reset flow exists — never show success without
              a confirmed change. */}
        </div>
      </div>
    </div>
  );
};
