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
  InvoicePrefill
} from './types';
import {
  INITIAL_NOTIFICATION_PREFERENCES,
  INITIAL_AUTOMATION_TASKS,
} from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { DashboardTab } from './components/tabs/DashboardTab';
import { PhoneSystemTab } from './components/tabs/PhoneSystemTab';
import { JobsTab } from './components/tabs/JobsTab';
import { ClientsTab } from './components/tabs/ClientsTab';
import { SettingsTab } from './components/tabs/SettingsTab';
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
import { firestoreService } from './services/firestoreService';
import { userPreferencesService } from './services/userPreferencesService';
import { apiFetch } from './lib/api';
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

const toLocalStorageBusiness = (business: BusinessAccount): Omit<BusinessAccount, 'activeEmployees'> => {
  const { activeEmployees: _activeEmployees, ...safeBusiness } = business;
  return safeBusiness;
};

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { isDashboardLocked, isBiometricEnabled, unenrollBiometrics } = useBiometrics();

  // Authentication State - starts from scratch (no preloaded user profile)
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getActiveSession());
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
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(() => {
    try {
      const stored = localStorage.getItem('rcos_configured_business');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id === 'biz_rc_solutions' || parsed?.id === 'biz_1790297242341') {
          localStorage.removeItem('rcos_configured_business');
          localStorage.removeItem('rcos_onboarding_completed');
          return null;
        }
        return parsed;
      }
    } catch {}
    return null;
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
    return localStorage.getItem('rcos_onboarding_completed') !== 'true';
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
          setProactiveSuggestion(res.suggestion);
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
      localStorage.setItem('rcos_configured_business', JSON.stringify(toLocalStorageBusiness(updatedBiz)));
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

  // Sync business account with server database on startup
  useEffect(() => {
    apiFetch<BusinessAccount[]>('/api/businesses')
      .then((businesses) => {
        if (Array.isArray(businesses) && businesses.length > 0) {
          const biz = businesses[0];
          if (biz.id && biz.id !== 'biz_rc_solutions' && biz.id !== 'biz_1790297242341') {
            setBusinessAccount(biz);
          }
        }
      })
      .catch(() => {});
  }, []);

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
        logAutomationFired('rule-emergency', 'Emergency escalation', action.title);
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
      const smsUrl = buildSmsUrl(item.to, text);
      const body =
        `Draft ready to send to ${item.toName || 'this customer'} (${item.to}). Nothing has been sent yet — tap Send now to open your texting app with this pre-filled, then tap Dismiss once you've sent it.\n\n"${text}"`;
      try {
        await agentInboxService.create(bizId, {
          agent: meta.agent,
          kind: 'suggestion',
          title: meta.titleFor(item.toName),
          body,
          actionLabel: 'Send now',
          actionUrl: smsUrl,
          dedupeKey: item.dedupeKey,
        });
        logAutomationFired(item.ruleId, task.name, `Draft ready for ${item.toName || item.to}`);
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

  useSyncEngine(
    useCallback(async () => {
      await Promise.allSettled([pingHealth(), refetchActions(), refetchRequests(), pollVoiceRouting(), pollProactive(), pollFollowups()]);
    }, [pingHealth, refetchActions, refetchRequests, pollVoiceRouting, pollProactive, pollFollowups]),
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

  const handleApprovalDecision = async (
    actionId: string,
    decision: 'approved' | 'rejected' | 'edited',
    editedContent?: string,
    note?: string
  ) => {
    const target = actions.find((x) => x.id === actionId);
    // Server-owned actions go through the API; local emergency escalations are handled on-device.
    if (target && !target.id.startsWith('local-emg-') && businessAccount?.id) {
      try {
        const updated = await apiFetch<ActionRecord>(
          `/api/business/${businessAccount.id}/actions/${actionId}/decide`,
          {
            method: 'POST',
            body: JSON.stringify({ decision, editedContent, reviewerNote: note }),
          }
        );
        setActions((prev) => prev.map((x) => (x.id === actionId ? updated : x)));
        return;
      } catch {
        /* fall through to local update */
      }
    }
    setActions((prev) =>
      prev.map((act) =>
        act.id === actionId
          ? {
              ...act,
              status: decision === 'rejected' ? 'rejected' : 'approved',
              reviewedAt: new Date().toISOString(),
              reviewerNote: note,
              approvalDecision: {
                decision,
                decidedAt: new Date().toISOString(),
                reviewerNote: note,
                ...(editedContent ? { editedContent } : {}),
              },
              ...(editedContent ? { currentDraftContent: editedContent } : {}),
            }
          : act
      )
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
    authService.saveActiveSession(user);
    setCurrentUser(user);
    setIsAuthModalOpen(false);

    // If onboarding not yet completed for user, open it
    const completed = localStorage.getItem('rcos_onboarding_completed');
    if (completed !== 'true') {
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

  const handleLogout = async () => {
    await authService.logout();
    biometricService.setLocked(false);
    // Remove the device's biometric enrollment too, so the login screen never
    // shows the previous operator's email after logout.
    unenrollBiometrics();
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
          onView={(_notif) => {
            setActivePushToast(null);
            setIsNotifCenterOpen(true);
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
              industryName={activeBusiness.industry || 'Field Operations'}
              serverOnline={serverOnline}
              pendingApprovals={actions.filter((x) => x.status === 'awaiting_approval').length}
              activeEmployees={activeBusiness.activeEmployees}
              customerRequests={customerRequests}
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

          {activeTab === 'settings' && (
            <SettingsTab
              currentUser={currentUser}
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
              industryName={businessAccount?.industry || industryProfile}
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
            />
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
            localStorage.setItem('rcos_configured_business', JSON.stringify(toLocalStorageBusiness(updatedBiz)));
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
              setBusinessAccount(configuredBiz);
              firestoreService.saveBusiness(configuredBiz).catch(() => {});
              setIndustryProfile(configuredBiz.industry);
              setIsOnboardingOpen(false);
              localStorage.setItem('rcos_onboarding_completed', 'true');
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
