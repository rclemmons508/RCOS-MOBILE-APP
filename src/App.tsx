import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TabType, 
  PhoneCall, 
  Job, 
  Client, 
  RCOSFileItem, 
  SystemMetric, 
  RCOSNotification, 
  NotificationPreferences, 
  User, 
  BusinessAccount,
  ActionRecord,
  CustomerRequest,
  IndustryOptimizationSuggestion,
  ChatMessage,
  AgentInboxMessage,
  InvoicePrefill,
  EditedAmounts
} from './types';
import {
  INITIAL_NOTIFICATION_PREFERENCES,
  INITIAL_AUTOMATION_TASKS,
} from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { JobsHubSwitcher } from './components/nav/JobsHubSwitcher';
import { MessagesHubSwitcher } from './components/nav/MessagesHubSwitcher';
import { MoreMenu } from './components/nav/MoreMenu';
import { RequestsView } from './components/nav/RequestsView';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { DashboardTab } from './components/tabs/DashboardTab';
import { PhoneSystemTab } from './components/tabs/PhoneSystemTab';
import { JobsTab } from './components/tabs/JobsTab';
import { ClientsTab } from './components/tabs/ClientsTab';
import { SettingsTab, ProfileUpdate } from './components/tabs/SettingsTab';
import { TeamChatView } from './components/tabs/TeamChatView';
import { teamService } from './services/teamService';
import { countTeamUnread, getTeamLastSeenId } from './services/teamUnread';
import { useTeamLiveEvents } from './hooks/useTeamLiveEvents';
import { industryLabel } from './utils/industry';
import { asSafeSuggestion } from './utils/safeRender';
import { GmailTab } from './components/tabs/GmailTab';
import { GeminiChatView } from './components/GeminiChatView';
import { AiTeamView } from './components/AiTeamView';
import { ApprovalQueueView } from './components/ApprovalQueueView';
import { NotificationToast } from './components/notifications/NotificationToast';
import { NotificationCenterModal } from './components/notifications/NotificationCenterModal';
import { NotificationPreferencesModal } from './components/notifications/NotificationPreferencesModal';
import { AgentInboxModal } from './components/AgentInboxModal';
import { agentInboxService } from './services/agentInboxService';
import { AuthModal } from './components/auth/AuthModal';
import { useBiometrics } from './context/BiometricContext';
import { BiometricLockScreen } from './components/biometrics/BiometricLockScreen';
import { biometricService } from './services/biometricService';
import { LoginView } from './components/auth/LoginView';
import { OnboardingModal } from './components/OnboardingModal';
import { ServiceManagerModal } from './components/ServiceManagerModal';
import { ProactiveIndustrySuggestionModal } from './components/ProactiveIndustrySuggestionModal';
import { authService } from './services/authService';
import { APP_BUILD_ID } from './utils/buildInfo';
import {
  clearBusinessStateForUser,
  getCachedBusiness,
  getOnboardingCompleted,
  setCachedBusiness,
  setOnboardingCompleted,
} from './utils/businessStorage';
import { setCachedAccessToken } from './lib/gmail';
import { firestoreService } from './services/firestoreService';
import { userPreferencesService } from './services/userPreferencesService';
import { apiFetch } from './lib/api';
import { auth } from './lib/firebase';
import { updateProfile } from 'firebase/auth';
import { useSyncEngine } from './hooks/useSyncEngine';
import { logAutomationFired } from './utils/automationLog';
import {
  FOLLOWUP_META,
  FollowupRuleId,
  PendingFollowup,
  buildSmsUrl,
  firstNameOf,
  loadFollowupState,
  normalizePhone,
  renderFollowupTemplate,
  saveFollowupState,
} from './utils/followups';
import { isTaskFiring, getFollowupWindowMs, inQuietHours } from './utils/automation';
import { haptic } from './utils/haptics';

const BLANK_BUSINESS: BusinessAccount = {
  id: '',
  name: '',
  industry: 'Operations',
  size: 'Solo Operator (1-5)',
  services: [],
  pricingApproach: 'Standard ratecard',
  brandTone: 'Professional and responsive',
  painPoints: [],
  autonomyMode: 'autonomous',
  dollarThreshold: 500,
  activeEmployees: {
    executive_assistant: true,
    customer_service: true,
    operations: true,
    sales: true,
    technician: true,
    finance: true
  },
  onboardingCompleted: false,
  starterDrafts: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Find the company a signed-in operator belongs to, from the server.
 * A member who signed in on a new phone has no local company yet —
 * match by their login email against each company's member list (or by
 * the business id saved on their login). Returns null when nothing
 * matches, and the caller keeps whatever company is already loaded.
 */
async function resolveBusinessForUser(user: User): Promise<BusinessAccount | null> {
  try {
    const businesses = await apiFetch<BusinessAccount[]>('/api/businesses');
    if (!Array.isArray(businesses) || businesses.length === 0) return null;
    const email = (user.email || '').toLowerCase();
    if (user.businessId) {
      const byId = businesses.find(b => b.id === user.businessId);
      if (byId) return byId;
    }
    if (email) {
      const byMember = businesses.find(b => (b.members || []).some(m => (m.email || '').toLowerCase() === email));
      if (byMember) return byMember;
    }
    // Owner match: a business whose recorded owner is this user, even
    // when the roster is empty (e.g. a business created before the
    // roster existed). Without this, the owner is sent back to
    // onboarding on every fresh login because nothing matches them.
    if (user.id) {
      const byOwnerId = businesses.find(b => b.ownerId && b.ownerId !== 'unassigned_owner' && b.ownerId === user.id);
      if (byOwnerId) return byOwnerId;
    }
    if (email) {
      const byContact = businesses.find(b => (b.contactEmail || '').toLowerCase() === email);
      if (byContact) return byContact;
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [settingsSection, setSettingsSection] = useState<'user' | 'agents'>('user');
  const openSettings = (section: 'user' | 'agents') => {
    setSettingsSection(section);
    setActiveTab('settings');
  };
  const { isDashboardLocked, isBiometricEnabled, unenrollBiometrics } = useBiometrics();

  // Authentication State - starts from scratch (no preloaded user profile)
  // A new install or a new build never starts logged in as anyone: if
  // the stored build marker does not match this build, clear the
  // session and show the login screen. The marker is automatic (CI
  // commit SHA), so every new APK starts at login with no manual bump.
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      if (localStorage.getItem('rcos_app_build') !== APP_BUILD_ID) {
        authService.logout();
        localStorage.setItem('rcos_app_build', APP_BUILD_ID);
        return null;
      }
    } catch { /* storage unavailable */ }
    return authService.getActiveSession();
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Application Core Data - starts fresh from scratch
  const [calls, setCalls] = useState<PhoneCall[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const seenRoutingRef = useRef<string[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric>({
    agentsActive: 4,
    latencyMs: 14,
    callsHandled: 0,
    jobsDispatched: 0,
    activeClients: 0,
    cpuUsagePct: 18,
    memoryUsagePct: 34
  });
  const [automationTasks, setAutomationTasks] = useState(INITIAL_AUTOMATION_TASKS);
  // Automation engine controls: master switch, smart timing, industry pacing.
  const [automationMasterOn, setAutomationMasterOn] = useState(true);
  const [conditionalLogicOn, setConditionalLogicOn] = useState(true);
  const [industryModifierOn, setIndustryModifierOn] = useState(true);


  // Record a rule firing (feeds Start/Pause/Resume/Reset run stats).
  const bumpAutomationRun = useCallback((taskId: string) => {
    setAutomationTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, runCount: (t.runCount || 0) + 1, lastFiredAt: new Date().toISOString() } : t
      )
    );
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);

  // System Settings State (initialized from user preferences if available)
  const initialPrefs = currentUser?.email 
    ? userPreferencesService.getUserPreferences(currentUser.email)
    : null;

  const [industryProfile, setIndustryProfile] = useState(initialPrefs?.industryProfile || 'Commercial HVAC');
  const [autoDispatchThreshold, setAutoDispatchThreshold] = useState<'all' | 'critical' | 'high' | 'manual'>(
    initialPrefs?.autoDispatchThreshold || 'all'
  );

  // Notification System State - starts empty from scratch
  const [notifications, setNotifications] = useState<RCOSNotification[]>([]);
  const [notifPreferences, setNotifPreferences] = useState<NotificationPreferences>(
    initialPrefs?.notificationPreferences || INITIAL_NOTIFICATION_PREFERENCES
  );
  const [activePushToast, setActivePushToast] = useState<RCOSNotification | null>(null);
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [isNotifPrefsOpen, setIsNotifPrefsOpen] = useState(false);

  // Proactive Agent Inbox — the AI team messages the owner here.
  const [agentMessages, setAgentMessages] = useState<AgentInboxMessage[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const agentMessagesRef = useRef<AgentInboxMessage[]>([]);
  agentMessagesRef.current = agentMessages;
  const seenInboxIdsRef = useRef<Set<string>>(new Set());
  const firstInboxPollRef = useRef(true);

  // Follow-ups: per-source 'data has loaded' flags. A source is only scanned
  // for new triggers after its first load, so the first-run baseline seeds
  // from real data instead of firing for everything already on file.
  const followupsJobsLoadedRef = useRef(false);
  const followupsClientsLoadedRef = useRef(false);
  const followupsRequestsLoadedRef = useRef(false);

  // Money loop: prefill for opening the invoice modal from a completed job.
  const [invoicePrefill, setInvoicePrefill] = useState<InvoicePrefill | null>(null);
  const pendingJobInvoiceRef = useRef<string | null>(null);

  // Business context for Chat & Enterprise operations - starts from scratch (no preloaded company)
  // The cached company is scoped to the signed-in user (see
  // businessStorage): a different user never inherits the previous
  // user's cached company. With no session, nothing is restored.
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(() => {
    if (!currentUser) return null;
    return getCachedBusiness(currentUser);
  });

  const activeBusiness = businessAccount || BLANK_BUSINESS;

  // Persist the automation slice per business so switches survive reloads.
  useEffect(() => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    let tasks = INITIAL_AUTOMATION_TASKS;
    let masterOn = true;
    let condOn = true;
    let indOn = true;
    try {
      const raw = localStorage.getItem(`rcos_automation_${bizId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const byId = new Map<string, any>((parsed.tasks || []).map((t: any) => [t.id, t]));
        const customs = (parsed.tasks || []).filter((t: any) => t.isCustom);
        tasks = [...INITIAL_AUTOMATION_TASKS.map((t) => ({ ...t, ...(byId.get(t.id) || {}) })), ...customs];
        if (typeof parsed.masterOn === 'boolean') masterOn = parsed.masterOn;
        if (typeof parsed.conditionalLogicOn === 'boolean') condOn = parsed.conditionalLogicOn;
        if (typeof parsed.industryModifierOn === 'boolean') indOn = parsed.industryModifierOn;
      }
    } catch { /* corrupted storage — fall back to defaults */ }
    setAutomationTasks(tasks);
    setAutomationMasterOn(masterOn);
    setConditionalLogicOn(condOn);
    setIndustryModifierOn(indOn);
    try {
      localStorage.setItem(`rcos_automation_${bizId}`, JSON.stringify({ tasks, masterOn, conditionalLogicOn: condOn, industryModifierOn: indOn }));
    } catch { /* storage unavailable */ }
  }, [businessAccount?.id]);

  useEffect(() => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    const h = setTimeout(() => {
      try {
        localStorage.setItem(`rcos_automation_${bizId}`, JSON.stringify({
          tasks: automationTasks,
          masterOn: automationMasterOn,
          conditionalLogicOn,
          industryModifierOn,
        }));
      } catch { /* storage unavailable */ }
    }, 300);
    return () => clearTimeout(h);
  }, [businessAccount?.id, automationTasks, automationMasterOn, conditionalLogicOn, industryModifierOn]);

  // Onboarding gate state - starts immediately if not completed or company not configured
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    // Per-user flag: a new user never inherits "setup done" from the
    // previous user's company. Corrected on every login.
    return !getOnboardingCompleted(currentUser);
  });

  // Proactive AI Industry Profile Optimization Agent State
  const [proactiveSuggestion, setProactiveSuggestion] = useState<IndustryOptimizationSuggestion | null>(null);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isServiceManagerOpen, setIsServiceManagerOpen] = useState(false);
  const [dismissedSuggestionPresetId, setDismissedSuggestionPresetId] = useState<string | null>(() => {
    return localStorage.getItem('rcos_dismissed_suggestion_preset_id');
  });

  // Evaluate services against business context and query proactive optimization AI agent
  const evaluateIndustryOptimization = async (customBiz?: BusinessAccount) => {
    const targetBiz = customBiz || businessAccount;
    if (!targetBiz || !targetBiz.services || targetBiz.services.length === 0) return;

    try {
      const res = await apiFetch<{ suggestion: IndustryOptimizationSuggestion | null }>(
        `/api/business/${targetBiz.id}/suggest-optimized-industry`,
        {
          method: 'POST',
          body: JSON.stringify({
            services: targetBiz.services,
            currentIndustry: targetBiz.industry,
            businessName: targetBiz.name
          })
        }
      );

      if (res?.suggestion && res.suggestion.suggestedPresetId) {
        // Only trigger if user hasn't explicitly dismissed this exact suggestion
        if (res.suggestion.suggestedPresetId !== dismissedSuggestionPresetId) {
          setProactiveSuggestion(asSafeSuggestion(res.suggestion));
        }
      } else {
        setProactiveSuggestion(null);
      }
    } catch {
      // Non-blocking background agent failure
    }
  };

  // Monitor services and trigger evaluation when services change
  useEffect(() => {
    const servicesStr = (businessAccount?.services || []).join('|');
    if (!servicesStr) return;

    const timer = setTimeout(() => {
      evaluateIndustryOptimization();
    }, 1200);

    return () => clearTimeout(timer);
  }, [businessAccount?.services, businessAccount?.industry]);

  // Handler when user applies the optimized preset recommendation
  const handleApplyOptimization = async (updatedBiz: BusinessAccount) => {
    setBusinessAccount(updatedBiz);
    setIndustryProfile(updatedBiz.industry);
    setProactiveSuggestion(null);
    setIsSuggestionModalOpen(false);

    try {
      setCachedBusiness(currentUser, updatedBiz);
      await apiFetch(`/api/business/${updatedBiz.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedBiz)
      }).catch(() => null);

      await firestoreService.saveBusiness(updatedBiz).catch(() => null);

      sendPushNotification({
        type: 'system_alert',
        title: 'Industry Profile Optimized',
        message: `Upgraded workspace to ${updatedBiz.industry} based on your service catalog.`,
        priority: 'high',
        module: 'AI Context Monitor'
      });
    } catch (e) {
      console.warn('Industry optimization persistence note:', e);
    }
  };

  const handleDismissSuggestion = () => {
    if (proactiveSuggestion) {
      setDismissedSuggestionPresetId(proactiveSuggestion.suggestedPresetId);
      localStorage.setItem('rcos_dismissed_suggestion_preset_id', proactiveSuggestion.suggestedPresetId);
    }
    setProactiveSuggestion(null);
    setIsSuggestionModalOpen(false);
  };

  // Sync business account with server database on startup.
  // Prefer the company the signed-in operator belongs to (by saved
  // business id, then by team membership). NEVER fall back to the
  // first company on file — with several companies on the server,
  // businesses[0] is somebody else's company. No match means no company
  // is loaded; the login handler sends the operator to company setup.
  useEffect(() => {
    const sessionUser = authService.getActiveSession();
    apiFetch<BusinessAccount[]>('/api/businesses')
      .then((businesses) => {
        if (!Array.isArray(businesses) || businesses.length === 0) return;
        const email = (sessionUser?.email || '').toLowerCase();
        const byId = sessionUser?.businessId
          ? businesses.find(b => b.id === sessionUser.businessId)
          : undefined;
        const byMember = email
          ? businesses.find(b => (b.members || []).some(m => (m.email || '').toLowerCase() === email))
          : undefined;
        const target = byId || byMember;
        if (target) {
          setBusinessAccount(target);
          if (sessionUser) setCachedBusiness(sessionUser, target);
          return;
        }
        // No match: do nothing. The signed-in user's own cached company
        // (already in state) stays, or the login handler sends them to
        // company setup. Grabbing businesses[0] here used to hand every
        // unmatched operator somebody else's company.
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Server re-sync: the server store is wiped on redeploy (persistence
  // unverified). Once per app start, restore the server's copy of this
  // business — including the members list Team Chat needs — by upserting
  // the full business the app holds. Only the full copy is synced: the
  // localStorage copy is stripped of activeEmployees, so wait for the
  // Firestore listener to deliver the full record. Skips when the server
  // already has the record; fails silently when offline. Never blocks
  // login or any screen.
  const businessSyncRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const biz = businessAccount;
    if (!biz?.id) return;
    // Do NOT skip a stripped copy (localStorage drops activeEmployees): the server
    // fills activeEmployees with defaults on POST, and a restored record beats
    // an empty server. Employee toggles default to on; the user can re-toggle them.
    if (businessSyncRef.current.has(biz.id)) return;
    businessSyncRef.current.add(biz.id);
    (async () => {
      try {
        const businesses = await apiFetch<BusinessAccount[]>('/api/businesses');
        const serverBiz = Array.isArray(businesses) ? businesses.find((b) => b.id === biz.id) : undefined;
        if (serverBiz) {
          // Pull: the server copy wins when it is newer. The app used to
          // keep its stale localStorage copy forever (e.g. industry
          // "general_small_business" long after the server said
          // "it_services"), so the dashboard showed the wrong industry.
          // Newest-wins by updatedAt — a local edit still in flight
          // (local newer) is never clobbered by an older server copy.
          const serverNewer = (serverBiz.updatedAt || '') > (biz.updatedAt || '');
          if (serverNewer) {
            setBusinessAccount(serverBiz);
            setCachedBusiness(authService.getActiveSession(), serverBiz);
          }
          return;
        }
        await apiFetch('/api/businesses', { method: 'POST', body: JSON.stringify(biz) });
      } catch {
        // Offline / server down: fail silently; retry next app start.
      }
    })();
  }, [businessAccount]);

  // Real-time Firestore synchronization for jobs, clients, and business profile
  useEffect(() => {
    if (!businessAccount?.id) return;
    const unsubJobs = firestoreService.listenToJobs(businessAccount.id, (loadedJobs) => {
      followupsJobsLoadedRef.current = true;
      if (Array.isArray(loadedJobs) && loadedJobs.length > 0) {
        setJobs(loadedJobs);
      }
    });

    const unsubClients = firestoreService.listenToClients(businessAccount.id, (loadedClients) => {
      followupsClientsLoadedRef.current = true;
      if (Array.isArray(loadedClients) && loadedClients.length > 0) {
        setClients(loadedClients);
      }
    });

    const unsubBiz = firestoreService.listenToBusiness(businessAccount.id, (biz) => {
      if (biz) {
        setBusinessAccount(biz);
      }
    });

    return () => {
      unsubJobs();
      unsubClients();
      unsubBiz();
    };
  }, [businessAccount?.id]);

  // ---- Smart sync engine: one battery-friendly loop for all background data ----
  // Single 30s timer (not one per data source). Pauses when the tab is hidden,
  // skips while offline, and syncs immediately when the app comes back.
  const pingHealth = useCallback(async () => {
    try {
      await apiFetch('/api/health');
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  }, []);

  // Approvals: load the server's action queue (quotes, escalations) for this business.
  // Local emergency escalations (id starts with local-emg-) are merged in and kept.
  const refetchActions = useCallback(async () => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    try {
      const serverActions = await apiFetch<ActionRecord[]>(`/api/business/${bizId}/actions`);
      if (!Array.isArray(serverActions)) return;
      setActions((prev) => {
        const localOnly = prev.filter((x) => x.id.startsWith('local-emg-'));
        const serverIds = new Set(serverActions.map((x) => x.id));
        return [...serverActions, ...localOnly.filter((x) => !serverIds.has(x.id))];
      });
    } catch {
      /* offline: keep whatever we have */
    }
  }, [businessAccount?.id]);

  // Customer requests inbox (drives SLA badges on the dashboard)
  const refetchRequests = useCallback(async () => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    try {
      const reqs = await apiFetch<CustomerRequest[]>(`/api/business/${bizId}/requests`);
      followupsRequestsLoadedRef.current = true;
      if (Array.isArray(reqs)) setCustomerRequests(reqs);
    } catch {
      /* offline */
    }
  }, [businessAccount?.id]);

  // Emergency voice routing -> escalation approval (the "emergency escalation" automation rule)
  const pollVoiceRouting = useCallback(async () => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    let entries: any[] = [];
    try {
      entries = await apiFetch<any[]>('/api/voice/routing-log');
    } catch {
      return;
    }
    if (!Array.isArray(entries)) return;
    const ruleOn = isTaskFiring(automationTasks.find((t) => t.id === 'rule-emergency'), automationMasterOn);
    for (const entry of entries) {
      const key = `${entry.at || ''}|${entry.summary || ''}`;
      if (seenRoutingRef.current.includes(key)) continue;
      seenRoutingRef.current.push(key);
      const urgency = String(entry.urgency || 'routine');
      if ((urgency === 'emergency' || urgency === 'urgent') && ruleOn) {
        const action: ActionRecord = {
          id: `local-emg-${Date.now()}`,
          businessId: bizId,
          title: `Emergency call routed to ${entry.department || 'support'}`,
          description: entry.summary || 'An urgent caller needs the owner now.',
          employeeId: 'ai_receptionist',
          actionType: 'safety_review',
          status: 'awaiting_approval',
          riskCategory: 'system_settings',
          stepSummary: `AI receptionist flagged this call as ${urgency}. Call back immediately.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setActions((prev) => [action, ...prev]);
        logAutomationFired('rule-emergency', 'Emergency escalation', action.title, bizId);
        bumpAutomationRun('rule-emergency');
        sendPushNotification({
          type: 'emergency_dispatch',
          title: 'Emergency call escalation',
          message: action.title,
          priority: 'high',
          module: 'Phone System',
          actionTaken: 'Queued for review',
        });
      }
    }
    if (seenRoutingRef.current.length > 200) {
      seenRoutingRef.current = seenRoutingRef.current.slice(-200);
    }

    // Also log the emergency in the Agent Inbox so the owner sees the full
    // history there. The escalation push above already covers the alert, so
    // no second push is sent for the inbox copy.
    if (!ruleOn) return;
    for (const entry of entries) {
      const urgency = String(entry.urgency || 'routine');
      if (urgency !== 'emergency' && urgency !== 'urgent') continue;
      const inboxKey = `routing:${entry.at || ''}|${entry.summary || ''}`;
      if (agentMessagesRef.current.some((m) => m.dedupeKey === inboxKey)) continue;
      try {
        const created = await agentInboxService.create(bizId, {
          agent: 'receptionist',
          kind: 'alert',
          title: `Emergency call routed to ${entry.department || 'support'}`,
          body: entry.summary || 'An urgent caller needs the owner now. Call back immediately.',
          actionLabel: 'Review now',
          actionTab: 'approvals',
          dedupeKey: inboxKey,
        });
        seenInboxIdsRef.current.add(created.id);
        setAgentMessages((prev) => [created, ...prev]);
      } catch {
        /* offline — the next poll will retry */
      }
    }
  }, [businessAccount?.id, automationTasks, automationMasterOn, bumpAutomationRun]);

  // Proactive agent suggestions (once daily per topic) + inbox polling.
  // The team "comes to you": new inbox messages trigger a push notification.
  const pollProactive = useCallback(async () => {
    const bizId = businessAccount?.id;
    if (!bizId) return;

    // 1. Daily suggestions from the team, based on live business data.
    // Gated by the master switch + the proactive rule; smart timing holds
    // non-urgent suggestions during quiet hours.
    const suggestionsOn =
      isTaskFiring(automationTasks.find((t) => t.id === 'rule-proactive'), automationMasterOn) &&
      !(conditionalLogicOn && inQuietHours(notifPreferences));
    const today = new Date().toISOString().slice(0, 10);
    const existing = new Set(agentMessagesRef.current.map((m) => m.dedupeKey).filter(Boolean));
    const followupWindow = getFollowupWindowMs(businessAccount?.industry, industryModifierOn);
    const overdueCutoff = Date.now() - followupWindow;
    const overdue = customerRequests.filter(
      (r) =>
        (r.status === 'pending' || r.status === 'in_progress') &&
        new Date(r.createdAt).getTime() < overdueCutoff
    );
    const waitingQuotes = actions.filter(
      (a) => a.status === 'awaiting_approval' && (a.result?.quoteDetails || a.result?.invoiceDetails)
    );
    const unpaidInvoices = actions.filter(
      (a) => a.status === 'approved' && a.result?.invoiceDetails && a.paymentStatus !== 'paid'
    );
    const suggestions: Array<Parameters<typeof agentInboxService.create>[1]> = [];
    if (overdue.length > 0) {
      suggestions.push({
        agent: 'support',
        kind: 'suggestion',
        title: `${overdue.length} customer request${overdue.length === 1 ? ' is' : 's are'} waiting over a day`,
        body: `Hi — Support here. ${overdue.length} request${overdue.length === 1 ? '' : 's'} ${overdue.length === 1 ? 'has' : 'have'} been waiting more than a day. Want me to draft follow-up messages for them?`,
        actionLabel: 'View requests',
        actionTab: 'dashboard',
        dedupeKey: `daily:overdue:${today}`,
      });
    }
    if (waitingQuotes.length > 0) {
      const total = waitingQuotes.reduce(
        (s, a) => s + (a.result?.quoteDetails?.totalAmount || a.result?.invoiceDetails?.totalAmount || 0),
        0
      );
      suggestions.push({
        agent: 'sales',
        kind: 'suggestion',
        title: `${waitingQuotes.length} quote${waitingQuotes.length === 1 ? '' : 's'} waiting for approval`,
        body: `Sales here — $${Math.round(total).toLocaleString('en-US')} in quotes is sitting in your review queue. Approving them today keeps jobs moving.`,
        actionLabel: 'Review quotes',
        actionTab: 'approvals',
        dedupeKey: `daily:quotes:${today}`,
      });
    }
    if (unpaidInvoices.length > 0) {
      const owed = unpaidInvoices.reduce(
        (sum, a) => sum + (a.result?.invoiceDetails?.totalAmount || 0),
        0
      );
      suggestions.push({
        agent: 'operations',
        kind: 'suggestion',
        title: `${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? '' : 's'} still unpaid`,
        body: `Operations here — $${Math.round(owed).toLocaleString('en-US')} in approved invoices hasn't been paid yet. A friendly reminder usually moves things along.`,
        actionLabel: 'View invoices',
        actionTab: 'approvals',
        dedupeKey: `daily:unpaid:${today}`,
      });
    }
    if (suggestionsOn) {
      for (const s of suggestions) {
        if (s.dedupeKey && existing.has(s.dedupeKey)) continue;
        try {
          const created = await agentInboxService.create(bizId, s);
          seenInboxIdsRef.current.add(created.id);
          setAgentMessages((prev) => [created, ...prev]);
          bumpAutomationRun('rule-proactive');
        } catch {
          /* offline — the next poll will retry */
        }
      }
    }

    // 2. Poll the inbox; anything new from the team gets a push.
    try {
      const msgs = await agentInboxService.list(bizId);
      const fresh: AgentInboxMessage[] = [];
      for (const m of msgs) {
        if (m.status === 'unread' && !seenInboxIdsRef.current.has(m.id)) {
          seenInboxIdsRef.current.add(m.id);
          // Never push for history already sitting in the inbox on first load.
          if (!firstInboxPollRef.current && !agentMessagesRef.current.some((x) => x.id === m.id)) {
            fresh.push(m);
          }
        }
      }
      firstInboxPollRef.current = false;
      setAgentMessages(msgs);
      for (const m of fresh) {
        sendPushNotification({
          type: 'system_alert',
          title: m.title,
          message: m.body.slice(0, 140),
          priority: m.kind === 'alert' ? 'high' : 'low',
          module: 'AI Team',
          actionTaken: 'Posted to Agent Inbox',
        });
      }
    } catch {
      /* offline */
    }
  }, [businessAccount?.id, customerRequests, actions, automationTasks, automationMasterOn, conditionalLogicOn, industryModifierOn, notifPreferences, bumpAutomationRun]);

  // Automatic follow-ups (Phase A): draft, never send. The three follow-up
  // rules watch for new customers, real missed calls, and completed jobs.
  // When one fires, the agent posts a drafted text to the Agent Inbox with
  // Send now (opens the phone's SMS app pre-filled) / Edit / Dismiss.
  // Gates: master switch + per-rule on/off + pause + quiet hours (queued
  // until morning). Simulator/test calls never fire the missed-call rule —
  // it only trusts real carrier calls from the server.
  const pollFollowups = useCallback(async () => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    const bizName = businessAccount?.name || '';
    const state = loadFollowupState(bizId);
    const existingDedupe = new Set(agentMessagesRef.current.map((m) => m.dedupeKey).filter(Boolean));
    const taskById = new Map(automationTasks.map((t) => [t.id, t]));
    const quiet = conditionalLogicOn && inQuietHours(notifPreferences);
    const handledThisTick = new Set<string>();
    let changed = false;

    const fire = async (item: { ruleId: FollowupRuleId; dedupeKey: string; to: string; toName: string }): Promise<boolean> => {
      const task = taskById.get(item.ruleId);
      const meta = FOLLOWUP_META[item.ruleId];
      if (!task || !meta) return false;
      if (existingDedupe.has(item.dedupeKey) || handledThisTick.has(item.dedupeKey)) return true;
      const text = renderFollowupTemplate(task.messageTemplate || meta.defaultTemplate, {
        firstName: firstNameOf(item.toName),
        businessName: bizName,
        reviewLink: task.reviewLink || '',
      });
      // Real auto-send: when Vonage is configured on the server, send the
      // follow-up text for real. Any failure — or Vonage not configured —
      // falls through to the unchanged manual draft below.
      let sentViaVonage = false;
      let vonageError = '';
      try {
        const sendRes = await apiFetch<{ sent: boolean; configured?: boolean; error?: string }>(
          `/api/business/${bizId}/sms/send`,
          { method: 'POST', body: JSON.stringify({ to: item.to, text, dedupeKey: item.dedupeKey }) }
        );
        sentViaVonage = !!sendRes?.sent;
        if (!sentViaVonage && sendRes?.configured) vonageError = sendRes?.error || '';
      } catch {
        sentViaVonage = false; // offline — draft fallback below, retry on a later poll
      }
      const smsUrl = buildSmsUrl(item.to, text);
      const draftBody =
        `Draft ready to send to ${item.toName || 'this customer'} (${item.to}). Nothing has been sent yet — tap Send now to open your texting app with this pre-filled, then tap Dismiss once you've sent it.\n\n"${text}"`;
      const body = sentViaVonage
        ? `Sent via Vonage to ${item.toName || 'this customer'} (${item.to}).\n\n"${text}"`
        : vonageError
          ? `Auto-send didn't go through (Vonage: ${vonageError}) — draft ready to send manually. Tap Send now to open your texting app with this pre-filled, then tap Dismiss once you've sent it.\n\n"${text}"`
          : draftBody;
      try {
        await agentInboxService.create(bizId, {
          agent: meta.agent,
          kind: 'suggestion',
          title: sentViaVonage ? meta.titleFor(item.toName).replace('ready', 'sent') : meta.titleFor(item.toName),
          body,
          ...(sentViaVonage ? {} : { actionLabel: 'Send now', actionUrl: smsUrl }),
          dedupeKey: item.dedupeKey,
        });
        logAutomationFired(item.ruleId, task.name, sentViaVonage ? `Sent via Vonage to ${item.toName || item.to}` : `Draft ready for ${item.toName || item.to}`, bizId);
        bumpAutomationRun(item.ruleId);
        handledThisTick.add(item.dedupeKey);
        return true;
      } catch {
        return false; // offline — retry on a later poll
      }
    };

    const gateFor = (ruleId: string) => isTaskFiring(taskById.get(ruleId), automationMasterOn);

    // 1. Pending queue (held during quiet hours) — fire what is due.
    if (state.pending.length > 0) {
      const remaining: PendingFollowup[] = [];
      for (const p of state.pending) {
        if (!gateFor(p.ruleId)) continue; // rule turned off/paused — drop quietly
        if (quiet) {
          remaining.push(p);
          continue;
        }
        const ok = await fire(p);
        if (!ok) remaining.push(p);
      }
      if (remaining.length !== state.pending.length) {
        state.pending = remaining;
        changed = true;
      }
    }

    // 2. Welcome: new customers (Clients tab + booking/onboarding requests),
    // keyed by phone so the same person never gets two welcomes.
    if (followupsClientsLoadedRef.current && followupsRequestsLoadedRef.current) {
      const seenWelcome = new Set(state.seen.welcome);
      const collectWelcome = (phone: string | undefined, name: string, statusOk: boolean) => {
        if (!statusOk) return;
        const digits = normalizePhone(phone);
        if (!digits) return;
        const key = `welcome:${digits}`;
        if (seenWelcome.has(key)) return;
        seenWelcome.add(key);
        if (!state.primed.welcome) return; // baseline seed — handled below
        welcomeCandidates.push({ ruleId: 'rule-welcome', dedupeKey: `followup:welcome:${digits}`, to: phone || '', toName: name });
      };
      const welcomeCandidates: Array<{ ruleId: FollowupRuleId; dedupeKey: string; to: string; toName: string }> = [];
      for (const c of clients) collectWelcome(c.phone, c.name, true);
      for (const r of customerRequests) {
        collectWelcome(r.customerPhone, r.customerName, r.status === 'pending' || r.status === 'in_progress');
      }
      if (!state.primed.welcome) {
        // First run with real data: seed the baseline, fire nothing.
        state.seen.welcome = Array.from(seenWelcome);
        state.primed.welcome = true;
        changed = true;
      } else {
        for (const cand of welcomeCandidates) {
          if (!gateFor(cand.ruleId)) {
            if (!state.seen.welcome.includes(`welcome:${normalizePhone(cand.to)}`)) {
              state.seen.welcome.push(`welcome:${normalizePhone(cand.to)}`);
              changed = true;
            }
            continue;
          }
          if (quiet) {
            state.pending.push({ ruleId: cand.ruleId, dedupeKey: cand.dedupeKey, to: cand.to, toName: cand.toName });
            state.seen.welcome.push(`welcome:${normalizePhone(cand.to)}`);
            changed = true;
            continue;
          }
          const ok = await fire(cand);
          if (ok) {
            state.seen.welcome.push(`welcome:${normalizePhone(cand.to)}`);
            changed = true;
          }
        }
      }
    }

    // 3. Missed call: real carrier calls only (server list, isRealPstnCall).
    // Simulator/test calls never reach the server, so they never fire this.
    let serverCalls: any[] | null = null;
    try {
      serverCalls = await apiFetch<any[]>('/api/phone/calls');
    } catch {
      serverCalls = null;
    }
    if (Array.isArray(serverCalls)) {
      const dayOf = (c: any): string => {
        const parsed = new Date(c.timestamp || '');
        return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
      };
      const isRealMissed = (c: any) =>
        c && c.isRealPstnCall === true && (c.type === 'missed' || c.status === 'missed') && !!c.callerNumber;
      if (!state.primed.calls) {
        for (const c of serverCalls) {
          if (!isRealMissed(c)) continue;
          const key = `missed:${normalizePhone(c.callerNumber)}:${dayOf(c)}`;
          if (!state.seen.missed.includes(key)) state.seen.missed.push(key);
        }
        state.primed.calls = true;
        changed = true;
      } else {
        for (const c of serverCalls) {
          if (!isRealMissed(c)) continue;
          const key = `missed:${normalizePhone(c.callerNumber)}:${dayOf(c)}`;
          if (state.seen.missed.includes(key)) continue;
          const cand = {
            ruleId: 'rule-missed-call' as FollowupRuleId,
            dedupeKey: `followup:missed:${normalizePhone(c.callerNumber)}:${dayOf(c)}`,
            to: String(c.callerNumber),
            toName: String(c.callerName || ''),
          };
          if (!gateFor(cand.ruleId)) {
            state.seen.missed.push(key);
            changed = true;
            continue;
          }
          if (quiet) {
            state.pending.push({ ruleId: cand.ruleId, dedupeKey: cand.dedupeKey, to: cand.to, toName: cand.toName });
            state.seen.missed.push(key);
            changed = true;
            continue;
          }
          const ok = await fire(cand);
          if (ok) {
            state.seen.missed.push(key);
            changed = true;
          }
        }
      }
    }

    // 4. Review: newly completed jobs (one request per job).
    if (followupsJobsLoadedRef.current) {
      if (!state.primed.jobs) {
        for (const j of jobs) {
          if (j.status !== 'completed') continue;
          const key = `review:${j.id}`;
          if (!state.seen.review.includes(key)) state.seen.review.push(key);
        }
        state.primed.jobs = true;
        changed = true;
      } else {
        for (const j of jobs) {
          if (j.status !== 'completed') continue;
          const digits = normalizePhone(j.clientPhone);
          if (!digits) continue;
          const key = `review:${j.id}`;
          if (state.seen.review.includes(key)) continue;
          const cand = {
            ruleId: 'rule-review' as FollowupRuleId,
            dedupeKey: `followup:review:${j.id}`,
            to: j.clientPhone,
            toName: j.clientName,
          };
          if (!gateFor(cand.ruleId)) {
            state.seen.review.push(key);
            changed = true;
            continue;
          }
          if (quiet) {
            state.pending.push({ ruleId: cand.ruleId, dedupeKey: cand.dedupeKey, to: cand.to, toName: cand.toName });
            state.seen.review.push(key);
            changed = true;
            continue;
          }
          const ok = await fire(cand);
          if (ok) {
            state.seen.review.push(key);
            changed = true;
          }
        }
      }
    }

    if (changed) saveFollowupState(bizId, state);
  }, [
    businessAccount?.id,
    businessAccount?.name,
    clients,
    customerRequests,
    jobs,
    automationTasks,
    automationMasterOn,
    conditionalLogicOn,
    notifPreferences,
    bumpAutomationRun,
  ]);

  // Team Chat unread badge + in-app toast for teammates' messages.
  // Live first (stream below); the 30-second sync engine is the safety
  // net while the stream is down. The badge counts messages from OTHER
  // people newer than the last message seen in Team Chat (per phone,
  // stored on the device). While the user is looking at the chat, the
  // badge is zero — opening the chat marks everything seen.
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const teamSeenIdsRef = useRef<Set<string>>(new Set());
  const firstTeamPollRef = useRef(true);
  const refreshTeamUnread = useCallback(async () => {
    const bizId = businessAccount?.id;
    const email = currentUser?.email;
    if (!bizId || !email) return;
    try {
      const msgs = await teamService.getTeamMessages(bizId, email);
      const list = Array.isArray(msgs) ? msgs : [];
      const myEmail = email.toLowerCase();
      if (activeTabRef.current === 'team-chat') {
        setTeamUnreadCount(0);
      } else {
        setTeamUnreadCount(countTeamUnread(list, myEmail, getTeamLastSeenId(bizId)));
      }
      // One toast for the newest message from someone else that arrived
      // after this phone's first check — never for history already on
      // file at first load, and never while the user is in Team Chat.
      // (In-app toast only: nothing arrives while the app is closed.)
      if (!firstTeamPollRef.current && activeTabRef.current !== 'team-chat' && notifPreferences.pushEnabled) {
        const fresh = list.filter(m => (m.senderEmail || '').toLowerCase() !== myEmail && !teamSeenIdsRef.current.has(m.id));
        const newest = fresh[fresh.length - 1];
        if (newest) {
          const toast: RCOSNotification = {
            id: 'notif-team-' + newest.id,
            type: 'team_message',
            title: `${newest.senderName} sent a team message`,
            message: newest.text,
            timestamp: 'Just now',
            read: false,
            priority: 'medium',
            module: 'Team Chat'
          };
          setNotifications(prev => [toast, ...prev]);
          setActivePushToast(toast);
        }
      }
      teamSeenIdsRef.current = new Set(list.map(m => m.id));
      firstTeamPollRef.current = false;
    } catch {
      /* a blip must not blank the badge — keep the last count */
    }
  }, [businessAccount?.id, currentUser?.email, notifPreferences.pushEnabled]);

  // Live team stream at the app level: the badge and the toast update
  // the moment a teammate's message lands, even when Team Chat is not
  // open. TeamChatView opens its own stream while the chat is on screen.
  useTeamLiveEvents(businessAccount?.id, currentUser?.email, refreshTeamUnread);

  useSyncEngine(
    useCallback(async () => {
      await Promise.allSettled([pingHealth(), refetchActions(), refetchRequests(), pollVoiceRouting(), pollProactive(), pollFollowups(), refreshTeamUnread()]);
    }, [pingHealth, refetchActions, refetchRequests, pollVoiceRouting, pollProactive, pollFollowups, refreshTeamUnread]),
    30000
  );


  // Helper to trigger live push notification
  const sendPushNotification = (newNotif: Omit<RCOSNotification, 'id' | 'timestamp' | 'read'>) => {
    const fullNotif: RCOSNotification = {
      ...newNotif,
      id: 'notif-' + Date.now(),
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [fullNotif, ...prev]);

    // Check notification preferences & quiet hours
    if (notifPreferences.pushEnabled) {
      if (
        (newNotif.type === 'emergency_dispatch' && notifPreferences.emergencyDispatches) ||
        (newNotif.type === 'performance_anomaly' && notifPreferences.performanceAnomalies) ||
        (newNotif.type === 'task_completion' && notifPreferences.taskCompletions) ||
        (newNotif.type === 'call_event' && notifPreferences.callTranscripts) ||
        (newNotif.type === 'system_alert' && notifPreferences.systemAlerts)
      ) {
        setActivePushToast(fullNotif);
        
        let inQuietHours = false;
        if (notifPreferences.quietHoursEnabled) {
          try {
            const now = new Date();
            const curMins = now.getHours() * 60 + now.getMinutes();
            const [sH, sM] = (notifPreferences.quietHoursStart || '22:00').split(':').map(Number);
            const [eH, eM] = (notifPreferences.quietHoursEnd || '07:00').split(':').map(Number);
            const startMins = sH * 60 + sM;
            const endMins = eH * 60 + eM;
            if (startMins > endMins) {
              inQuietHours = curMins >= startMins || curMins < endMins;
            } else {
              inQuietHours = curMins >= startMins && curMins < endMins;
            }
          } catch {
            inQuietHours = false;
          }
        }

        const mode = notifPreferences.ringerMode || (
          !notifPreferences.soundEnabled && !notifPreferences.vibrationEnabled ? 'silent' :
          !notifPreferences.soundEnabled ? 'vibrate' : 'sound'
        );

        const allowAudioChime = mode === 'sound' && notifPreferences.soundEnabled && !inQuietHours;
        const allowVibration = (mode === 'sound' || mode === 'vibrate') && notifPreferences.vibrationEnabled && !inQuietHours;

        if (allowAudioChime) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch (e) {
            console.warn('Audio play blocked or unsupported', e);
          }
        }

        if (allowVibration && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try {
            window.navigator.vibrate([200, 100, 200]);
          } catch (e) {
            console.warn('Vibration blocked or unsupported', e);
          }
        }
      }
    }
  };

  // Handlers

  // Agent Inbox actions
  const handleInboxRespond = useCallback(
    async (msg: AgentInboxMessage, action: 'answered' | 'dismissed' | 'snoozed', text?: string) => {
      const bizId = businessAccount?.id;
      if (!bizId) return;
      // Optimistic update so the UI feels instant.
      setAgentMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: action, responseText: text, readAt: new Date().toISOString() } : m
        )
      );
      try {
        const updated = await agentInboxService.respond(bizId, msg.id, action, text);
        setAgentMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } catch {
        /* offline — will resync on next poll */
      }
    },
    [businessAccount?.id]
  );

  const handleInboxMarkRead = useCallback(
    async (msg: AgentInboxMessage) => {
      const bizId = businessAccount?.id;
      if (!bizId || msg.status !== 'unread') return;
      setAgentMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'read', readAt: new Date().toISOString() } : m))
      );
      try {
        const updated = await agentInboxService.markRead(bizId, msg.id);
        setAgentMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } catch {
        /* offline — will resync on next poll */
      }
    },
    [businessAccount?.id]
  );

  const handleAddJob = (newJob: Job) => {
    setJobs((prev) => [newJob, ...prev]);
    if (businessAccount?.id) {
      firestoreService.saveJob(businessAccount.id, newJob).catch((err) => {
        console.warn('Firestore saveJob error:', err);
      });
    }
    setMetrics((prev) => ({
      ...prev,
      jobsDispatched: prev.jobsDispatched + 1,
    }));
    sendPushNotification({
      type: newJob.priority === 'critical' ? 'emergency_dispatch' : 'task_completion',
      title: `${newJob.priority === 'critical' ? 'Emergency' : 'New'} Job Dispatched: ${newJob.id}`,
      message: `${newJob.title} assigned to ${newJob.assignedTechnician || 'Auto Router'}. Value: $${newJob.estimatedValue}.`,
      priority: newJob.priority === 'critical' ? 'critical' : 'medium',
      module: 'Jobs Dispatcher',
      actionTaken: 'Route Sent to Tech',
    });
  };

  const handleUpdateJob = (updatedJob: Job) => {
    setJobs((prev) => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (businessAccount?.id) {
      firestoreService.saveJob(businessAccount.id, updatedJob).catch((err) => {
        console.warn('Firestore updateJob error:', err);
      });
    }
  };

  const handleDeleteJob = (id: string) => {
    setJobs((prev) => prev.filter(j => j.id !== id));
    if (businessAccount?.id) {
      firestoreService.deleteJob(businessAccount.id, id).catch((err) => {
        console.warn('Firestore deleteJob error:', err);
      });
    }
  };

  // Money loop: approved quote -> scheduled job.
  const handleScheduleJob = async (quoteAction: ActionRecord) => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    const q = quoteAction.result?.quoteDetails;
    const job: Job = {
      id: `job_${Date.now()}`,
      title: q?.items?.[0]?.description || quoteAction.title || 'Scheduled job',
      clientName: q?.clientName || 'Client',
      clientPhone: '',
      address: '',
      status: 'dispatched',
      priority: 'medium',
      estimatedValue: q?.totalAmount || quoteAction.dollarAmount || 0,
      scheduledTime: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `Scheduled from approved quote${q ? ` for ${q.clientName} ($${q.totalAmount})` : ''}.`,
      category: 'Maintenance',
      quoteId: quoteAction.id,
    };
    handleAddJob(job);
    try {
      const updated = await apiFetch<ActionRecord>(
        `/api/business/${bizId}/actions/${quoteAction.id}/link`,
        { method: 'POST', body: JSON.stringify({ scheduledJobId: job.id }) }
      );
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      /* offline — will resync */
    }
  };

  // Money loop: approved invoice -> paid.
  const handleMarkPaid = async (action: ActionRecord) => {
    const bizId = businessAccount?.id;
    if (!bizId) return;
    try {
      const updated = await apiFetch<ActionRecord>(
        `/api/business/${bizId}/actions/${action.id}/mark-paid`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      sendPushNotification({
        type: 'task_completion',
        title: 'Invoice marked paid',
        message: `$${updated.paidAmount || ''} recorded for ${action.result?.invoiceDetails?.clientName || 'client'}.`.trim(),
        priority: 'low',
        module: 'Money Pipeline',
        actionTaken: 'Payment recorded',
      });
    } catch {
      /* offline — will resync */
    }
  };

  // Money loop: completed job -> invoice modal (pre-filled).
  const handleCreateInvoiceFromJob = useCallback((prefill: InvoicePrefill) => {
    pendingJobInvoiceRef.current = prefill.jobId || null;
    setInvoicePrefill(prefill);
    setActiveTab('approvals');
  }, []);

  const handleInvoiceCreated = useCallback(async (createdId?: string) => {
    const jobId = pendingJobInvoiceRef.current;
    pendingJobInvoiceRef.current = null;
    setInvoicePrefill(null);
    if (!jobId || !createdId || !businessAccount?.id) return;
    try {
      const updated = await apiFetch<ActionRecord>(
        `/api/business/${businessAccount.id}/actions/${createdId}/link`,
        { method: 'POST', body: JSON.stringify({ jobId }) }
      );
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      /* offline — will resync */
    }
    const job = jobs.find((j) => j.id === jobId);
    if (job) handleUpdateJob({ ...job, invoiceId: createdId });
  }, [businessAccount?.id, jobs, refetchActions]);

  const handleAddClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    if (businessAccount?.id) {
      firestoreService.saveClient(businessAccount.id, newClient).catch((err) => {
        console.warn('Firestore saveClient error:', err);
      });
    }
    sendPushNotification({
      type: 'system_alert',
      title: `Client Account Added: ${newClient.company}`,
      message: `RCOS CRM initialized account for ${newClient.name}. Health score: ${newClient.healthScore}/100.`,
      priority: 'low',
      module: 'CRM',
    });
  };

  const handleEditClient = (updatedClient: Client) => {
    setClients((prev) => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (businessAccount?.id) {
      firestoreService.saveClient(businessAccount.id, updatedClient).catch((err) => {
        console.warn('Firestore updateClient error:', err);
      });
    }
  };

  const handleDeleteClient = (id: string) => {
    setClients((prev) => prev.filter(c => c.id !== id));
    if (businessAccount?.id) {
      firestoreService.deleteClient(businessAccount.id, id).catch((err) => {
        console.warn('Firestore deleteClient error:', err);
      });
    }
  };

  // Local mirror of the server's edited-amounts application (Bug 3): when
  // the decide call fails and we fall back to a local update, the edited
  // amounts still land on the card instead of being silently dropped.
  const withEditedAmounts = (act: ActionRecord, edited: EditedAmounts): ActionRecord => {
    if (!act.result) return act;
    const items = edited.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    }));
    if (edited.kind === 'quote') {
      const prev = act.result.quoteDetails;
      return {
        ...act,
        dollarAmount: edited.totalAmount,
        financialAmount: edited.totalAmount,
        result: {
          ...act.result,
          quoteDetails: {
            clientName: edited.clientName || prev?.clientName || 'Valued Client',
            items,
            totalAmount: edited.totalAmount,
            validDays: prev?.validDays ?? 30,
            ...(edited.terms !== undefined
              ? { terms: edited.terms }
              : prev?.terms !== undefined
                ? { terms: prev.terms }
                : {}),
          },
        },
      };
    }
    const prev = act.result.invoiceDetails;
    return {
      ...act,
      dollarAmount: edited.totalAmount,
      financialAmount: edited.totalAmount,
      result: {
        ...act.result,
        invoiceDetails: {
          clientName: edited.clientName || prev?.clientName || 'Valued Client',
          invoiceNumber: edited.invoiceNumber || prev?.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
          amount: edited.totalAmount,
          totalAmount: edited.totalAmount,
          items: items.map((item) => ({ ...item, amount: item.total })),
          dueDate: edited.dueDate ?? prev?.dueDate ?? 'Net 15 days',
          ...(edited.paymentInstructions !== undefined
            ? { paymentInstructions: edited.paymentInstructions }
            : prev?.paymentInstructions !== undefined
              ? { paymentInstructions: prev.paymentInstructions }
              : {}),
          ...(edited.notes !== undefined
            ? { notes: edited.notes }
            : prev?.notes !== undefined
              ? { notes: prev.notes }
              : {}),
        },
      },
    };
  };

  const handleApprovalDecision = async (
    actionId: string,
    decision: 'approved' | 'rejected' | 'edited',
    editedContent?: string,
    note?: string,
    editedAmounts?: EditedAmounts
  ) => {
    const target = actions.find((x) => x.id === actionId);
    // Server-owned actions go through the API; local emergency escalations are handled on-device.
    if (target && !target.id.startsWith('local-emg-') && businessAccount?.id) {
      try {
        const updated = await apiFetch<ActionRecord>(
          `/api/business/${businessAccount.id}/actions/${actionId}/decide`,
          {
            method: 'POST',
            body: JSON.stringify({ decision, editedContent, editedAmounts, reviewerNote: note }),
          }
        );
        setActions((prev) => prev.map((x) => (x.id === actionId ? updated : x)));
        return;
      } catch {
        /* fall through to local update */
      }
    }
    setActions((prev) =>
      prev.map((act) => {
        if (act.id !== actionId) return act;
        const edited = decision === 'edited' && editedAmounts ? withEditedAmounts(act, editedAmounts) : act;
        return {
          ...edited,
          status: decision === 'rejected' ? 'rejected' : 'approved',
          reviewedAt: new Date().toISOString(),
          reviewerNote: note,
          approvalDecision: {
            decision,
            decidedAt: new Date().toISOString(),
            reviewerNote: note,
            ...(editedContent ? { editedContent } : {}),
            ...(editedAmounts ? { editedAmounts } : {}),
          },
          ...(editedContent ? { currentDraftContent: editedContent } : {}),
        };
      })
    );
  };

  const handleSimulateInboundCall = () => {
    // Demo data injection disabled in production builds.
    if (import.meta.env.PROD) { console.warn('[demo] disabled'); return; }
    const newCall: PhoneCall = {
      id: 'call-' + Date.now(),
      callerName: 'Alex Vance (Apex Corporate)',
      callerNumber: '+1 (555) 492-0012',
      type: 'inbound',
      status: 'completed',
      timestamp: 'Just now',
      duration: '1m 20s',
      summary: 'Inbound emergency call. RCOS Voice AI generated priority job ticket & SMS dispatch.',
      sentiment: 'urgent',
      actionRequired: 'Auto-Dispatched Field Technician',
    };
    setCalls((prev) => [newCall, ...prev]);
    setMetrics((prev) => ({
      ...prev,
      callsHandled: prev.callsHandled + 1,
    }));
    sendPushNotification({
      type: 'call_event',
      title: 'Inbound AI Call Processed',
      message: 'Apex Corporate call answered by Voice AI Agent. Priority ticket logged.',
      priority: 'high',
      module: 'Phone System',
      actionTaken: 'Transcript Saved',
    });
    setActiveTab('phone');
  };

  const handleEmergencyJobTrigger = async () => {
    // Demo data injection disabled in production builds.
    if (import.meta.env.PROD) { console.warn('[demo] disabled'); return; }
    await haptic.warning();
    const emergencyJob: Job = {
      id: 'RC-' + Math.floor(9000 + Math.random() * 900),
      title: 'Emergency Service & Urgent System Diagnostic',
      clientName: 'Priority Client Call',
      clientPhone: '+1 (555) 392-8811',
      address: '450 Tech Parkway, Suite 100',
      status: 'urgent',
      priority: 'critical',
      assignedTechnician: 'Marcus Vance (Lead Specialist)',
      estimatedValue: 2400,
      scheduledTime: 'Immediate Response',
      description: 'Emergency service request captured and auto-routed for prompt arrival.',
      aiNotes: 'Auto-routed based on urgent priority and nearest technician proximity.',
      category: 'HVAC',
    };
    handleAddJob(emergencyJob);
    setActiveTab('jobs');
  };

  const handleTriggerTestPush = () => {
    sendPushNotification({
      type: 'performance_anomaly',
      title: 'RCOS Test Alert Verified',
      message: 'Custom push preference verified! All RCOS system subroutines operating normally.',
      priority: 'high',
      module: 'Orchestrator',
      actionTaken: 'Test Verified',
    });
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleLoginSuccess = async (user: User) => {
    await haptic.success();
    // A different operator signing in must never inherit the previous
    // operator's company, Gmail token, or setup flag. The previous
    // operator's own cached company stays on disk for their return; it
    // is never loaded for this operator.
    if (currentUser && currentUser.email.toLowerCase() !== user.email.toLowerCase()) {
      setCachedAccessToken(null);
    }
    authService.saveActiveSession(user);
    setCurrentUser(user);
    setIsAuthModalOpen(false);

    // Load the company THIS operator belongs to — always set, never
    // left over from the previous operator. A team member signing in on
    // a new phone has no local company yet — find theirs on the server
    // by membership instead of opening company setup (which would make
    // a second, separate company). Server match wins; the operator's
    // own cached company covers a business the server cannot match
    // (empty roster, unassigned owner) or an offline start. Otherwise
    // this operator has no company yet and goes to company setup with
    // a blank slate.
    const resolvedBiz = await resolveBusinessForUser(user);
    const cachedBiz = getCachedBusiness(user);
    const nextBiz = resolvedBiz || cachedBiz;
    if (nextBiz) {
      setBusinessAccount(nextBiz);
      setCachedBusiness(user, nextBiz);
      if (resolvedBiz) setOnboardingCompleted(user);
      setIsOnboardingOpen(!getOnboardingCompleted(user));
    } else {
      setBusinessAccount(null);
      clearBusinessStateForUser(user);
      setIsOnboardingOpen(true);
    }

    // Load and apply that specific operator's personal preferences
    const prefs = userPreferencesService.getUserPreferences(user.email || user.id);
    setIndustryProfile(prefs.industryProfile || 'Commercial HVAC');
    setAutoDispatchThreshold(prefs.autoDispatchThreshold || 'all');
    if (prefs.notificationPreferences) {
      setNotifPreferences(prefs.notificationPreferences);
    }

    sendPushNotification({
      type: 'system_alert',
      title: 'Operator Session Authenticated',
      message: `Welcome back ${user.fullName}. Security level: ${user.role}.`,
      priority: 'medium',
      module: 'Core',
    });
  };

  // Settings → My Profile save: business record (contact info + picture),
  // login user record (name + avatar shown in headers), and the Firebase
  // display name when a Firebase user is signed in. The login email itself
  // never changes here.
  const handleUpdateProfile = async (p: ProfileUpdate) => {
    const email = currentUser?.email;
    if (!email) throw new Error('No signed-in account found.');
    const updatedBiz: BusinessAccount = {
      ...activeBusiness,
      contactName: p.fullName,
      contactPhone: p.phone,
      contactEmail: p.contactEmail,
      profilePicture: p.profilePicture,
      updatedAt: new Date().toISOString(),
    };
    setBusinessAccount(updatedBiz);
    setCachedBusiness(currentUser, updatedBiz);
    if (updatedBiz.id) {
      await apiFetch(`/api/business/${updatedBiz.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedBiz)
      }).catch(() => null);
      await firestoreService.saveBusiness(updatedBiz).catch(() => null);
    }
    const updatedUser = authService.updateStoredUser(email, { fullName: p.fullName, avatar: p.profilePicture });
    if (updatedUser) setCurrentUser(updatedUser);
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: p.fullName }).catch(() => null);
    }
  };

  // Settings → Teach Your Team save: the owner's business knowledge lives
  // on the business record and rides the same save path as the profile
  // (server PUT + Firestore), so every agent surface reads the same text.
  const handleUpdateBusinessKnowledge = async (knowledge: string) => {
    if (!activeBusiness?.id) throw new Error('No business loaded.');
    const updatedBiz: BusinessAccount = {
      ...activeBusiness,
      businessKnowledge: knowledge,
      updatedAt: new Date().toISOString(),
    };
    setBusinessAccount(updatedBiz);
    setCachedBusiness(currentUser, updatedBiz);
    await apiFetch(`/api/business/${updatedBiz.id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedBiz)
    }).catch(() => null);
    await firestoreService.saveBusiness(updatedBiz).catch(() => null);
  };

  const handleLogout = async () => {
    await authService.logout();
    biometricService.setLocked(false);
    // Remove the device's biometric enrollment too, so the login screen never
    // shows the previous operator's email after logout.
    unenrollBiometrics();
    // Clear the ACTIVE company — the next operator must never see it.
    // The signed-out operator's own cached company stays on disk for
    // their return; it is scoped to them and never loads for anyone else.
    setBusinessAccount(null);
    setIsOnboardingOpen(true);
    setCurrentUser(null);
    setIsAuthModalOpen(false);
    sendPushNotification({
      type: 'system_alert',
      title: 'Operator Session Ended',
      message: 'Session signed out safely. Dashboard secured behind login gate.',
      priority: 'low',
      module: 'Core',
    });
  };

  // Settings → Team → Leave team (members only). Removes the membership
  // on the server, then signs out so the operator can join or create
  // another company from the login screen.
  const handleLeaveTeam = async () => {
    const email = currentUser?.email;
    if (!email || !activeBusiness.id) {
      throw new Error('No team to leave.');
    }
    await teamService.leaveTeam(activeBusiness.id, email);
    try {
      authService.updateStoredUser(email, { businessId: undefined });
    } catch { /* login record already gone */ }
    clearBusinessStateForUser(currentUser);
    setBusinessAccount(null);
    await authService.logout();
    unenrollBiometrics();
    setCurrentUser(null);
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  // If no user is logged in, show the full-screen Login & Registration gate!
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full bg-black text-zinc-100 flex flex-col items-center justify-start overflow-hidden selection:bg-lime-500 selection:text-black">
      {/* Mobile Device Frame Container (Full viewport width on phones, centered on wider displays) */}
      <div className="w-full max-w-md h-full max-h-[100dvh] bg-black relative flex flex-col shadow-2xl border-x border-zinc-900/80 overflow-hidden">
        
        {/* Floating Real-Time Push Toast Banner */}
        <NotificationToast
          notification={activePushToast}
          onClose={() => setActivePushToast(null)}
          onView={(notif) => {
            setActivePushToast(null);
            // A team-message toast opens Team Chat, not the notification center.
            if (notif.type === 'team_message') {
              setActiveTab('team-chat');
            } else {
              setIsNotifCenterOpen(true);
            }
          }}
        />

        {/* Top Header with Brand Logo, Unread Bell, and Profile */}
        <Header
          activeTab={activeTab}
          unreadCount={unreadNotifCount}
          unreadInboxCount={agentMessages.filter((m) => m.status === 'unread').length}
          currentUser={currentUser}
          onOpenNotifications={() => setIsNotifCenterOpen(true)}
          onOpenInbox={() => setIsInboxOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenChat={() => setActiveTab('chat')}
          onOpenGmail={() => setActiveTab('gmail')}
        />

        {/* Tab Views Container with Safe Scrollable Bounds */}
        <main className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]">
          {(activeTab === 'jobs' || activeTab === 'approvals' || activeTab === 'clients') && (
            <div className="px-3.5 sm:px-4 pt-2">
              <JobsHubSwitcher activeTab={activeTab} onNavigate={setActiveTab} />
            </div>
          )}
          {(activeTab === 'team-chat' || activeTab === 'gmail' || activeTab === 'phone' || activeTab === 'requests') && (
            <div className="px-3.5 sm:px-4 pt-2">
              <MessagesHubSwitcher activeTab={activeTab} onNavigate={setActiveTab} unreadTeamCount={teamUnreadCount} />
            </div>
          )}
          {activeTab === 'dashboard' && (
            <DashboardTab
              calls={calls}
              jobs={jobs}
              actions={actions}
              metrics={metrics}
              currentUser={currentUser}
              unreadNotifCount={unreadNotifCount}
              unreadInboxCount={agentMessages.filter((m) => m.status === 'unread').length}
              followupsDraftedYesterday={(() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                const yStr = y.toDateString();
                return agentMessages.filter(
                  (m) => m.dedupeKey?.startsWith('followup:') && new Date(m.createdAt).toDateString() === yStr
                ).length;
              })()}
              businessId={activeBusiness.id}
              businessName={activeBusiness.name || 'Setup Company'}
              industryName={industryLabel(activeBusiness.industry)}
              serverOnline={serverOnline}
              pendingApprovals={actions.filter((x) => x.status === 'awaiting_approval').length}
              activeEmployees={activeBusiness.activeEmployees}
              customerRequests={customerRequests}
              clients={clients}
              automationsOn={automationTasks.filter((t) => t.isAutomated).length}
              automationsTotal={automationTasks.length}
              proactiveSuggestion={proactiveSuggestion}
              onReviewSuggestion={() => setIsSuggestionModalOpen(true)}
              onDismissSuggestion={handleDismissSuggestion}
              onOpenServiceManager={() => setIsServiceManagerOpen(true)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSimulateCall={handleSimulateInboundCall}
              onTriggerEmergencyJob={handleEmergencyJobTrigger}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenNotifications={() => setIsNotifCenterOpen(true)}
              onOpenInbox={() => setIsInboxOpen(true)}
              onApproveQuote={(actionId) => handleApprovalDecision(actionId, 'approved')}
              onScheduleJob={handleScheduleJob}
              onMarkPaid={handleMarkPaid}
              onOpenAppCheck={() => openSettings('agents')}
              industry={businessAccount?.industry || industryProfile}
              industryModifierOn={industryModifierOn}
            />
          )}

          {activeTab === 'phone' && (
            <PhoneSystemTab
              calls={calls}
              onSimulateCall={handleSimulateInboundCall}
              messages={messages}
              currentUser={currentUser}
              businessId={businessAccount?.id ?? ''}
              availableDepartments={activeBusiness.availableDepartments}
              onSendMessage={(text) => {
                const newMessage = {
                  id: 'msg-' + Date.now(),
                  senderId: currentUser?.id || 'usr-operator',
                  senderName: currentUser?.fullName || 'Lead Operator',
                  avatar: currentUser?.avatar,
                  text,
                  timestamp: 'Just now',
                  isCurrentUser: true,
                };
                setMessages(prev => [...prev, newMessage]);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onTriggerNotification={(title, message) => {
                sendPushNotification({
                  type: 'call_event',
                  title,
                  message,
                  priority: 'high',
                  module: 'Phone System',
                  actionTaken: 'Executed'
                });
              }}
            />
          )}

          {activeTab === 'gmail' && (
            <GmailTab
              currentUser={currentUser}
              businessId={activeBusiness.id}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onAddJobFromEmail={(jobData) => {
                const newJob: Job = {
                  id: `job-${Date.now()}`,
                  title: jobData.title || 'Email Dispatch Request',
                  clientName: jobData.clientName || 'Gmail Client',
                  clientPhone: jobData.clientPhone || '',
                  address: jobData.address || 'Facility Mechanical Room',
                  status: jobData.status || 'unassigned',
                  priority: jobData.priority || 'high',
                  description: jobData.description || 'Origin: Gmail message',
                  assignedTechnician: jobData.assignedTechnician || 'Lead Field Specialist',
                  scheduledTime: 'Immediate Response',
                  estimatedValue: 850,
                  category: 'HVAC',
                };
                setJobs(prev => [newJob, ...prev]);
                setActivePushToast({
                  id: `notif-${Date.now()}`,
                  title: 'New Dispatch Job Created',
                  message: `Job "${newJob.title}" originated from Gmail was added to the queue.`,
                  type: 'emergency_dispatch',
                  timestamp: 'Just now',
                  read: false,
                  priority: 'high',
                });
              }}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsTab
              jobs={jobs}
              onAddJob={handleAddJob}
              onUpdateJob={handleUpdateJob}
              onDeleteJob={handleDeleteJob}
              onCreateInvoice={handleCreateInvoiceFromJob}
              onTriggerNotification={(title, message) => {
                sendPushNotification({
                  type: 'task_completion',
                  title,
                  message,
                  priority: 'medium',
                  module: 'Jobs Dispatcher'
                });
              }}
            />
          )}

          {activeTab === 'team' && (
            <AiTeamView 
              business={activeBusiness}
              onUpdateBusiness={(updated) => {
                setBusinessAccount(updated);
                if (updated.id) {
                  firestoreService.saveBusiness(updated).catch(() => {});
                }
              }}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsTab
              clients={clients}
              onAddClient={handleAddClient}
              onEditClient={handleEditClient}
              onDeleteClient={handleDeleteClient}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalQueueView
              business={activeBusiness}
              actions={actions}
              onDecision={handleApprovalDecision}
              onRefresh={refetchActions}
              onScheduleJob={handleScheduleJob}
              onMarkPaid={handleMarkPaid}
              onMoneyCreated={handleInvoiceCreated}
              invoicePrefill={invoicePrefill}
              onInvoicePrefillConsumed={() => setInvoicePrefill(null)}
            />
          )}

          {activeTab === 'chat' && (
            <GeminiChatView 
              business={activeBusiness} 
              onClose={() => setActiveTab('dashboard')} 
            />
          )}

          {activeTab === 'team-chat' && (
            <TeamChatView
              businessId={activeBusiness.id}
              business={activeBusiness}
              currentUser={currentUser}
              onBack={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'requests' && (
            <RequestsView
              customerRequests={customerRequests}
              businessId={activeBusiness.id}
              businessName={activeBusiness.name || 'Setup Company'}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              initialSection={settingsSection}
              currentUser={currentUser}
              businessId={activeBusiness.id}
              business={activeBusiness}
              onUpdateProfile={handleUpdateProfile}
              onUpdateBusinessKnowledge={handleUpdateBusinessKnowledge}
              onLogout={handleLogout}
              automationTasks={automationTasks}
              onToggleAutomation={(taskId, isAutomated) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, isAutomated } : t));
              }}
              onPauseAutomation={(taskId, paused) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, paused } : t));
              }}
              onResetAutomation={(taskId) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, runCount: 0, lastFiredAt: undefined } : t));
              }}
              onUpdateAutomationTemplate={(taskId, template) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, messageTemplate: template } : t));
              }}
              onUpdateAutomationReviewLink={(taskId, link) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, reviewLink: link } : t));
              }}
              automationMasterOn={automationMasterOn}
              onToggleMaster={setAutomationMasterOn}
              conditionalLogicOn={conditionalLogicOn}
              onToggleConditionalLogic={setConditionalLogicOn}
              industryModifierOn={industryModifierOn}
              onToggleIndustryModifier={setIndustryModifierOn}
              industryName={businessAccount?.industry ? industryLabel(businessAccount.industry) : industryProfile}
              onAddCustomTask={(task) => {
                setAutomationTasks(prev => [...prev, task]);
              }}
              aiAssistantEnabled={aiAssistantEnabled}
              onToggleAiAssistant={() => setAiAssistantEnabled(!aiAssistantEnabled)}
              industryProfile={industryProfile}
              onUpdateIndustry={(ind) => {
                setIndustryProfile(ind);
                if (currentUser?.email) {
                  userPreferencesService.saveUserPreferences(currentUser.email, { industryProfile: ind });
                }
              }}
              autoDispatchThreshold={autoDispatchThreshold}
              onUpdateAutoDispatchThreshold={(val) => {
                setAutoDispatchThreshold(val);
                if (currentUser?.email) {
                  userPreferencesService.saveUserPreferences(currentUser.email, { autoDispatchThreshold: val });
                }
              }}
              notifPreferences={notifPreferences}
              onUpdateNotifPreferences={(updated) => {
                setNotifPreferences(updated);
                if (currentUser?.email) {
                  userPreferencesService.saveUserPreferences(currentUser.email, { notificationPreferences: updated });
                }
              }}
              onTriggerTestPush={handleTriggerTestPush}
              onOpenNotifPrefsModal={() => setIsNotifPrefsOpen(true)}
              onReopenOnboarding={() => setIsOnboardingOpen(true)}
              onOpenServiceManager={() => setIsServiceManagerOpen(true)}
              businessServices={activeBusiness.services}
              proactiveSuggestion={proactiveSuggestion}
              onReviewSuggestion={() => setIsSuggestionModalOpen(true)}
              onDismissSuggestion={handleDismissSuggestion}
              onOpenTeamChat={() => setActiveTab('team-chat')}
              onLeaveTeam={handleLeaveTeam}
            />
          )}

          {activeTab === 'more' && (
            <MoreMenu onOpenSettings={openSettings} />
          )}
        </main>

        {/* Floating Multi-Agent AI Assistant Button */}
        {aiAssistantEnabled && activeTab !== 'chat' && (
          <FloatingAIAssistant onOpenTab={(tab) => setActiveTab(tab)} />
        )}

        {/* Bottom Navigation Bar with Safe Area Insets */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          unreadTeamCount={teamUnreadCount}
        />

        {/* Notification Center Modal */}
        <NotificationCenterModal
          isOpen={isNotifCenterOpen}
          onClose={() => setIsNotifCenterOpen(false)}
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearAll={handleClearNotifications}
          onOpenPreferences={() => {
            setIsNotifCenterOpen(false);
            setIsNotifPrefsOpen(true);
          }}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onTriggerTestNotification={handleTriggerTestPush}
        />

        {/* Notification Preferences Modal */}
        <NotificationPreferencesModal
          isOpen={isNotifPrefsOpen}
          onClose={() => setIsNotifPrefsOpen(false)}
          preferences={notifPreferences}
          onSavePreferences={(updated) => setNotifPreferences(updated)}
          onTriggerTestPush={handleTriggerTestPush}
        />

        {/* Proactive Agent Inbox */}
        <AgentInboxModal
          isOpen={isInboxOpen}
          onClose={() => setIsInboxOpen(false)}
          messages={agentMessages}
          onRespond={handleInboxRespond}
          onNavigateTab={(tab) => {
            setIsInboxOpen(false);
            setActiveTab(tab);
          }}
          onMarkRead={handleInboxMarkRead}
        />

        {/* User Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
        />

        {/* Biometric Shield Lock Screen */}
        {isBiometricEnabled && isDashboardLocked && (
          <BiometricLockScreen 
            currentUser={currentUser} 
            onLogout={handleLogout}
          />
        )}

        {/* Business Services Catalog Manager Modal */}
        <ServiceManagerModal
          isOpen={isServiceManagerOpen}
          onClose={() => setIsServiceManagerOpen(false)}
          business={activeBusiness}
          onUpdateServices={(updatedServices) => {
            const updatedBiz = {
              ...activeBusiness,
              services: updatedServices,
              updatedAt: new Date().toISOString()
            };
            setBusinessAccount(updatedBiz);
            setCachedBusiness(currentUser, updatedBiz);
            if (updatedBiz.id) {
              apiFetch(`/api/business/${updatedBiz.id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedBiz)
              }).catch(() => null);
              firestoreService.saveBusiness(updatedBiz).catch(() => null);
            }
            sendPushNotification({
              type: 'system_alert',
              title: 'Services Catalog Updated',
              message: `Now offering ${updatedServices.length} operational capabilities. AI Monitor evaluating profile fit...`,
              priority: 'low',
              module: 'Service Catalog'
            });
            evaluateIndustryOptimization(updatedBiz);
          }}
          onRequestAISuggestionCheck={() => evaluateIndustryOptimization()}
        />

        {/* Proactive AI Industry Profile Optimization Modal (User must explicitly approve) */}
        {proactiveSuggestion && (
          <ProactiveIndustrySuggestionModal
            isOpen={isSuggestionModalOpen}
            onClose={() => setIsSuggestionModalOpen(false)}
            suggestion={proactiveSuggestion}
            business={activeBusiness}
            onApplyOptimization={handleApplyOptimization}
            onDismissSuggestion={handleDismissSuggestion}
          />
        )}

        {/* Industry Setup & Onboarding System */}
        {isOnboardingOpen && (
          <OnboardingModal
            initialBusiness={businessAccount}
            onCancel={() => setIsOnboardingOpen(false)}
            onComplete={(configuredBiz) => {
              // Record the creator as the company's owner so invites and
              // the team roster work. Existing member lists (re-opened
              // setup) are kept as-is.
              const ownerMember = currentUser
                ? {
                    userId: currentUser.id,
                    email: currentUser.email,
                    name: currentUser.fullName,
                    role: 'owner' as const,
                    avatar: currentUser.avatar,
                    joinedAt: new Date().toISOString()
                  }
                : undefined;
              const withOwner: BusinessAccount = {
                ...configuredBiz,
                // 'unassigned_owner' is a placeholder, not an owner — it
                // must never beat the real signed-in user, or the business
                // stays ownerless forever (roster empty, nobody matches).
                ownerId: (configuredBiz.ownerId && configuredBiz.ownerId !== 'unassigned_owner')
                  ? configuredBiz.ownerId
                  : (currentUser?.id || configuredBiz.ownerId),
                members: configuredBiz.members && configuredBiz.members.length > 0
                  ? configuredBiz.members
                  : ownerMember
                    ? [ownerMember]
                    : []
              };
              setBusinessAccount(withOwner);
              setCachedBusiness(currentUser, withOwner);
              // Stamp the company on the operator's login record so the
              // next sign-in resolves it by id instead of re-running setup.
              if (currentUser?.email) {
                const updatedUser = authService.updateStoredUser(currentUser.email, { businessId: withOwner.id });
                if (updatedUser) setCurrentUser(updatedUser);
              }
              apiFetch(`/api/business/${withOwner.id}`, {
                method: 'PUT',
                body: JSON.stringify(withOwner)
              }).catch(() => null);
              firestoreService.saveBusiness(withOwner).catch(() => {});
              setIndustryProfile(withOwner.industry);
              setIsOnboardingOpen(false);
              setOnboardingCompleted(currentUser);
              sendPushNotification({
                type: 'system_alert',
                title: 'Workspace Initialized',
                message: `System tailored for ${configuredBiz.name} (${configuredBiz.industry}).`,
                priority: 'medium',
                module: 'Core'
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
