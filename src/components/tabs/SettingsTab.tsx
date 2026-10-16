import React, { useState, useEffect, useRef } from 'react';
import { AutomationTask, NotificationPreferences, User, IndustryOptimizationSuggestion, BusinessAccount, BusinessMember, TeamInvite } from '../../types';
import { BiometricSettingsCard } from '../biometrics/BiometricSettingsCard';
import { userPreferencesService } from '../../services/userPreferencesService';
import { getAutomationLog, AutomationLogEntry } from '../../utils/automationLog';
import { timeAgoShort, describeFollowupWindow } from '../../utils/automation';
import { asText, asScore, asStringList } from '../../utils/safeRender';
import { FOLLOWUP_META, isFollowupRuleId } from '../../utils/followups';
import { DiagnosticsPanel } from '../diagnostics/DiagnosticsPanel';
import { TrainingChecklist } from '../training/TrainingChecklist';
import { employeeCustomizationService, CustomAIEmployee } from '../../services/employeeCustomizationService';
import { EmployeeJobCustomizerModal } from '../employees/EmployeeJobCustomizerModal';
import { haptic } from '../../utils/haptics';
import { deleteAccount, isReauthRequired } from '../../services/accountDeletionService';
import { teamService } from '../../services/teamService';
import { apiFetch } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { biometricService } from '../../services/biometricService';
import { DEFAULT_PROFILE_PICTURES, defaultPictureDataUrl, downscaleImageFile, resolveProfilePicture } from '../../utils/profilePicture';
import { 
  Settings2, 
  Plus, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  Bot, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Bell, 
  Moon, 
  Sparkles, 
  Activity, 
  Sliders, 
  ShieldAlert,
  Check,
  User as UserIcon,
  LogOut,
  Building2,
  Phone,
  Clock,
  Briefcase,
  Users,
  HardDrive,
  RefreshCw,
  Trash2,
  Edit3,
  Layers,
  ShieldCheck,
  SmartphoneNfc,
  Wrench,
  ArrowRight,
  X,
  History,
  MessageSquare,
  Copy,
  UserPlus,
} from 'lucide-react';

 /** Values from the Settings → My Profile editor. */
export interface ProfileUpdate {
  fullName: string;
  phone: string;
  contactEmail: string;
  profilePicture: string;
}

interface SettingsTabProps {
  currentUser?: User | null;
  businessId?: string;
  business?: BusinessAccount | null;
  onUpdateProfile?: (profile: ProfileUpdate) => Promise<void>;
  onLogout?: () => void;
  automationTasks: AutomationTask[];
  onToggleAutomation: (taskId: string, isAutomated: boolean) => void;
  onPauseAutomation: (taskId: string, paused: boolean) => void;
  onResetAutomation: (taskId: string) => void;
  onUpdateAutomationTemplate?: (taskId: string, template: string) => void;
  onUpdateAutomationReviewLink?: (taskId: string, link: string) => void;
  automationMasterOn: boolean;
  onToggleMaster: (on: boolean) => void;
  conditionalLogicOn: boolean;
  onToggleConditionalLogic: (on: boolean) => void;
  industryModifierOn: boolean;
  onToggleIndustryModifier: (on: boolean) => void;
  industryName?: string;
  onAddCustomTask: (task: AutomationTask) => void;
  aiAssistantEnabled: boolean;
  onToggleAiAssistant: () => void;
  industryProfile: string;
  onUpdateIndustry: (industry: string) => void;
  autoDispatchThreshold: 'all' | 'critical' | 'high' | 'manual';
  onUpdateAutoDispatchThreshold: (threshold: 'all' | 'critical' | 'high' | 'manual') => void;
  notifPreferences: NotificationPreferences;
  onUpdateNotifPreferences: (prefs: NotificationPreferences) => void;
  onTriggerTestPush: () => void;
  onOpenNotifPrefsModal: () => void;
  onReopenOnboarding?: () => void;
  onOpenServiceManager?: () => void;
  businessServices?: string[];
  proactiveSuggestion?: IndustryOptimizationSuggestion | null;
  onReviewSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  /** Open the Team Chat screen. */
  onOpenTeamChat?: () => void;
  /** Leave the team (members only) — the app signs the user out after. */
  onLeaveTeam?: () => Promise<void>;
  /** Section to show on first render. Defaults to 'user'. The caller remounts on navigation. */
  initialSection?: 'user' | 'agents' | 'device';
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  businessId,
  business,
  onUpdateProfile,
  onLogout,
  automationTasks,
  onToggleAutomation,
  onPauseAutomation,
  onResetAutomation,
  onUpdateAutomationTemplate,
  onUpdateAutomationReviewLink,
  automationMasterOn,
  onToggleMaster,
  conditionalLogicOn,
  onToggleConditionalLogic,
  industryModifierOn,
  onToggleIndustryModifier,
  industryName,
  onAddCustomTask,
  aiAssistantEnabled,
  onToggleAiAssistant,
  industryProfile,
  onUpdateIndustry,
  autoDispatchThreshold,
  onUpdateAutoDispatchThreshold,
  notifPreferences,
  onUpdateNotifPreferences,
  onTriggerTestPush,
  onOpenNotifPrefsModal,
  onReopenOnboarding,
  onOpenServiceManager,
  businessServices = [],
  proactiveSuggestion,
  onReviewSuggestion,
  onDismissSuggestion,
  onOpenTeamChat,
  onLeaveTeam,
  initialSection,
}) => {
  // Navigation: 3 clean client-facing sections
  const [activeSection, setActiveSection] = useState<'user' | 'agents' | 'device'>(initialSection ?? 'user');
  const [fireLog] = useState<AutomationLogEntry[]>(() => getAutomationLog());

  // User & Company Profile State (multi-company support)
  const [companyName, setCompanyName] = useState(currentUser?.organization || 'Apex Commercial Systems');
  const [companyPhone, setCompanyPhone] = useState('(555) 302-8491');
  const [dispatchEmail, setDispatchEmail] = useState(currentUser?.email || 'dispatch@company.com');
  const [is24x7Emergency, setIs24x7Emergency] = useState(true);

  // ---- My Profile (editable name, contact info, profile picture) ----
  const [profileName, setProfileName] = useState(currentUser?.fullName || '');
  const [profilePhone, setProfilePhone] = useState(business?.contactPhone || '');
  const [profileContactEmail, setProfileContactEmail] = useState(business?.contactEmail || '');
  const [profilePicture, setProfilePicture] = useState(business?.profilePicture || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileFileRef = useRef<HTMLInputElement | null>(null);
  // When a different account/business loads, reset the form to its values.
  useEffect(() => {
    setProfileName(currentUser?.fullName || '');
    setProfilePhone(business?.contactPhone || '');
    setProfileContactEmail(business?.contactEmail || '');
    setProfilePicture(business?.profilePicture || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id, currentUser?.email]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { setProfileError('Please enter your name.'); return; }
    if (profileContactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileContactEmail.trim())) {
      setProfileError('That contact email does not look right.');
      return;
    }
    if (!onUpdateProfile) { setProfileError('Profile saving is not available right now.'); return; }
    setProfileSaving(true);
    setProfileError(null);
    try {
      await onUpdateProfile({
        fullName: profileName.trim(),
        phone: profilePhone.trim(),
        contactEmail: profileContactEmail.trim(),
        profilePicture,
      });
      showToast('Profile saved!');
    } catch (e: any) {
      setProfileError(e?.message || 'Could not save your profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfilePhotoFile = async (file: File | null) => {
    if (!file) { biometricService.clearFilePickerFlag(); return; }
    try {
      const dataUrl = await downscaleImageFile(file);
      setProfilePicture(dataUrl);
      setProfileError(null);
      showToast('Photo chosen — tap Save profile to keep it.');
    } catch (e: any) {
      setProfileError(e?.message || 'Could not use that photo.');
    } finally {
      biometricService.clearFilePickerFlag();
    }
  };

  // App Agents State
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'supervised'>('autonomous');
  const [agentTone, setAgentTone] = useState<'strategic' | 'customer' | 'technical'>('strategic');
  const [customEmployees, setCustomEmployees] = useState<CustomAIEmployee[]>(() =>
    employeeCustomizationService.getEmployees()
  );
  const [selectedEmployeeForCustomizer, setSelectedEmployeeForCustomizer] = useState<CustomAIEmployee | null>(null);

  // Custom Task Modal State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Device & Display State
  const [themeMode, setThemeMode] = useState<'oled' | 'dark' | 'slate'>('oled');
  const [compactDensity, setCompactDensity] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onAddCustomTask({
      id: `task-custom-${Date.now()}`,
      name: newTaskName,
      description: newTaskDescription || 'Automated client operations workflow step',
      isAutomated: true,
      isCustom: true,
    });
    setNewTaskName('');
    setNewTaskDescription('');
    setIsAddingTask(false);
    showToast('Custom automation rule activated!');
  };

  const ringerMode = notifPreferences.ringerMode || (
    !notifPreferences.soundEnabled && !notifPreferences.vibrationEnabled ? 'silent' :
    !notifPreferences.soundEnabled ? 'vibrate' : 'sound'
  );

  const handleClearCache = () => {
    // Clean temporary operational cache
    try {
      sessionStorage.clear();
      setCacheCleared(true);
      showToast('Temporary query cache cleared safely!');
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      showToast('Cache cleared.');
    }
  };

  // ---- Delete Account (Danger Zone) ----
  // Two-step: warning screen, then type DELETE to enable the final button.
  // Server delete first; local data is only wiped after the server confirms.
  const [deleteStep, setDeleteStep] = useState<'idle' | 'warn' | 'confirm' | 'done'>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---- Team (people on this company account) ----
  const [teamMembers, setTeamMembers] = useState<BusinessMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [teamIsOwner, setTeamIsOwner] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCreated, setInviteCreated] = useState<TeamInvite | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const teamBackfilledRef = useRef(false);

  const loadTeam = async () => {
    if (!businessId || !currentUser?.email) return;
    try {
      const roster = await teamService.getTeam(businessId, currentUser.email);
      setTeamMembers(roster.members || []);
      setTeamInvites(roster.invites || []);
      setTeamIsOwner(roster.isOwner);
      // A company created before teams existed has no member list yet.
      // The first time its owner opens Team, record them as the owner so
      // invites work. Members always arrive with a list, so this only
      // ever runs for the creator.
      // Backfill guard (Oct 16, 2026): an empty roster does NOT prove the
      // current user is the creator — the roster is empty on restored
      // businesses too, and backfilling a member as owner let a test
      // account wipe the whole business from the Danger Zone. Only
      // backfill when the user matches an owner identity on the business
      // record (contact email / owner email / owner id), or when the
      // record has no owner identity at all (legacy, nobody to protect).
      const ownerIdentities = [
        (business?.contactEmail || '').toLowerCase(),
        ((business as unknown as { ownerEmail?: string } | null)?.ownerEmail || '').toLowerCase(),
      ].filter(Boolean);
      const matchesOwnerIdentity =
        ownerIdentities.length === 0 ||
        ownerIdentities.includes((currentUser?.email || '').toLowerCase()) ||
        (!!business?.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === currentUser?.id);
      if ((roster.members || []).length === 0 && !teamBackfilledRef.current && matchesOwnerIdentity) {
        teamBackfilledRef.current = true;
        const ownerMember: BusinessMember = {
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.fullName,
          role: 'owner',
          avatar: currentUser.avatar,
          joinedAt: new Date().toISOString()
        };
        await apiFetch(`/api/business/${businessId}`, {
          method: 'PUT',
          body: JSON.stringify({ members: [ownerMember] })
        }).catch(() => null);
        setTeamMembers([ownerMember]);
        setTeamIsOwner(true);
      }
    } catch (e: any) {
      setTeamError(e?.message || 'Could not load the team.');
    }
  };

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const handleCreateInvite = async () => {
    if (!businessId || !currentUser?.email) return;
    setInviteBusy(true);
    setTeamError(null);
    setInviteCreated(null);
    setCopiedCode(false);
    try {
      const invite = await teamService.createInvite(businessId, currentUser.email, inviteEmail.trim());
      setInviteCreated(invite);
      setInviteEmail('');
      await loadTeam();
    } catch (e: any) {
      setTeamError(e?.message || 'Could not create that invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
    } catch { /* clipboard unavailable — the code is shown on screen */ }
  };

  const handleRevokeInvite = async (code: string) => {
    if (!businessId || !currentUser?.email) return;
    try {
      await teamService.revokeInvite(businessId, currentUser.email, code);
      await loadTeam();
    } catch (e: any) {
      setTeamError(e?.message || 'Could not cancel that invite.');
    }
  };

  const handleRemoveMember = async (memberEmail: string) => {
    if (!businessId || !currentUser?.email) return;
    try {
      await teamService.removeMember(businessId, currentUser.email, memberEmail);
      setRemoveTarget(null);
      await loadTeam();
    } catch (e: any) {
      setTeamError(e?.message || 'Could not remove that person.');
    }
  };

  const handleLeaveTeam = async () => {
    if (!onLeaveTeam) return;
    setLeavingTeam(true);
    setLeaveError(null);
    try {
      await onLeaveTeam();
    } catch (e: any) {
      setLeaveError(e?.message || 'Could not leave the team.');
      setLeavingTeam(false);
    }
  };
  // Google-only sign-ins have no password, so no password field is shown for them.
  // Everyone else must type their account password — it is checked before
  // anything is deleted, so a deleted account can never come back.
  const deleteNeedsPassword = !auth.currentUser
    || auth.currentUser.providerData.some((p) => p.providerId === 'password');

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE' || deleteDeleting) return;
    if (deleteNeedsPassword && !deletePassword) {
      setDeleteError('Please type your account password to confirm deletion.');
      return;
    }
    setDeleteDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(businessId || '', { password: deletePassword });
      setDeletePassword('');
      setDeleteStep('done');
      // Reload to a clean login screen — guarantees no stale in-memory data.
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      if (isReauthRequired(err)) {
        setDeleteError('Your sign-in is too old for this step. Please log out, log back in, then try deleting again.');
      } else {
        setDeleteError(err?.message || 'Could not delete the account. Please try again.');
      }
      // Stay on the confirm screen so the owner can retry. Local data is untouched.
    } finally {
      setDeleteDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-extrabold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 shrink-0">
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">App Settings & Controls</h2>
            <p className="text-xs text-zinc-400 truncate">Multi-Company, AI Agents & Device Configuration</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNotifPrefsModal}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Bell className="w-3.5 h-3.5 text-lime-400" />
          <span>Alerts</span>
        </button>
      </div>

      {/* 3-Section Segmented Navigation Bar */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs font-bold shadow-md">
        <button
          type="button"
          onClick={() => setActiveSection('user')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'user'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <UserIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">User & Org</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('agents')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'agents'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">AI Agents</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('device')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'device'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Device</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: USER & COMPANY SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'user' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Current Operator Profile Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Logged In Operator
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono font-bold uppercase">
                Active Session
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                  alt="Operator"
                  className="w-12 h-12 rounded-2xl object-cover border border-lime-500/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {currentUser?.fullName || 'Lead Operator'}
                  </div>
                  <div className="text-xs text-lime-400 font-mono">
                    {currentUser?.role || 'Operations Lead'}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">
                    {currentUser?.email || 'rcsoulutions@gmail.com'}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Log Out of this account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>

          {/* My Profile — editable name, contact info, profile picture */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3.5">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-lime-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">My Profile</h3>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={resolveProfilePicture(profilePicture, currentUser?.avatar || '')}
                alt="Your profile picture"
                className="w-16 h-16 rounded-2xl object-cover border border-lime-500/50 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs text-white font-bold truncate">{profileName || 'Your name'}</p>
                <p className="text-[11px] text-zinc-400">Pick a picture or upload your own photo.</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-zinc-400 font-mono mb-1.5">Choose a picture:</p>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_PROFILE_PICTURES.map((pic) => {
                  const value = `default:${pic.id}`;
                  const selected = profilePicture === value;
                  return (
                    <button
                      key={pic.id}
                      type="button"
                      title={pic.label}
                      onClick={() => { setProfilePicture(value); setProfileError(null); }}
                      className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition cursor-pointer ${selected ? 'border-lime-400' : 'border-transparent'}`}
                    >
                      <img src={defaultPictureDataUrl(pic.id)} alt={pic.label} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { biometricService.notifyFilePickerOpened(); profileFileRef.current?.click(); }}
                  className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-200 transition cursor-pointer"
                >
                  Upload a photo
                </button>
              </div>
              <input
                ref={profileFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; handleProfilePhotoFile(f); }}
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Full name:</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Phone:</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Contact email:</label>
                <input
                  type="email"
                  value={profileContactEmail}
                  onChange={(e) => setProfileContactEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">This is the email customers see. Your login email stays the same.</p>
              </div>
            </div>

            {profileError && <p className="text-xs text-red-300">{profileError}</p>}
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold text-black transition cursor-pointer"
            >
              {profileSaving ? 'Saving…' : 'Save profile'}
            </button>
          </div>

          {/* Company Profile (Multi-Company Configuration) */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Company / Organization Profile
                </h3>
              </div>
              {onReopenOnboarding && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    onReopenOnboarding();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Re-detect Industry</span>
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Company Business Name:</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Mechanical Systems"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono block mb-0.5">Active Industry:</label>
                    <div className="text-xs font-bold text-lime-400 truncate">{industryProfile}</div>
                  </div>
                  {onReopenOnboarding && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic.light();
                        onReopenOnboarding();
                      }}
                      className="mt-1.5 text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 font-mono transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-lime-400" />
                      <span>Re-tune with AI</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono block mb-1">Dispatch Hotline Phone:</label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="(555) 302-8491"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Work Order Routing Email:</label>
                <input
                  type="email"
                  value={dispatchEmail}
                  onChange={(e) => setDispatchEmail(e.target.value)}
                  placeholder="dispatch@company.com"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              {/* Service Catalog & Proactive AI Monitor Card */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-lime-400" />
                    <span className="text-xs font-bold text-white">Offered Services & Capabilities</span>
                  </div>
                  {onOpenServiceManager && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic.light();
                        onOpenServiceManager();
                      }}
                      className="px-2 py-1 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Manage Services</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {(asStringList(businessServices).length > 0 ? asStringList(businessServices) : ['General Commercial Services']).map((svc, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                      {svc}
                    </span>
                  ))}
                </div>

                {/* Proactive AI Industry Suggestion Inside Settings */}
                {proactiveSuggestion && onReviewSuggestion && (
                  <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-lime-500/15 via-emerald-500/10 to-zinc-900/40 border border-lime-500/40 animate-in fade-in duration-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded-lg bg-lime-500/20 text-lime-400 shrink-0 mt-0.5">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-extrabold text-white">
                              AI Monitor Optimization Available
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-400 font-mono font-bold">
                              {Math.round(asScore(proactiveSuggestion.confidence) || 95)}% Match
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-300 mt-0.5 leading-snug">
                            Services indicate specialized <strong className="text-lime-300">{asText(proactiveSuggestion.suggestedPresetName)}</strong> workflows rather than current profile.
                          </p>
                        </div>
                      </div>
                      {onDismissSuggestion && (
                        <button
                          type="button"
                          onClick={() => {
                            haptic.light();
                            onDismissSuggestion();
                          }}
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition"
                          title="Dismiss suggestion"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-lime-500/20 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          onReviewSuggestion();
                        }}
                        className="px-3 py-1 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer shadow-sm shadow-lime-500/20"
                      >
                        <span>Review & Upgrade Preset</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-zinc-500 italic">
                  AI Context Monitor automatically suggests optimized industry presets as you add or alter services.
                </p>
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-white block">24/7 Emergency Dispatch Readiness</span>
                  <span className="text-[10px] text-zinc-400">Routes off-hours voice AI calls directly to emergency on-call technicians</span>
                </div>
                <input
                  type="checkbox"
                  checked={is24x7Emergency}
                  onChange={(e) => setIs24x7Emergency(e.target.checked)}
                  className="rounded bg-black border-zinc-700 text-lime-500 focus:ring-0 shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Team — people on this company account */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Team</h3>
              </div>
              {onOpenTeamChat && businessId && (
                <button
                  type="button"
                  onClick={onOpenTeamChat}
                  className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Team Chat</span>
                </button>
              )}
            </div>

            {!businessId && (
              <p className="text-xs text-zinc-400">Finish setting up your company first, then you can invite your team.</p>
            )}
            {teamError && (
              <p className="text-xs text-red-300">{teamError}</p>
            )}

            {/* Member list */}
            {teamMembers.length > 0 && (
              <div className="space-y-1.5">
                {teamMembers.map(m => {
                  const isMe = m.email.toLowerCase() === (currentUser?.email || '').toLowerCase();
                  return (
                    <div key={m.email.toLowerCase()} className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="w-8 h-8 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                        {(m.name || m.email || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {m.name} {isMe && <span className="text-lime-400">(You)</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">{m.email}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${m.role === 'owner' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                        {m.role === 'owner' ? 'Owner' : 'Team member'}
                      </span>
                      {teamIsOwner && !isMe && m.role !== 'owner' && (
                        removeTarget === m.email.toLowerCase() ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.email)}
                            className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            Remove?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(m.email.toLowerCase())}
                            className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Owner: invite form */}
            {teamIsOwner && businessId && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-lime-400" />
                  <span>Invite someone to your team</span>
                </p>
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Their email (optional — leave empty for anyone with the code)"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-lime-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateInvite}
                    disabled={inviteBusy}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white transition cursor-pointer shrink-0"
                  >
                    {inviteBusy ? 'Making…' : 'Make invite code'}
                  </button>
                </div>
                {inviteCreated && (
                  <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/30 space-y-1.5">
                    <p className="text-xs text-zinc-300">Share this code with your team member. They enter it on the Join a Company screen.</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-lg tracking-[0.25em] text-lime-300">{inviteCreated.code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(inviteCreated.code)}
                        className="px-2 py-1 rounded-lg bg-zinc-800 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {inviteCreated.email ? `Only ${inviteCreated.email} can use it. ` : ''}It works for 7 days and can only be used once.
                    </p>
                  </div>
                )}
                {teamInvites.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-zinc-400">Waiting invites</p>
                    {teamInvites.map(inv => (
                      <div key={inv.code} className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                        <span className="font-mono font-bold text-xs text-white tracking-widest">{inv.code}</span>
                        <span className="text-[11px] text-zinc-400 flex-1 truncate">{inv.email || 'Anyone with the code'}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0">Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.code)}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Member: leave the team */}
            {!teamIsOwner && businessId && onLeaveTeam && (
              <div className="pt-1 space-y-2">
                <p className="text-xs text-zinc-400">You are on this team as a team member. Leaving removes you from the company and signs you out.</p>
                {leaveError && <p className="text-xs text-red-300">{leaveError}</p>}
                <button
                  type="button"
                  onClick={handleLeaveTeam}
                  disabled={leavingTeam}
                  className="px-3 py-2 rounded-xl bg-transparent hover:bg-red-500/10 border border-red-800 text-xs font-bold text-red-400 transition cursor-pointer"
                >
                  {leavingTeam ? 'Leaving…' : 'Leave team'}
                </button>
              </div>
            )}
          </div>

          {/* Biometric Access & Device Keystore */}
          <BiometricSettingsCard currentUser={currentUser} />
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: APP AGENTS SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'agents' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Autonomy Mode Selector */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Multi-Agent Autonomy Mode
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Operations Policy</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('autonomous');
                  showToast('Autonomy Mode: Full Autonomous active');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  autonomyMode === 'autonomous'
                    ? 'bg-lime-500/10 border-lime-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Autonomous</span>
                  <Zap className="w-3.5 h-3.5 text-lime-400" />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Agents route calls, draft quotes, and assign technicians automatically within business thresholds.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('supervised');
                  showToast('Autonomy Mode: Supervised Approval active');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  autonomyMode === 'supervised'
                    ? 'bg-lime-500/10 border-lime-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Supervised</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[10px] text-zinc-400">
                  All job assignments, client invoices, and emergency dispatches require operator 1-tap approval.
                </p>
              </button>
            </div>
          </div>

          {/* Auto-Dispatch Threshold */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-lime-400" />
                <span>Job Auto-Dispatch Threshold</span>
              </span>
              <span className="text-[10px] text-lime-400 font-mono font-bold uppercase">
                Active: {autoDispatchThreshold}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('all')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'all'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>All Work Orders</div>
                <div className="text-[10px] text-zinc-500">Auto-routes all incoming requests</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('critical')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'critical'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>Critical Emergency Only</div>
                <div className="text-[10px] text-zinc-500">Only dispatches priority outages</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('high')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'high'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>High Priority + Urgent</div>
                <div className="text-[10px] text-zinc-500">Priority and critical tiers</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('manual')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'manual'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>Manual Approval Only</div>
                <div className="text-[10px] text-zinc-500">Operators manually assign all</div>
              </button>
            </div>
          </div>

          {/* Agent Communication Persona */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-lime-400" />
              <span>Voice AI & Chat Agent Tone</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAgentTone('strategic')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'strategic'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Crisp & Strategic</div>
                <div className="text-[9px] text-zinc-500">Direct executive style</div>
              </button>

              <button
                type="button"
                onClick={() => setAgentTone('customer')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'customer'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Customer-Centric</div>
                <div className="text-[9px] text-zinc-500">Warm & reassuring</div>
              </button>

              <button
                type="button"
                onClick={() => setAgentTone('technical')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'technical'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Technical Diagnostic</div>
                <div className="text-[9px] text-zinc-500">Engineering codes</div>
              </button>
            </div>
          </div>

          {/* AI Employee Fleet & Job Customization */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  AI Employee Fleet & Job Roles ({customEmployees.length})
                </h3>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">1-Tap Customizer</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Customize job responsibilities, operational boundaries, and escalation triggers for each AI specialist:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {customEmployees.slice(0, 8).map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeForCustomizer(emp)}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-lime-500/40 transition cursor-pointer text-left flex items-center justify-between gap-2.5 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white group-hover:text-lime-300 transition-colors truncate">
                      {emp.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {emp.roleTitle}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                      Autonomy: <span className="text-lime-400">{emp.autonomyLevel || 'autonomous'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployeeForCustomizer(emp);
                    }}
                    className="px-2 py-1 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 text-[10px] font-bold border border-lime-500/30 shrink-0 cursor-pointer"
                  >
                    Edit Job
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Automated Workflow Tasks & Rules */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Automated Workflow Rules
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="px-2 py-1 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Rule</span>
              </button>
            </div>

            {/* Master automation switch */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-lime-500/30 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-lime-400" />
                    Automation Engine
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {automationMasterOn
                      ? 'Live — your rules are running.'
                      : 'Paused — nothing will fire until you turn it back on.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleMaster(!automationMasterOn)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationMasterOn ? 'bg-lime-500' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                      automationMasterOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Automation Task List with Start / Pause / Resume / Reset */}
            <div className="space-y-2">
              {automationTasks.map((task) => {
                const live = automationMasterOn && task.isAutomated && !task.paused;
                return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl bg-zinc-900/60 border ${live ? 'border-zinc-800/80' : 'border-zinc-800/40 opacity-70'} space-y-2`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span>{task.name}</span>
                        {task.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                            CUSTOM
                          </span>
                        )}
                        {live && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-bold">
                            RUNNING
                          </span>
                        )}
                        {task.isAutomated && task.paused && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                            PAUSED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {task.description}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        Ran {task.runCount || 0}× • last {timeAgoShort(task.lastFiredAt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleAutomation(task.id, !task.isAutomated)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        task.isAutomated ? 'bg-lime-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                          task.isAutomated ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {task.paused ? (
                      <button
                        type="button"
                        disabled={!task.isAutomated}
                        onClick={() => onPauseAutomation(task.id, false)}
                        className="px-2.5 py-1 rounded-lg bg-lime-500/10 text-lime-300 border border-lime-500/30 text-[10px] font-bold disabled:opacity-40"
                      >
                        Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!task.isAutomated}
                        onClick={() => onPauseAutomation(task.id, true)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold disabled:opacity-40"
                      >
                        Pause
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onResetAutomation(task.id)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold"
                    >
                      Reset stats
                    </button>
                  </div>

                  {isFollowupRuleId(task.id) && (
                    <div className="space-y-2 pt-1">
                      <label className="block">
                        <span className="text-[10px] font-bold text-zinc-400">Message text — use {'{firstName}'}, {'{businessName}'}{task.id === 'rule-review' ? ', {reviewLink}' : ''}</span>
                        <textarea
                          value={task.messageTemplate || FOLLOWUP_META[task.id as 'rule-welcome' | 'rule-missed-call' | 'rule-review'].defaultTemplate}
                          onChange={(e) => onUpdateAutomationTemplate?.(task.id, e.target.value)}
                          rows={3}
                          autoComplete="off"
                          className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime-500"
                        />
                      </label>
                      {task.id === 'rule-review' && (
                        <label className="block">
                          <span className="text-[10px] font-bold text-zinc-400">Review link (your Google review page — pasted into the message)</span>
                          <input
                            type="url"
                            value={task.reviewLink || ''}
                            onChange={(e) => onUpdateAutomationReviewLink?.(task.id, e.target.value)}
                            placeholder="https://g.page/r/…"
                            autoComplete="off"
                            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime-500"
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => onUpdateAutomationTemplate?.(task.id, FOLLOWUP_META[task.id as 'rule-welcome' | 'rule-missed-call' | 'rule-review'].defaultTemplate)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold"
                      >
                        Reset message to default
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Smart timing (conditional logic) + Industry pacing (industry modifier) */}
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">Smart timing</div>
                  <div className="text-[10px] text-zinc-400">
                    Hold non-urgent automations during your quiet hours. Emergencies always fire.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleConditionalLogic(!conditionalLogicOn)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    conditionalLogicOn ? 'bg-lime-500' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                      conditionalLogicOn ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">Industry pacing</div>
                  <div className="text-[10px] text-zinc-400">
                    Follow-up timing matches your trade's pace. Now: {describeFollowupWindow(industryName, industryModifierOn)}.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleIndustryModifier(!industryModifierOn)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    industryModifierOn ? 'bg-lime-500' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                      industryModifierOn ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Custom Rule Creation Form */}
            {isAddingTask && (
              <form onSubmit={handleAddTask} className="p-3 rounded-xl bg-black border border-lime-500/50 space-y-2 mt-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-lime-400" />
                  <span>New Company Automation Rule</span>
                </div>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g., Auto-send client invoice upon tech check-out"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                />
                <input
                  type="text"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Description of automated action"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-lime-500 text-black font-bold text-xs cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

          {/* Recently Fired — automation activity log */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-lime-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Recently Fired
              </h3>
            </div>
            {fireLog.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                No automations have fired yet. When a rule runs, it will show up here.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fireLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{entry.ruleName}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{entry.detail}</div>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                      {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostics — RCOS Master Dashboard spec */}
          <DiagnosticsPanel />

          {/* Training — RCOS onboarding funnel spec */}
          <TrainingChecklist />

      {/* ============================================================== */}
      {/* SECTION 3: TYPICAL DEVICE SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'device' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Device Alert & Ringer Profile */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span>Device Alert & Audio Profile</span>
              </span>
              <span className="text-[10px] text-lime-400 font-mono font-bold uppercase">
                Mode: {ringerMode}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'sound',
                    soundEnabled: true,
                    vibrationEnabled: true
                  });
                  showToast('Ringer Mode: Full Audio enabled');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'sound'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Volume2 className="w-5 h-5" />
                <span className="text-[11px]">Sound</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'vibrate',
                    soundEnabled: false,
                    vibrationEnabled: true
                  });
                  showToast('Ringer Mode: Vibrate Only');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'vibrate'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-[11px]">Vibrate</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'silent',
                    soundEnabled: false,
                    vibrationEnabled: false
                  });
                  showToast('Ringer Mode: Silent');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'silent'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <VolumeX className="w-5 h-5" />
                <span className="text-[11px]">Silent</span>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Test Native Audio Tone:</span>
              <button
                type="button"
                onClick={onTriggerTestPush}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-lime-400" />
                <span>Test Alert</span>
              </button>
            </div>
          </div>

          {/* Display & Density Settings */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-lime-400" />
              <span>Display & Visual Theme</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setThemeMode('oled')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'oled'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">OLED Black</div>
                <div className="text-[9px] text-zinc-500">Max contrast & battery</div>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">Slate Modern</div>
                <div className="text-[9px] text-zinc-500">Balanced industrial</div>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('slate')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'slate'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">High Contrast</div>
                <div className="text-[9px] text-zinc-500">Outdoor sunlight visibility</div>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-semibold">Compact Operations Grid</span>
              <button
                type="button"
                onClick={() => setCompactDensity(!compactDensity)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  compactDensity ? 'bg-lime-500' : 'bg-zinc-800'
                }`}
              >
                <span className={`block w-4 h-4 rounded-full bg-black transform transition-transform ${
                  compactDensity ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Local Storage & Cache Maintenance */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-lime-400" />
              <span>Offline Storage & App Data</span>
            </span>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
              <div>
                <div className="text-white font-bold">App Status:</div>
                <div className="text-[10px] text-zinc-400">Connected & Synced</div>
              </div>
              <div className="text-right">
                <div className="text-lime-400 font-bold">OPERATIONAL</div>
                <div className="text-[10px] text-zinc-400">Fast Local Storage</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-400">Clear Temporary Data:</span>
              <button
                type="button"
                onClick={handleClearCache}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-lime-400 ${cacheCleared ? 'animate-spin' : ''}`} />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone — Delete Account */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-red-900/60 space-y-3">
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>Danger Zone</span>
        </span>

        {deleteStep === 'idle' && (
          <>
            <p className="text-xs text-zinc-400">
              Delete your account and all of your data from this app. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setDeleteStep('warn')}
              className="px-3 py-2 rounded-xl bg-transparent hover:bg-red-500/10 border border-red-800 text-xs font-bold text-red-400 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </button>
          </>
        )}

        {deleteStep === 'warn' && (
          <>
            <p className="text-sm text-white font-bold">This will permanently delete:</p>
            {teamIsOwner ? (
              <>
                <ul className="text-xs text-zinc-300 list-disc pl-5 space-y-1">
                  <li>Your login and profile</li>
                  <li>Your business profile — and every team member loses access to it too</li>
                  <li>Your customers and customer requests</li>
                  <li>Your jobs, quotes, invoices, and approvals</li>
                  <li>Your chat history and Agent Inbox messages</li>
                  <li>Your voicemails and call history</li>
                  <li>Your Gmail connection</li>
                  <li>Your saved settings, including fingerprint login</li>
                </ul>
                <p className="text-xs text-red-300 font-semibold">
                  This cannot be undone. Once you delete your account, everything above is gone for good.
                </p>
              </>
            ) : (
              <>
                <ul className="text-xs text-zinc-300 list-disc pl-5 space-y-1">
                  <li>Your login and profile</li>
                  <li>Your spot on this team — you will be removed from the company</li>
                  <li>Your saved settings, including fingerprint login</li>
                </ul>
                <p className="text-xs text-red-300 font-semibold">
                  This cannot be undone. The company's jobs, customers, and other data stay — they belong to the company.
                </p>
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteStep('idle')}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDeleteStep('confirm')}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition cursor-pointer"
              >
                I understand, continue
              </button>
            </div>
          </>
        )}

        {deleteStep === 'confirm' && (
          <>
            <p className="text-xs text-zinc-300">
              To confirm, type <span className="font-mono font-bold text-white">DELETE</span> in the box below.
            </p>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-red-700"
            />
            {deleteNeedsPassword ? (
              <>
                <p className="text-xs text-zinc-300">
                  Then type your account password. It must match, or nothing is deleted.
                </p>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your account password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-red-700"
                />
              </>
            ) : (
              <p className="text-xs text-zinc-400">
                You signed in with Google, so no password is needed.
              </p>
            )}
            {deleteError && (
              <p className="text-xs text-red-300">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteStep('idle'); setDeleteInput(''); setDeletePassword(''); setDeleteError(null); }}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleteDeleting || (deleteNeedsPassword && !deletePassword)}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold text-white transition cursor-pointer"
              >
                {deleteDeleting ? 'Deleting…' : (teamIsOwner ? 'Delete everything' : 'Leave & delete my login')}
              </button>
            </div>
          </>
        )}

        {deleteStep === 'done' && (
          <>
            <p className="text-sm text-white font-bold">Your account and all data have been deleted.</p>
            <p className="text-xs text-zinc-400">Taking you to the login screen…</p>
          </>
        )}
      </div>

      {/* AI Employee Job Customizer Modal */}
      <EmployeeJobCustomizerModal
        isOpen={!!selectedEmployeeForCustomizer}
        onClose={() => setSelectedEmployeeForCustomizer(null)}
        employee={selectedEmployeeForCustomizer}
        onSaved={(updated) => {
          setCustomEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
          setSelectedEmployeeForCustomizer(null);
          showToast(`Saved customized job profile for ${updated.name}!`);
        }}
      />
    </div>
  );
};
