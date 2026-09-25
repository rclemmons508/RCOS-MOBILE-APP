// RC Solutions CRM Health Score Engine & Payment Sync
// Location: rcos/clients_crm/client_crm_health.ts

export interface ClientData {
  id: string;
  name: string;
  company: string;
  daysSinceLastContact: number;
  totalSpend: number;
  openUrgentTickets: number;
  satisfactionScore?: number; // 1-5 scale
  paymentDeficitDays?: number;
}

export interface HealthScoreBreakdown {
  totalScore: number;
  recencyScore: number;
  spendScore: number;
  ticketScore: number;
  paymentScore: number;
  tier: 'Diamond VIP' | 'Gold Enterprise' | 'Silver Standard' | 'At-Risk';
  churnRisk: 'low' | 'moderate' | 'high';
  recommendedAction: string;
}

export interface PaymentSyncResult {
  clientId: string;
  previousSpend: number;
  updatedSpend: number;
  previousHealthScore: number;
  newHealthScore: number;
  scoreDelta: number;
  statusMessage: string;
  syncedAt: string;
}

const CLIENT_CRM_REGISTRY = new Map<string, ClientData>([
  [
    'client-1',
    {
      id: 'client-1',
      name: 'Sarah Jenkins',
      company: 'Apex Commercial Tower',
      daysSinceLastContact: 2,
      totalSpend: 14850,
      openUrgentTickets: 0,
      satisfactionScore: 4.9,
      paymentDeficitDays: 0
    }
  ],
  [
    'client-2',
    {
      id: 'client-2',
      name: 'David Sterling',
      company: 'Sterling Logistics Hub',
      daysSinceLastContact: 4,
      totalSpend: 28400,
      openUrgentTickets: 0,
      satisfactionScore: 4.8,
      paymentDeficitDays: 0
    }
  ],
  [
    'client-3',
    {
      id: 'client-3',
      name: 'Elena Rostova',
      company: 'Vanguard Industrial Corp',
      daysSinceLastContact: 1,
      totalSpend: 54200,
      openUrgentTickets: 1,
      satisfactionScore: 4.6,
      paymentDeficitDays: 0
    }
  ],
  [
    'client-4',
    {
      id: 'client-4',
      name: 'Michael Chang',
      company: 'Horizon Health Clinic',
      daysSinceLastContact: 9,
      totalSpend: 8200,
      openUrgentTickets: 2,
      satisfactionScore: 3.4,
      paymentDeficitDays: 14
    }
  ]
]);

export function calculateHealthScore(client: ClientData): HealthScoreBreakdown {
  let recencyScore = 10;
  if (client.daysSinceLastContact <= 3) {
    recencyScore = 30;
  } else if (client.daysSinceLastContact <= 7) {
    recencyScore = 24;
  } else if (client.daysSinceLastContact <= 14) {
    recencyScore = 18;
  }

  const spendScore = Math.min(Math.round((client.totalSpend / 40000) * 35), 35);

  let ticketScore = 20;
  if (client.openUrgentTickets === 1) {
    ticketScore = 12;
  } else if (client.openUrgentTickets > 1) {
    ticketScore = Math.max(0, 20 - client.openUrgentTickets * 8);
  }

  const deficit = client.paymentDeficitDays || 0;
  let paymentScore = 15;
  if (deficit > 30) {
    paymentScore = 0;
  } else if (deficit > 14) {
    paymentScore = 5;
  } else if (deficit > 0) {
    paymentScore = 10;
  }

  const totalScore = Math.min(100, Math.max(0, recencyScore + spendScore + ticketScore + paymentScore));
  let tier: HealthScoreBreakdown['tier'] = 'Silver Standard';
  let churnRisk: HealthScoreBreakdown['churnRisk'] = 'low';
  let recommendedAction = 'Routine quarterly maintenance check-in.';

  if (totalScore >= 88) {
    tier = 'Diamond VIP';
    churnRisk = 'low';
    recommendedAction = 'Pitch executive enterprise automation expansion package.';
  } else if (totalScore >= 72) {
    tier = 'Gold Enterprise';
    churnRisk = 'low';
    recommendedAction = 'Schedule quarterly technology review with operations lead.';
  } else if (totalScore >= 50) {
    tier = 'Silver Standard';
    churnRisk = 'moderate';
    recommendedAction = 'Follow up on outstanding service items & conduct satisfaction survey.';
  } else {
    tier = 'At-Risk';
    churnRisk = 'high';
    recommendedAction = 'Trigger automated HITL supervisor escalation to avert account churn.';
  }

  return {
    totalScore,
    recencyScore,
    spendScore,
    ticketScore,
    paymentScore,
    tier,
    churnRisk,
    recommendedAction
  };
}

export function syncPaymentStatus(
  clientId: string,
  paymentAmount: number,
  isDeposit: boolean,
  daysLate: number = 0
): PaymentSyncResult {
  const existingClient = CLIENT_CRM_REGISTRY.get(clientId) || {
    id: clientId,
    name: 'Enterprise Client',
    company: 'Commercial Account',
    daysSinceLastContact: 0,
    totalSpend: 5000,
    openUrgentTickets: 0,
    satisfactionScore: 4.5,
    paymentDeficitDays: 0
  };

  const oldHealth = calculateHealthScore(existingClient);
  const previousSpend = existingClient.totalSpend;

  existingClient.totalSpend += paymentAmount;
  existingClient.daysSinceLastContact = 0;
  existingClient.paymentDeficitDays = Math.max(0, (existingClient.paymentDeficitDays || 0) - (daysLate > 0 ? 0 : 7));

  CLIENT_CRM_REGISTRY.set(clientId, existingClient);

  const newHealth = calculateHealthScore(existingClient);
  const scoreDelta = newHealth.totalScore - oldHealth.totalScore;
  const statusMessage = isDeposit
    ? `Successfully credited deposit of $${paymentAmount.toLocaleString()} to ${existingClient.company}. Account health updated to ${newHealth.totalScore}/100 (+${scoreDelta}).`
    : `Final settlement invoice of $${paymentAmount.toLocaleString()} recorded for ${existingClient.company}. Health score is now ${newHealth.totalScore}/100.`;

  return {
    clientId,
    previousSpend,
    updatedSpend: existingClient.totalSpend,
    previousHealthScore: oldHealth.totalScore,
    newHealthScore: newHealth.totalScore,
    scoreDelta,
    statusMessage,
    syncedAt: new Date().toISOString()
  };
}

export function getClientRecord(clientId: string): ClientData | undefined {
  return CLIENT_CRM_REGISTRY.get(clientId);
}
