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
    amount: number;
    totalAmount?: number;
    items?: Array<{ description: string; quantity?: number; unitPrice?: number; total?: number; amount?: number }>;
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
  };
  createdAt: string;
  updatedAt: string;
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
  urgency: 'low' | 'normal' | 'emergency' | 'routine';
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
  name: string;
  industry: string;
  size: string;
  services: string[];
  pricingApproach: string;
  brandTone: string;
  painPoints: string[];
  autonomyMode: AutonomyMode;
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
  sampleJobPacks: JobPack[];
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
  | 'more' 
  | 'settings'
  | 'activity'
  | 'approvals'
  | 'team'
  | 'jobpacks'
  | 'portal'
  | 'automation'
  | 'docs';

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

export interface AutomationTask {
  id: string;
  name: string;
  description: string;
  isAutomated: boolean;
  isCustom?: boolean;
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

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'System Administrator' | 'Operations Lead' | 'Field Manager' | 'AI Specialist';
  avatar: string;
  organization: string;
  authenticated: boolean;
  biometricsEnabled?: boolean;
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
