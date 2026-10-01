import React, { useState, useEffect } from 'react';
import { 
  TabType, 
  Agent, 
  PhoneCall, 
  Job, 
  Client, 
  RCOSFileItem, 
  SystemMetric, 
  RCOSNotification, 
  NotificationPreferences, 
  User, 
  TelemetryPoint,
  BusinessAccount,
  ActionRecord,
  CustomerRequest
} from './types';
import {
  INITIAL_AGENTS,
  INITIAL_CALLS,
  INITIAL_JOBS,
  INITIAL_CLIENTS,
  INITIAL_METRICS,
  INITIAL_NOTIFICATIONS,
  INITIAL_NOTIFICATION_PREFERENCES,
  INITIAL_USER,
  INITIAL_TELEMETRY_SERIES,
  INITIAL_AUTOMATION_TASKS,
  INITIAL_MESSAGES,
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
import { NotificationToast } from './components/notifications/NotificationToast';
import { NotificationCenterModal } from './components/notifications/NotificationCenterModal';
import { NotificationPreferencesModal } from './components/notifications/NotificationPreferencesModal';
import { AuthModal } from './components/auth/AuthModal';
import { useBiometrics } from './context/BiometricContext';
import { BiometricLockScreen } from './components/biometrics/BiometricLockScreen';
import { biometricService } from './services/biometricService';
import { LoginView } from './components/auth/LoginView';
import { authService } from './services/authService';
import { userPreferencesService } from './services/userPreferencesService';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { isDashboardLocked, isBiometricEnabled } = useBiometrics();

  // Authentication State - check for persistent active session on start
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getActiveSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Application Core Data
  const [agents] = useState<Agent[]>(INITIAL_AGENTS);
  const [calls, setCalls] = useState<PhoneCall[]>(INITIAL_CALLS);
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [metrics, setMetrics] = useState<SystemMetric>(INITIAL_METRICS);
  const [automationTasks, setAutomationTasks] = useState(INITIAL_AUTOMATION_TASKS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);

  // System Settings State (initialized from user preferences if available)
  const initialPrefs = currentUser?.email 
    ? userPreferencesService.getUserPreferences(currentUser.email)
    : null;

  const [industryProfile, setIndustryProfile] = useState(initialPrefs?.industryProfile || 'Commercial HVAC');
  const [telemetryIntervalMs, setTelemetryIntervalMs] = useState(initialPrefs?.telemetryIntervalMs || 3500);
  const [autoDispatchThreshold, setAutoDispatchThreshold] = useState<'all' | 'critical' | 'high' | 'manual'>(
    initialPrefs?.autoDispatchThreshold || 'all'
  );

  // Real-Time Telemetry Streaming State
  const [telemetrySeries, setTelemetrySeries] = useState<TelemetryPoint[]>(INITIAL_TELEMETRY_SERIES);

  // Notification System State
  const [notifications, setNotifications] = useState<RCOSNotification[]>(INITIAL_NOTIFICATIONS);
  const [notifPreferences, setNotifPreferences] = useState<NotificationPreferences>(
    initialPrefs?.notificationPreferences || INITIAL_NOTIFICATION_PREFERENCES
  );
  const [activePushToast, setActivePushToast] = useState<RCOSNotification | null>(null);
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [isNotifPrefsOpen, setIsNotifPrefsOpen] = useState(false);

  // Business context for Chat & Enterprise operations
  const [businessAccount] = useState<BusinessAccount>({
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    industry: 'Commercial Operations & Automation',
    size: '10-50 employees',
    services: ['Commercial HVAC', 'SCADA Automation', 'Industrial Electrical', 'Multi-Agent Operations'],
    pricingApproach: 'value_based',
    brandTone: 'Crisp, strategic, authoritative, and responsive',
    painPoints: ['Emergency dispatch latency', 'Off-hours voice routing'],
    autonomyMode: 'autonomous',
    dollarThreshold: 1500,
    activeEmployees: {},
    onboardingCompleted: true,
    starterDrafts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Real-Time Telemetry Pulse Simulator
  useEffect(() => {
    if (telemetryIntervalMs <= 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const newLatency = Math.floor(10 + Math.random() * 8); // 10ms - 18ms
      const newCpu = Math.floor(14 + Math.random() * 16);    // 14% - 30%
      const newMemory = Math.floor(28 + Math.random() * 8);

      setMetrics((prev) => ({
        ...prev,
        latencyMs: newLatency,
        cpuUsagePct: newCpu,
        memoryUsagePct: newMemory,
      }));

      setTelemetrySeries((prev) => {
        const updatedPoint: TelemetryPoint = {
          time: timeStr,
          cpu: newCpu,
          memory: newMemory,
          latency: newLatency,
          calls: metrics.callsHandled,
          jobs: metrics.jobsDispatched,
        };
        return [...prev.slice(1), updatedPoint];
      });
    }, telemetryIntervalMs);

    return () => clearInterval(interval);
  }, [telemetryIntervalMs, metrics.callsHandled, metrics.jobsDispatched]);

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
  const handleAddJob = (newJob: Job) => {
    setJobs((prev) => [newJob, ...prev]);
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
  };

  const handleDeleteJob = (id: string) => {
    setJobs((prev) => prev.filter(j => j.id !== id));
  };

  const handleAddClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
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
  };

  const handleDeleteClient = (id: string) => {
    setClients((prev) => prev.filter(c => c.id !== id));
  };

  const handleSimulateInboundCall = () => {
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

  const handleEmergencyJobTrigger = () => {
    const emergencyJob: Job = {
      id: 'RC-' + Math.floor(9000 + Math.random() * 900),
      title: 'Emergency Chiller & Automation Control Failure',
      clientName: 'Apex Tower Facilities',
      clientPhone: '+1 (555) 392-8811',
      address: '450 Tech Parkway, Building B',
      status: 'urgent',
      priority: 'critical',
      assignedTechnician: 'Marcus Vance (Senior Specialist)',
      estimatedValue: 2400,
      scheduledTime: 'Immediate Response',
      description: 'Critical chiller pump failure detected via RCOS live telemetry.',
      aiNotes: 'Auto-routed based on proximity and SLA requirements.',
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

  const handleLoginSuccess = (user: User) => {
    authService.saveActiveSession(user);
    setCurrentUser(user);
    setIsAuthModalOpen(false);

    // Load and apply that specific operator's personal preferences
    const prefs = userPreferencesService.getUserPreferences(user.email || user.id);
    setIndustryProfile(prefs.industryProfile || 'Commercial HVAC');
    setTelemetryIntervalMs(prefs.telemetryIntervalMs || 3500);
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
          currentUser={currentUser}
          onOpenNotifications={() => setIsNotifCenterOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenChat={() => setActiveTab('chat')}
          onOpenGmail={() => setActiveTab('gmail')}
        />

        {/* Tab Views Container with Safe Scrollable Bounds */}
        <main className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]">
          {activeTab === 'dashboard' && (
            <DashboardTab
              agents={agents}
              calls={calls}
              jobs={jobs}
              metrics={metrics}
              telemetrySeries={telemetrySeries}
              currentUser={currentUser}
              unreadNotifCount={unreadNotifCount}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSimulateCall={handleSimulateInboundCall}
              onTriggerEmergencyJob={handleEmergencyJobTrigger}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenNotifications={() => setIsNotifCenterOpen(true)}
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
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onAddJobFromEmail={(jobData) => {
                const newJob: Job = {
                  id: `job-${Date.now()}`,
                  title: jobData.title || 'Email Dispatch Request',
                  clientName: jobData.clientName || 'Gmail Client',
                  clientPhone: jobData.clientPhone || '(555) 019-4820',
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
              business={businessAccount}
              onUpdateBusiness={() => {}}
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

          {activeTab === 'chat' && (
            <GeminiChatView business={businessAccount} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              currentUser={currentUser}
              onLogout={handleLogout}
              automationTasks={automationTasks}
              onToggleAutomation={(taskId, isAutomated) => {
                setAutomationTasks(prev => prev.map(t => t.id === taskId ? { ...t, isAutomated } : t));
              }}
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
              telemetryIntervalMs={telemetryIntervalMs}
              onUpdateTelemetryInterval={(val) => {
                setTelemetryIntervalMs(val);
                if (currentUser?.email) {
                  userPreferencesService.saveUserPreferences(currentUser.email, { telemetryIntervalMs: val });
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
      </div>
    </div>
  );
}
