import { 
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
  AutomationTask,
  ChatMessage
} from '../types';

export const INITIAL_NOTIFICATIONS: RCOSNotification[] = [
  {
    id: 'notif-1',
    type: 'emergency_dispatch',
    title: 'Urgent Task Auto-Routed',
    message: 'RCOS Task #RC-9042 (Priority Client Request) auto-assigned to Senior Agent Marcus Vance.',
    timestamp: '5 mins ago',
    read: false,
    priority: 'critical',
    module: 'Jobs Dispatcher',
    actionTaken: 'Route Sent to Tech'
  },
  {
    id: 'notif-2',
    type: 'performance_anomaly',
    title: 'Voice AI Anomaly Resolved',
    message: 'RCOS Phone System detected 12ms latency spike during Apex Tower call. Auto-rebalanced to Gemini 2.5 Flash node.',
    timestamp: '15 mins ago',
    read: false,
    priority: 'high',
    module: 'Phone System',
    actionTaken: 'Latency Normalised'
  },
  {
    id: 'notif-3',
    type: 'task_completion',
    title: 'Multi-Agent RCOS Cloud Deployment Complete',
    message: 'Vanguard Industrial Corp instance deployed successfully with 100% test coverage.',
    timestamp: '1 hour ago',
    read: true,
    priority: 'medium',
    module: 'Orchestrator',
    actionTaken: 'Client Invoiced'
  },
  {
    id: 'notif-4',
    type: 'system_alert',
    title: 'RCOS System Maintenance Notice',
    message: 'Scheduled multi-agent model weights update complete. All 4 active agent subroutines operational.',
    timestamp: '3 hours ago',
    read: true,
    priority: 'low',
    module: 'Core'
  }
];

export const INITIAL_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  systemAlerts: true,
  performanceAnomalies: true,
  taskCompletions: true,
  emergencyDispatches: true,
  callTranscripts: true,
  soundEnabled: true,
  vibrationEnabled: true,
  ringerMode: 'sound',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00'
};

export const INITIAL_USER: User = {
  id: 'usr-rcos-admin',
  email: 'rcsolutions@gmail.com',
  fullName: 'RC Solutions Lead Operator',
  role: 'System Administrator',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
  organization: 'RC Solutions Enterprise Systems',
  authenticated: true,
  biometricsEnabled: true,
  lastLogin: 'Today at 23:00'
};

export const INITIAL_TELEMETRY_SERIES: TelemetryPoint[] = [
  { time: '22:40', cpu: 14, memory: 28, latency: 12, calls: 24, jobs: 8 },
  { time: '22:45', cpu: 22, memory: 31, latency: 16, calls: 28, jobs: 9 },
  { time: '22:50', cpu: 19, memory: 30, latency: 13, calls: 31, jobs: 11 },
  { time: '22:55', cpu: 27, memory: 35, latency: 21, calls: 34, jobs: 12 },
  { time: '23:00', cpu: 18, memory: 34, latency: 14, calls: 38, jobs: 14 }
];

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-orchestrator',
    name: 'RCOS System Orchestrator',
    role: 'Central Routing & Multi-Agent Core',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
    status: 'active',
    description: 'Coordinates inter-agent workflows, routes system tasks, and executes cross-platform decisions.',
    currentTask: 'Routing inbound client request to Task Agent',
    tasksCompletedToday: 142,
    accuracy: 99.8,
    color: '#84CC16', // Neon Green
  },
  {
    id: 'agent-phone',
    name: 'Voice AI Comm Agent',
    role: 'Inbound IVR & Comms Assistant',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    status: 'active',
    description: '24/7 AI communication system answering inquiries, capturing details, and scheduling tasks automatically.',
    currentTask: 'Handling inbound comms from Metro Commercial Group',
    tasksCompletedToday: 38,
    accuracy: 98.5,
    color: '#3B82F6', // Blue
  },
  {
    id: 'agent-jobs',
    name: 'Smart Task Router',
    role: 'Operations & Resource Router',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    status: 'busy',
    description: 'Optimizes resource routing, estimates task parameters, and updates clients on status.',
    currentTask: 'Calculating optimal resource assignment for Urgent Task',
    tasksCompletedToday: 29,
    accuracy: 99.2,
    color: '#EAB308', // Yellow/Gold
  },
  {
    id: 'agent-crm',
    name: 'Client Nurture Agent',
    role: 'CRM & Automated Follow-Ups',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    status: 'idle',
    description: 'Monitors client health scores, manages billing, and drafts personalized communications.',
    currentTask: 'Awaiting next trigger',
    tasksCompletedToday: 54,
    accuracy: 97.9,
    color: '#A855F7', // Purple
  },
];

export const INITIAL_CALLS: PhoneCall[] = [
  {
    id: 'call-101',
    callerName: 'Sarah Jenkins (Apex Tower)',
    callerNumber: '+1 (555) 392-8811',
    type: 'inbound',
    status: 'completed',
    timestamp: '10 mins ago',
    duration: '2m 14s',
    summary: 'Caller reported an urgent priority issue. RCOS Voice AI logged request and scheduled resource allocation.',
    sentiment: 'urgent',
    transcript: [
      { speaker: 'RCOS AI', text: 'Thank you for calling RC Solutions. How can RCOS assist you today?', time: '00:02' },
      { speaker: 'Sarah', text: 'Hi! We have an urgent chiller control issue that needs immediate attention from your team.', time: '00:10' },
      { speaker: 'RCOS AI', text: 'I understand this is urgent, Sarah. I have identified your account at Apex Tower. Creating a Priority 1 ticket and routing to senior specialist Marcus Vance now.', time: '00:25' },
      { speaker: 'Sarah', text: 'Thank you so much! Please send confirmation.', time: '00:40' },
      { speaker: 'RCOS AI', text: 'Confirmation has been sent. Marcus is reviewing the ticket now.', time: '00:55' }
    ],
    actionRequired: 'Assigned Task #RC-9042 to Marcus Vance'
  },
  {
    id: 'call-102',
    callerName: 'David Sterling (Sterling Logistics)',
    callerNumber: '+1 (555) 741-2290',
    type: 'inbound',
    status: 'completed',
    timestamp: '1 hour ago',
    duration: '1m 45s',
    summary: 'Inquired about expanding their RCOS AI automation workflow to 3 additional warehouse locations.',
    sentiment: 'positive',
    transcript: [
      { speaker: 'RCOS AI', text: 'Welcome back David! RC Solutions AI Assistant here. How can I help Sterling Logistics today?', time: '00:03' },
      { speaker: 'David', text: 'Hey! The automated dispatch system you installed is working great. We want to roll it out to Dallas and Atlanta.', time: '00:18' },
      { speaker: 'RCOS AI', text: 'That is fantastic news, David! I have pre-filled an expansion proposal draft and notified your account manager.', time: '00:32' }
    ]
  },
  {
    id: 'call-103',
    callerName: 'Robert Thorne (Metro Commercial)',
    callerNumber: '+1 (555) 201-9944',
    type: 'missed',
    status: 'voicemail',
    timestamp: '2 hours ago',
    duration: '0m 42s',
    summary: 'Voicemail left inquiring about smart building sensor calibration and pricing. AI generated proposal email follow-up draft.',
    sentiment: 'neutral'
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'RC-9042',
    title: 'Emergency Chiller & Control Unit Diagnosis',
    clientName: 'Apex Tower Facilities',
    clientPhone: '+1 (555) 392-8811',
    address: '450 Tech Parkway, Suite 1200',
    status: 'urgent',
    priority: 'critical',
    assignedTechnician: 'Marcus Vance (Senior Specialist)',
    estimatedValue: 1450,
    scheduledTime: 'Immediate (ETA 20 mins)',
    description: 'Critical system issue reported. Immediate emergency response needed.',
    aiNotes: 'RCOS AI Auto-Assigned based on highest specialist rating and proximity.',
    category: 'HVAC'
  },
  {
    id: 'RC-9041',
    title: 'System Integration Setup & Calibration',
    clientName: 'Sterling Logistics',
    clientPhone: '+1 (555) 741-2290',
    address: '880 Logistics Way, Bay 4',
    status: 'in_progress',
    priority: 'medium',
    assignedTechnician: 'Elena Rostova',
    estimatedValue: 3200,
    scheduledTime: 'Today at 2:00 PM',
    description: 'Upgrading core systems to integrate with RCOS gateway modules for live telemetry.',
    aiNotes: 'Phase 1 completed. Calibration in progress.',
    category: 'Automation'
  },
  {
    id: 'RC-9040',
    title: 'Commercial Compliance & Access Audit',
    clientName: 'Metro Commercial Group',
    clientPhone: '+1 (555) 201-9944',
    address: '120 Downtown Plaza',
    status: 'dispatched',
    priority: 'high',
    assignedTechnician: 'Carlos Diaz',
    estimatedValue: 2800,
    scheduledTime: 'Tomorrow at 9:00 AM',
    description: 'Annual compliance inspection of systems and operational protocols.',
    aiNotes: 'Client requested pre-meeting alert 1 hour before arrival.',
    category: 'Security'
  },
  {
    id: 'RC-9039',
    title: 'AI Multi-Agent RCOS Software Deployment',
    clientName: 'Vanguard Industrial Corp',
    clientPhone: '+1 (555) 600-4321',
    address: '100 Industrial Parkway',
    status: 'completed',
    priority: 'high',
    assignedTechnician: 'AI Cloud Dispatcher',
    estimatedValue: 8500,
    scheduledTime: 'Completed Today at 10:15 AM',
    description: 'Deployed custom RCOS multi-agent instance on client private cloud environment.',
    aiNotes: 'Automated verification test passed with 100% test coverage.',
    category: 'Software AI'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client-1',
    name: 'Sarah Jenkins',
    company: 'Apex Tower Facilities',
    phone: '+1 (555) 392-8811',
    email: 'sjenkins@apextower.com',
    status: 'vip',
    healthScore: 96,
    totalSpent: 42800,
    activeJobsCount: 1,
    lastContactDate: '10 mins ago',
    aiSummary: 'High-value enterprise customer with 24/7 service agreement. Highly responsive to automated SMS updates.',
    tags: ['Enterprise', '24/7 SLA', 'HVAC & Power']
  },
  {
    id: 'client-2',
    name: 'David Sterling',
    company: 'Sterling Logistics',
    phone: '+1 (555) 741-2290',
    email: 'd.sterling@sterlinglogistics.io',
    status: 'active',
    healthScore: 92,
    totalSpent: 28500,
    activeJobsCount: 1,
    lastContactDate: '1 hour ago',
    aiSummary: 'Rapidly growing logistics account. Currently discussing multi-site expansion for RCOS AI automation.',
    tags: ['Automation', 'Expansion Opportunity', 'Logistics']
  },
  {
    id: 'client-3',
    name: 'Robert Thorne',
    company: 'Metro Commercial Group',
    phone: '+1 (555) 201-9944',
    email: 'rthorne@metrocommercial.net',
    status: 'active',
    healthScore: 88,
    totalSpent: 19400,
    activeJobsCount: 1,
    lastContactDate: 'Yesterday',
    aiSummary: 'Commercial real estate portfolio manager with 12 properties. Annual compliance audit scheduled.',
    tags: ['Commercial', 'Security', 'Annual Contract']
  },
  {
    id: 'client-4',
    name: 'Amanda Vance',
    company: 'Vanguard Industrial Corp',
    phone: '+1 (555) 600-4321',
    email: 'avance@vanguardind.com',
    status: 'vip',
    healthScore: 99,
    totalSpent: 85000,
    activeJobsCount: 0,
    lastContactDate: '3 days ago',
    aiSummary: 'Key technology partner utilizing custom RCOS multi-agent cloud workflows. High expansion potential.',
    tags: ['AI Software', 'Cloud Enterprise', 'Custom RCOS']
  }
];

export const INITIAL_FILES: RCOSFileItem[] = [];

export const INITIAL_METRICS: SystemMetric = {
  agentsActive: 4,
  latencyMs: 14,
  callsHandled: 38,
  jobsDispatched: 14,
  activeClients: 42,
  cpuUsagePct: 18,
  memoryUsagePct: 34
};

export const INITIAL_AUTOMATION_TASKS: AutomationTask[] = [
  {
    id: 'task-1',
    name: 'Urgent Matters Routing',
    description: 'Automatically route urgent matters to the appropriate specialist based on SLA priority.',
    isAutomated: true,
  },
  {
    id: 'task-2',
    name: 'Customer Issue Resolution',
    description: 'Allow AI to automatically provide troubleshooting steps or generate tickets for client issues.',
    isAutomated: false,
  },
  {
    id: 'task-3',
    name: 'Billing & Payments',
    description: 'Auto-process payments upon task completion and send receipts.',
    isAutomated: false,
  },
  {
    id: 'task-4',
    name: 'Sending Invoices',
    description: 'Automatically generate and email invoices once a task is closed out.',
    isAutomated: true,
  },
];

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    senderId: 'user-2',
    senderName: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    text: 'Hey team, I just closed the Apex integration issue. Everything looks green.',
    timestamp: '10:42 AM',
    isCurrentUser: false,
  },
  {
    id: 'msg-2',
    senderId: 'user-3',
    senderName: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    text: 'Great job Marcus. I will follow up with their billing department to send the invoice.',
    timestamp: '10:45 AM',
    isCurrentUser: false,
  }
];
