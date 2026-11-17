import {
  NotificationPreferences,
  AutomationTask,
} from '../types';

// This file used to hold the original demo dataset (fake notifications,
// users, agents, calls, jobs, clients, messages, telemetry). All of it
// was deleted: demo content is never seeded into the app — every list
// starts empty and fills from the business's real records only.
//
// What remains here is NOT demo data: the two real defaults below, both
// imported by live code.
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

export const INITIAL_AUTOMATION_TASKS: AutomationTask[] = [
  {
    id: 'rule-welcome',
    name: 'Welcome new customers',
    description: 'When a new customer is added, Support drafts a welcome text for you to send from your phone. Nothing is sent until you tap Send now.',
    isAutomated: true,
    messageTemplate:
      "Hi {firstName}! Thanks for choosing {businessName} — we're glad you're here. Reply to this text anytime you need us.",
  },
  {
    id: 'rule-missed-call',
    name: 'Missed call follow-up',
    description: 'When a real call is missed, the Receptionist drafts a “sorry we missed you” text for you to send. Only real missed calls fire this.',
    isAutomated: true,
    messageTemplate:
      'Sorry we missed your call! This is {businessName} — how can we help? Reply here or call back anytime.',
  },
  {
    id: 'rule-review',
    name: 'Ask for reviews',
    description: 'After a job is marked done, Marketing drafts a review request for you to send from your phone. Nothing is sent until you tap Send now.',
    isAutomated: true,
    messageTemplate:
      'Hi {firstName}, thanks for trusting {businessName}! If we did a great job, a quick review here would mean the world: {reviewLink}',
  },
  {
    id: 'rule-emergency',
    name: 'Emergency escalation',
    description: 'When the receptionist routes an emergency call, create an escalation for the owner immediately.',
    isAutomated: true,
  },
  {
    id: 'rule-quote-gate',
    name: 'Quote approval gate',
    description: 'Hold any quote over the approval limit for the owner’s sign-off before it goes out.',
    isAutomated: true,
  },
  {
    id: 'rule-proactive',
    name: 'Proactive team check-ins',
    description: 'Your agents message you in the inbox — idle quotes, waiting requests, unpaid invoices.',
    isAutomated: true,
  },
];
