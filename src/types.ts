export type AutonomyMode = 'autonomous' | 'supervised';

export type RiskCategory = 
  | 'internal_draft'
  | 'routine_outbound'
  | 'commitment_outbound'
  | 'money_movement'
  | 'public_post'
  | 'system_settings';

export type ActionStatus = 
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

export type ActionType = 
  | 'send_message'
  | 'generate_quote'
  | 'schedule_job'
  | 'send_invoice'
  | 'post_content'
  | 'update_record'
  | 'draft_document'
  | 'safety_review'
  | 'operational_task';

export type PipelineStage = 
  | 'Intake'
  | 'Qualification'
  | 'Routing'
  | 'Execution'
  | 'Follow-Up'
  | 'Completion';

export interface TraceStep {
  stepNumber: number;
  stage: string;
  action: string;
  checked: string;
  ruleApplied: string;
  dataUsed: string;
  timestamp: string;
}

export interface ActionResult {
  summary: string;
  text?: string;
  structuredData?: Record<string, any>;
  quoteDetails?: {
    clientName: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
    validDays: number;
    terms?: string;
  };
  invoiceDetails?: {
    clientName: string;
    invoiceNumber: string;
    /**
     * Canonical invoice shape (Bug 3): `amount` and `totalAmount` are ALWAYS
     * kept equal. Older readers use `amount`; mark-paid reads `totalAmount`.
     */
    amount: number;
    totalAmount: number;
    /**
     * Canonical item shape: every item carries quantity, unitPrice, total
     * (= quantity × unitPrice) AND `amount` (= total, for older readers).
     */
    items?: Array<{ description: string; quantity: number; unitPrice: number; total: number; amount: number }>;
    dueDate: string;
    paymentInstructions?: string;
    notes?: string;
  };
  scheduleDetails?: {
    clientName: string;
    assignedTo: string;
    scheduledFor: string;
    address: string;
    jobTitle?: string;
    scheduledDate?: string;
    timeWindow?: string;
    assignedTech?: string;
  };
  messageDetails?: {
    recipient?: string;
    channel?: string;
    body?: string;
    message?: string;
    subject?: string;
  };
}

/**
 * One line item as edited by the owner in Review edit mode. `total` is
 * always recomputed as quantity × unitPrice before saving.
 */
export interface EditedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Structured amounts the owner edited in Review edit mode (Bug 3).
 * Sent alongside the free-text `editedContent` when the owner saves an edit.
 * `kind` selects which details block the edit applies to: 'quote' edits
 * `result.quoteDetails`, 'invoice' edits `result.invoiceDetails`.
 * `totalAmount` is the owner's final total — line-item edits recompute it as
 * the sum of item totals, and the owner may also type a total directly.
 * Invoice-only fields (invoiceNumber, dueDate, paymentInstructions, notes)
 * are omitted for quotes; `terms` is quote-only.
 */
export interface EditedAmounts {
  kind: 'quote' | 'invoice';
  clientName: string;
  items: EditedLineItem[];
  totalAmount: number;
  terms?: string;
  invoiceNumber?: string;
  dueDate?: string;
  paymentInstructions?: string;
  notes?: string;
}

export interface ActionRecord {
  id: string;
  businessId: string;
  title: string;
  description?: string;
  employeeId: string;
  actionType?: ActionType;
  requestId?: string;
  pipelineStage?: PipelineStage;
  status: ActionStatus;
  autonomyMode?: AutonomyMode;
  riskCategory: RiskCategory;
  financialAmount?: number;
  dollarAmount?: number;
  stepSummary?: string;
  requiresReview?: boolean;
  requiresApproval?: boolean;
  completedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerNote?: string;
  originalDraftContent?: string;
  currentDraftContent?: string;
  executionTrace?: TraceStep[];
  fullTrace?: TraceStep[];
  result?: ActionResult;
  safetyReasoning?: string;
  approvalDecision?: {
    decision: 'approved' | 'rejected' | 'edited';
    decidedAt: string;
    decidedBy?: string;
    reviewerNote?: string;
    editedContent?: string;
    /** Structured amounts applied on an 'edited' decision (Bug 3). */
    editedAmounts?: EditedAmounts;
  };
  createdAt: string;
  updatedAt: string;
  // Money-loop tracking
  paymentStatus?: 'unpaid' | 'paid';
  paidAt?: string;
  paidAmount?: number;
  // Pipeline linkage: quote -> job -> invoice
  scheduledJobId?: string;
  invoiceId?: string;
  jobId?: string;
  quoteId?: string;
}

// Pre-filled values for opening the invoice modal (e.g. from a completed job).
export interface InvoicePrefill {
  clientName: string;
  serviceName: string;
  amount: number;
  details?: string;
  jobId?: string;
}

export interface CustomerRequest {
  id: string;
  businessId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceCategory?: string;
  serviceType?: string;
  stage?: string;
  preferredContact?: string;
  preferredTime?: string;
  preferredDateTime?: string;
  flexibility?: string;
  specialInstructions?: string;
  serviceLocation?: string;
  description: string;
  urgency: 'low' | 'normal' | 'routine' | 'soon' | 'urgent' | 'emergency';
  address?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  routedActionId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JobPackItem {
  id: string;
  title: string;
  description: string;
  assignedEmployeeId: string;
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface JobPack {
  id: string;
  name?: string;
  description?: string;
  triggerEvent?: string;
  items?: JobPackItem[];
  serviceType: string;
  industry: string;
  checklist: string[];
  requiredTools: string[];
  safetyNotes: string[];
  troubleshootingNotes?: string[];
  workflowSequence: {
    preCheck?: string[];
    execute?: string[];
    cleanUp?: string[];
    clientConfirmation?: string[];
  };
}

export interface StarterDraft {
  id: string;
  title: string;
  type: 'quote_template' | 'follow_up_template';
  content: string;
  status: 'awaiting_approval' | 'approved' | 'rejected';
  createdAt: string;
}

export interface BusinessAccount {
  id: string;
  ownerId?: string;
  /**
   * People on this company account. The creator is the `owner`; everyone
   * who joins with an invite is a `member`. Empty on businesses created
   * before teams existed — the creator is treated as the owner then.
   */
  members?: BusinessMember[];
  name: string;
  /**
   * Owner's public contact profile, editable in Settings → My Profile.
   * contactEmail is the email customers see — it is separate from the
   * login email, which never changes here.
   */
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  /**
   * Profile picture: 'default:<id>' for one of the built-in pictures, or
   * a small downscaled photo as a data URL (<=200KB).
   */
  profilePicture?: string;
  industry: string;
  size: string;
  services: string[];
  /**
   * Departments this business offers for call transfers, worked out by the
   * server from the industry + services when the business is saved (at
   * onboarding and on every later save): every business gets sales,
   * support, billing, and emergency; dispatch is included only when the
   * business involves field/dispatch work or a skilled trade. The
   * receptionist only offers these departments, and the transfer picker
   * only shows them. Missing on older records — readers treat that as
   * "all departments".
   */
  availableDepartments?: string[];
  pricingApproach: string;
  brandTone: string;
  /**
   * "Teach Your Team": free-text business knowledge the owner writes once
   * in Settings (prices, policies, common questions) and every AI agent
   * reads as reference — agent chat, the automation engine, and the voice
   * receptionist. Optional; blank/absent means agents work exactly as
   * before. Capped at 8,000 characters (see utils/agentBehavior).
   */
  businessKnowledge?: string;
  painPoints: string[];
  autonomyMode: AutonomyMode;
  /**
   * Who answers incoming calls inside the app: 'ai' = the AI Receptionist
   * answers automatically after a short ring; 'manual' = calls ring for a
   * human to pick up. Stored on the business record (not in the parked
   * Twilio telephony config). Defaults to 'ai' when unset.
   */
  answeringMode?: 'ai' | 'manual';
  dollarThreshold: number;
  activeEmployees: Record<string, boolean>;
  onboardingCompleted: boolean;
  starterDrafts: StarterDraft[];
  createdAt: string;
  updatedAt: string;
}

export interface AIEmployee {
  id: string;
  name: string;
  roleTitle: string;
  department: string;
  avatarIcon: string;
  /** Voice of the assistant: professional, friendly, direct, or technical (RCOS brand config). */
  tone?: 'professional' | 'friendly' | 'direct' | 'technical';
  coreJob: string;
  escalatesTo: string;
  tagline: string;
  systemPromptRole: string;
}

export interface IndustryPreset {
  id: string;
  name: string;
  description: string;
  suggestedActiveEmployees: string[];
  defaultServices: string[];
  recommendedTone: string;
  technicianRoleName: string;
  /** Job positions shown on the registration screen for this industry. */
  staffRoles: string[];
  sampleJobPacks: JobPack[];
}

export interface IndustryOptimizationSuggestion {
  currentIndustryId: string;
  suggestedPresetId: string;
  suggestedPresetName: string;
  confidence: number;
  matchScore: number; // 0 to 100
  reason: string;
  newServicesDetected: string[];
  recommendedTone: string;
  technicianRoleName: string;
  suggestedServices: string[];
  activeEmployees: Record<string, boolean>;
  triggers: string[]; // reasons why current services diverge from current preset
}

/* -------------------------------------------------------------
 * MOBILE RCOS APPLICATION ARCHITECTURE TYPES
 * ------------------------------------------------------------- */

export type TabType =
  | 'dashboard'
  | 'phone'
  | 'jobs'
  | 'clients'
  | 'chat'
  | 'gmail'
  | 'settings'
  | 'approvals'
  | 'team'
  | 'team-chat'
  | 'more'
  | 'requests'
  | 'inbox';

export interface ChatMessage {
  id: string;
  senderId?: string;
  senderName?: string;
  text?: string;
  content?: string;
  timestamp: string;
  isCurrentUser?: boolean;
  avatar?: string;
  role?: 'user' | 'assistant' | 'model';
  modelUsed?: string;
  roleId?: string;
  businessId?: string;
  employeeId?: string;
}

// ---- Team (human-to-human) ----

export type TeamRole = 'owner' | 'member';

/** One person on a company account. Matched by email across devices. */
export interface BusinessMember {
  userId: string;
  email: string;
  name: string;
  role: TeamRole;
  avatar?: string;
  joinedAt: string;
}

/**
 * An invite to join a company. The code is shown once to the owner, who
 * shares it with the new team member. `email` is optional: when set, only
 * that email can use the code; when empty, anyone with the code can join.
 */
export interface TeamInvite {
  code: string;
  businessId: string;
  businessName: string;
  email?: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedByEmail?: string;
  revoked: boolean;
}

/**
 * One human-to-human team chat message. Lives in its own store, separate
 * from the AI-employee chat (ChatMessage) — these go to real people.
 */
export interface TeamMessage {
  id: string;
  businessId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
}

/**
 * A website demo-request that arrived while NO business existed yet.
 * Queued instead of lost (the old code answered 503 and dropped the lead);
 * flushed into Customer Requests as soon as a business is created.
 */
export interface PendingIntake {
  id: string;
  name: string;
  company: string;
  industry: string;
  message: string;
  phone: string;
  email: string;
  source: 'website';
  createdAt: string;
}

export interface AutomationTask {
  id: string;
  name: string;
  description: string;
  isAutomated: boolean;
  isCustom?: boolean;
  /** Paused rules stay on but never fire until resumed. */
  paused?: boolean;
  /** Run stats for Start/Pause/Resume/Reset controls. */
  runCount?: number;
  lastFiredAt?: string;
  /** Editable message template for follow-up rules. Placeholders: {firstName}, {businessName}, {reviewLink}. */
  messageTemplate?: string;
  /** Review-page link used by the review-request rule's {reviewLink}. */
  reviewLink?: string;
}

export interface RCOSNotification {
  id: string;
  type: 'system_alert' | 'performance_anomaly' | 'task_completion' | 'emergency_dispatch' | 'call_event';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  module?: 'Orchestrator' | 'Phone System' | 'Jobs Dispatcher' | 'Tasks Routing' | 'CRM' | 'Core' | string;
  actionTaken?: string;
}

// A proactive message from one of the AI agents to the owner. Agents post
// here when something needs the owner's eyes or a decision — the inbox is
// how the team "comes to you" instead of waiting to be tapped.
// (Named AgentInboxMessage to avoid clashing with the chat AgentMessage below.)
export type AgentId = 'sales' | 'operations' | 'marketing' | 'support' | 'receptionist' | 'system';
export type AgentMessageKind = 'alert' | 'suggestion' | 'question';
export type AgentMessageStatus = 'unread' | 'read' | 'answered' | 'dismissed' | 'snoozed';

export interface AgentInboxMessage {
  id: string;
  businessId: string;
  agent: AgentId;
  kind: AgentMessageKind;
  title: string;
  body: string;
  // Optional call-to-action: label shown on the button + tab it navigates to.
  actionLabel?: string;
  actionTab?: TabType;
  actionUrl?: string;
  status: AgentMessageStatus;
  responseText?: string;
  // Stable key used to avoid posting the same proactive message twice.
  dedupeKey?: string;
  createdAt: string;
  readAt?: string;
}

// Chat message used by the floating AI assistant (pre-existing type,
// kept as-is).
export interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    actionTaken?: string;
    targetModule?: string;
  };
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  systemAlerts: boolean;
  performanceAnomalies: boolean;
  taskCompletions: boolean;
  emergencyDispatches: boolean;
  callTranscripts: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  ringerMode?: 'sound' | 'vibrate' | 'silent';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface UserPreferences {
  industryProfile: string;
  telemetryIntervalMs: number;
  autoDispatchThreshold: 'all' | 'critical' | 'high' | 'manual';
  ringerMode: 'sound' | 'vibrate' | 'silent';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  biometricsEnabled: boolean;
  autoLockOnBackground: boolean;
  autoLockTimeoutMinutes: number;
  defaultTab?: TabType;
  theme?: 'dark' | 'light' | 'oled';
  notificationPreferences?: NotificationPreferences;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  /** Free-form role title — the registration screen offers per-industry options. */
  role: string;
  avatar: string;
  /**
   * Local SHA-256 hash of the account password + salt. The password itself
   * is NEVER stored. Login checks the typed password against this hash;
   * older accounts created before passwords were enforced have no hash
   * and adopt the password they next log in with (one-time migration).
   */
  passwordHash?: string;
  passwordSalt?: string;
  organization: string;
  /**
   * The company this login belongs to (owner or joined team member).
   * The app loads this business on sign-in instead of guessing.
   */
  businessId?: string;
  authenticated: boolean;
  biometricsEnabled?: boolean;
  biometricsEnrolledAt?: string;
  biometryType?: 'fingerprint' | 'face' | 'iris' | 'passcode';
  preferences?: UserPreferences;
  lastLogin?: string;
}

export interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number;
  latency: number;
  calls: number;
  jobs: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'active' | 'busy' | 'idle' | 'offline';
  description: string;
  currentTask?: string;
  tasksCompletedToday: number;
  accuracy: number;
  color: string;
}

export interface CallTranscriptEntry {
  speaker: 'RCOS AI' | 'Caller' | 'Human Operator' | string;
  text: string;
  time: string;
  audioBase64?: string;
}

export interface CallActionTriggered {
  id: string;
  type: 'send_email' | 'request_quote_approval' | 'transfer_call' | 'take_message' | 'dispatch_job';
  description: string;
  status: 'completed' | 'pending';
  timestamp: string;
  details?: Record<string, any>;
}

export interface VoicemailRecord {
  id: string;
  callerName: string;
  callerNumber: string;
  company?: string;
  timestamp: string;
  duration: string;
  transcription: string;
  summary: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  department?: string;
  audioBase64?: string;
  audioUrl?: string;
  emailSent?: boolean;
  quoteRequested?: boolean;
  reviewed: boolean;
}

export interface DepartmentTransfer {
  id: string;
  name: string;
  extension: string;
  leadName: string;
  description: string;
  status: 'available' | 'busy' | 'on_call';
  realPhoneNumber?: string;
}

export interface TelephonyConfig {
  provider: 'twilio' | 'custom_sip';
  accountSidConfigured: boolean;
  authTokenConfigured: boolean;
  phoneNumber: string;
  webhookUrl: string;
  answeringStrategy: 'ai_first' | 'human_first' | 'simultaneous_ring';
  ringDurationSeconds: number;
  operatorForwardingPhone: string;
  departmentForwardingNumbers: {
    dispatch: string;
    billing: string;
    emergency: string;
    sales: string;
    support: string;
  };
  greetingMessage: string;
  ttsVoice: string;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  liveCallsActive: number;
}

export interface PhoneCall {
  id: string;
  callerName: string;
  callerNumber: string;
  type: 'inbound' | 'outbound' | 'missed';
  status: 'active' | 'ringing' | 'completed' | 'voicemail' | 'transcribing' | 'transferred' | 'missed';
  timestamp: string;
  duration: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'urgent';
  transcript?: CallTranscriptEntry[];
  actionRequired?: string;
  answeredBy?: 'ai_receptionist' | 'human_operator';
  transferredTo?: string;
  department?: string;
  voicemailAudioBase64?: string;
  actionsTriggered?: CallActionTriggered[];
  twilioCallSid?: string;
  recordingUrl?: string;
  forwardedToNumber?: string;
  isRealPstnCall?: boolean;
}

export interface Job {
  id: string;
  title: string;
  clientName: string;
  clientPhone: string;
  address: string;
  status: 'unassigned' | 'dispatched' | 'in_progress' | 'completed' | 'urgent';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTechnician?: string;
  estimatedValue: number;
  scheduledTime: string;
  description: string;
  aiNotes?: string;
  category: 'HVAC' | 'Electrical' | 'Automation' | 'Security' | 'Maintenance' | 'Software AI';
  quoteId?: string;
  invoiceId?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: 'active' | 'lead' | 'vip' | 'inactive';
  healthScore: number; // 0 - 100
  totalSpent: number;
  activeJobsCount: number;
  lastContactDate: string;
  aiSummary: string;
  tags: string[];
}

export interface RCOSFileItem {
  id: string;
  name: string;
  path: string;
  size: string;
  type: 'agent' | 'workflow' | 'config' | 'service' | 'doc' | 'code';
  module: 
    | 'Orchestrator' 
    | 'Phone System' 
    | 'Jobs Dispatcher' 
    | 'CRM' 
    | 'Core Platform' 
    | 'Guardrails & HITL' 
    | 'Observability' 
    | 'Billing & Finance' 
    | 'Knowledge & RAG' 
    | string;
  content?: string;
  lastModified: string;
}

export interface SystemMetric {
  agentsActive: number;
  latencyMs: number;
  callsHandled: number;
  jobsDispatched: number;
  activeClients: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
}
