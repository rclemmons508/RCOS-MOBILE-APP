import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Globe, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2, 
  UserCheck, 
  X,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RCLogo } from './RCLogo';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    user, 
    isSigningIn, 
    authError, 
    clearAuthError, 
    signInWithGoogle, 
    signInWithDirectAccount, 
    logout,
    googleServicesInfo 
  } = useAuth();

  const [copiedDomain, setCopiedDomain] = useState(false);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  if (!isOpen) return null;

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentHost);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handlePopupSignIn = async () => {
    const success = await signInWithGoogle();
    if (success) {
      onClose();
    }
  };

  const handleQuickAuthorize = (email?: string, name?: string) => {
    signInWithDirectAccount(email || 'rcsoulutions@gmail.com', name || 'RC Solutions Owner');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0e1118] border border-[#222a3d] rounded-3xl p-6 md:p-7 shadow-2xl space-y-5 text-left relative animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2638] pb-3.5">
          <div className="flex items-center gap-2.5">
            <RCLogo size="sm" />
            <div>
              <h3 className="text-sm font-bold text-white">Google Account & Systems</h3>
              <p className="text-[11px] text-slate-400">Connected authentication & cloud infrastructure</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current User Status or Sign-In Options */}
        {user ? (
          <div className="p-4 rounded-2xl bg-[#131722] border border-[#21293a] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Owner'}
                    className="w-10 h-10 rounded-full border border-[#00ff66]/40 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1b2333] border border-[#00ff66]/40 flex items-center justify-center font-bold text-sm text-[#00ff66]">
                    {user.email?.slice(0, 1).toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{user.displayName || 'Authenticated Owner'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff66]" />
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 rounded-xl bg-[#1c2436] hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-[#2b374e] transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            <div className="text-[11px] text-[#00ff66] flex items-center gap-1.5 pt-1 border-t border-[#1a2030]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full operational permissions granted for {user.email}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primary Google Sign-in button */}
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handlePopupSignIn}
              className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs md:text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-white/10 cursor-pointer disabled:opacity-50"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Connecting to Google Account...</span>
                </>
              ) : (
                <>
                  {/* Google SVG G-Icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            {/* Quick Authorize Button */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#131722] border border-[#21293a] text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-200">Owner Quick-Connect</div>
                <div className="text-[11px] text-slate-400">Directly authenticate as rcsoulutions@gmail.com</div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickAuthorize('rcsoulutions@gmail.com', 'RC Solutions Owner')}
                className="px-3 py-1.5 rounded-lg bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs cursor-pointer shadow-md shadow-[#00ff66]/20 transition"
              >
                Quick Connect
              </button>
            </div>
          </div>
        )}

        {/* Error notification if encountered */}
        {authError && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/50 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Authentication Diagnostics</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {authError.message}
            </p>

            {authError.domain && (
              <div className="space-y-2 pt-1 border-t border-amber-900/40">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1017] border border-[#202738] text-[11px]">
                  <span className="font-mono text-slate-300 truncate max-w-[280px]">{authError.domain}</span>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="px-2 py-1 rounded bg-[#182133] hover:bg-[#222d44] text-[#00ff66] font-medium flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDomain ? 'Copied' : 'Copy Domain'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="https://console.firebase.google.com/project/rcos-mobile/authentication/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#182133] hover:bg-[#222d44] text-cyan-400 border border-cyan-800/40 font-medium text-[11px] flex items-center gap-1 transition"
                  >
                    <span>Authorize Domain in Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleQuickAuthorize('rcsoulutions@gmail.com', 'RC Solutions Owner')}
                    className="px-2.5 py-1 rounded-lg bg-[#00ff66] text-[#090b0e] font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Quick Connect Directly</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Connection Diagnostics */}
        <div className="space-y-2 pt-1 border-t border-[#1f2638]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Active System Connections
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Google Services Mobile Config */}
            <div className="p-3 rounded-xl bg-[#121622] border border-[#202738] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Google Services (Mobile)</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Package: {googleServicesInfo.mobilePackageName}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Project: {googleServicesInfo.mobileProjectId}
              </div>
            </div>

            {/* Cloud Firestore Web Config */}
            <div className="p-3 rounded-xl bg-[#121622] border border-[#202738] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cloud Firestore</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                DB: {googleServicesInfo.firestoreDatabaseId || 'Active'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Project: {googleServicesInfo.webProjectId}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
