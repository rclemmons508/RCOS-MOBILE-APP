// RC Solutions Human-in-the-Loop & Guardrails Fallback Agent
// Location: rcos/agents/hitl_escalation_handler.ts

export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';
export type EscalationChannel = 'phone_ivr' | 'web_chat' | 'job_dispatch' | 'billing_settlement';
export type TicketStatus = 'pending_review' | 'operator_assigned' | 'in_progress' | 'resolved' | 'rejected';

export interface ConfidenceThresholds {
  criticalInterceptThreshold: number; // e.g. < 0.72 triggers automatic block
  operatorReviewThreshold: number;    // e.g. < 0.86 triggers asynchronous supervisor review
}

export interface HallucinationCheckResult {
  flagged: boolean;
  score: number; // 0 (safe) to 1.0 (high hallucination likelihood)
  reasons: string[];
  unverifiedClaims: string[];
  groundingPassed: boolean;
}

export interface SentimentAnalysisResult {
  sentimentScore: number; // -1.0 (very negative/hostile) to +1.0 (very positive)
  containsAngerOrFrustration: boolean;
  containsLegalOrRegulatoryRisk: boolean;
  containsChurnIntent: boolean;
  detectedKeywords: string[];
  requiresImmediateHumanTakeover: boolean;
}

export interface EscalationTicket {
  id: string;
  sourceAgentId: string;
  sourceAgentName: string;
  channel: EscalationChannel;
  priority: EscalationPriority;
  status: TicketStatus;
  reason: 
    | 'low_confidence_decision'
    | 'hallucination_detected'
    | 'sensitive_customer_sentiment'
    | 'unauthorized_action_attempt'
    | 'policy_guardrail_breach'
    | 'manual_operator_request';
  clientIdentifier: string;
  clientName: string;
  callerNumber?: string;
  contextSummary: string;
  aiSuggestedAction: string;
  interceptedResponse: string;
  humanOperatorHoldScript: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  operatorNotes?: string;
  resolutionTime?: string;
  createdAt: string;
}

export class HITLEscalationHandler {
  private thresholds: ConfidenceThresholds = {
    criticalInterceptThreshold: 0.72,
    operatorReviewThreshold: 0.86
  };

  private activeEscalationQueue: EscalationTicket[] = [
    {
      id: 'HITL-8041',
      sourceAgentId: 'agent-phone',
      sourceAgentName: 'Voice AI Comm Agent',
      channel: 'phone_ivr',
      priority: 'critical',
      status: 'pending_review',
      reason: 'sensitive_customer_sentiment',
      clientIdentifier: 'client-4',
      clientName: 'Michael Chang (Horizon Health)',
      callerNumber: '+1 (555) 942-1088',
      contextSummary: 'Client reported secondary air compressor outage following yesterday service. Expressed urgency and dissatisfaction.',
      aiSuggestedAction: 'Immediate dispatch of Senior Specialist without diagnostic deposit.',
      interceptedResponse: 'I will dispatch a technician right away without any fee.',
      humanOperatorHoldScript: 'I completely understand your urgency, Dr. Chang. Because this involves surgical cooling, I am patching you directly into our senior operations dispatcher, Marcus Vance.',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
    },
    {
      id: 'HITL-8039',
      sourceAgentId: 'agent-jobs',
      sourceAgentName: 'Smart Task Router',
      channel: 'job_dispatch',
      priority: 'high',
      status: 'operator_assigned',
      reason: 'low_confidence_decision',
      clientIdentifier: 'client-3',
      clientName: 'Elena Rostova (Vanguard)',
      contextSummary: 'Job estimate exceeded standard automated ceiling ($18,500 electrical overhaul). Confidence score was 0.64.',
      aiSuggestedAction: 'Authorize custom commercial contract and lock technician schedule for 3 consecutive days.',
      interceptedResponse: 'Automated contract generated for $18,500.',
      humanOperatorHoldScript: 'This scope requires senior engineer sign-off to ensure accurate material pricing.',
      assignedOperatorId: 'usr-rcos-admin',
      assignedOperatorName: 'RC Solutions Lead Operator',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    }
  ];

  // Hallucination keywords and boundary triggers
  private hallucinationForbiddenTokens = [
    'guarantee 100% free',
    'lifetime free warranty',
    'i can waive all state taxes',
    'our ceo personally approved',
    'unlimited complimentary hardware'
  ];

  // Sensitive escalation triggers
  private escalationKeywords = [
    'cancel my account',
    'lawsuit',
    'lawyer',
    'legal action',
    'sue you',
    'fraud',
    'scam',
    'supervisor now',
    'human operator',
    'unacceptable service',
    'regulatory violation',
    'better business bureau'
  ];

  public evaluateConfidence(
    confidenceScore: number,
    agentId: string,
    agentName: string,
    decisionContext: {
      action: string;
      channel: EscalationChannel;
      clientName: string;
      clientId: string;
      draftResponse: string;
    }
  ): { intercepted: boolean; ticket?: EscalationTicket; message: string } {
    if (confidenceScore < this.thresholds.criticalInterceptThreshold) {
      const ticket = this.createTicket({
        sourceAgentId: agentId,
        sourceAgentName: agentName,
        channel: decisionContext.channel,
        priority: 'critical',
        reason: 'low_confidence_decision',
        clientIdentifier: decisionContext.clientId,
        clientName: decisionContext.clientName,
        contextSummary: `Confidence score (${(confidenceScore * 100).toFixed(1)}%) fell below critical safety threshold (${this.thresholds.criticalInterceptThreshold * 100}%).`,
        aiSuggestedAction: decisionContext.action,
        interceptedResponse: decisionContext.draftResponse,
        humanOperatorHoldScript: this.generateHoldScript(decisionContext.clientName, 'low_confidence_decision')
      });

      return {
        intercepted: true,
        ticket,
        message: `Decision halted by RCOS Guardrails: Low confidence (${(confidenceScore * 100).toFixed(1)}%). Routed to human operator.`
      };
    }

    return {
      intercepted: false,
      message: `Confidence verified (${(confidenceScore * 100).toFixed(1)}%). Proceeding within safety bounds.`
    };
  }

  public scanForHallucinations(text: string, groundedSOPs: string[] = []): HallucinationCheckResult {
    const lower = text.toLowerCase();
    const unverifiedClaims: string[] = [];
    const reasons: string[] = [];

    for (const token of this.hallucinationForbiddenTokens) {
      if (lower.includes(token)) {
        unverifiedClaims.push(`Unauthorized guarantee token detected: "${token}"`);
        reasons.push(`AI attempted to offer legally binding commitment outside agent autonomy.`);
      }
    }

    if (/\$0(\.00)?(\s|$)/.test(text) && !text.includes('free assessment policy')) {
      unverifiedClaims.push('Zero-dollar unauthorized billing assertion.');
      reasons.push('Model hallucinated free field labor.');
    }

    const flagged = unverifiedClaims.length > 0;
    const score = flagged ? 0.85 : 0.05;

    return {
      flagged,
      score,
      reasons,
      unverifiedClaims,
      groundingPassed: !flagged
    };
  }

  public detectSensitiveCustomerSentiment(userInput: string): SentimentAnalysisResult {
    const lower = userInput.toLowerCase();
    const detectedKeywords: string[] = [];
    let containsAnger = false;
    let containsLegal = false;
    let containsChurn = false;

    for (const kw of this.escalationKeywords) {
      if (lower.includes(kw)) {
        detectedKeywords.push(kw);
        if (['lawyer', 'lawsuit', 'legal action', 'sue you', 'fraud', 'regulatory violation'].includes(kw)) {
          containsLegal = true;
        } else if (['cancel my account', 'switching to competitor'].includes(kw)) {
          containsChurn = true;
        } else {
          containsAnger = true;
        }
      }
    }

    const requiresImmediateHumanTakeover = containsLegal || containsChurn || detectedKeywords.length >= 2;
    const sentimentScore = requiresImmediateHumanTakeover ? -0.85 : detectedKeywords.length > 0 ? -0.45 : 0.2;

    return {
      sentimentScore,
      containsAngerOrFrustration: containsAnger,
      containsLegalOrRegulatoryRisk: containsLegal,
      containsChurnIntent: containsChurn,
      detectedKeywords,
      requiresImmediateHumanTakeover
    };
  }

  public createTicket(
    data: Omit<EscalationTicket, 'id' | 'createdAt' | 'status'>
  ): EscalationTicket {
    const newTicket: EscalationTicket = {
      ...data,
      id: `HITL-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'pending_review',
      createdAt: new Date().toISOString()
    };
    this.activeEscalationQueue.unshift(newTicket);
    return newTicket;
  }

  public assignOperator(ticketId: string, operatorId: string, operatorName: string): EscalationTicket | null {
    const ticket = this.activeEscalationQueue.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = 'operator_assigned';
    ticket.assignedOperatorId = operatorId;
    ticket.assignedOperatorName = operatorName;
    return ticket;
  }

  public resolveTicket(ticketId: string, operatorNotes: string): EscalationTicket | null {
    const ticket = this.activeEscalationQueue.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = 'resolved';
    ticket.operatorNotes = operatorNotes;
    ticket.resolutionTime = new Date().toISOString();
    return ticket;
  }

  public getTickets(): EscalationTicket[] {
    return [...this.activeEscalationQueue];
  }

  public generateHoldScript(clientName: string, reason: EscalationTicket['reason']): string {
    switch (reason) {
      case 'sensitive_customer_sentiment':
        return `I want to make sure your matter receives the highest priority attention, ${clientName}. Please hold for just a moment while I transfer you directly to our lead operations supervisor.`;
      case 'hallucination_detected':
      case 'low_confidence_decision':
        return `To ensure all details and technical specifications are verified, I am connecting you with our human engineering specialist.`;
      default:
        return `One moment please, connecting you to an authorized RC Solutions team member.`;
    }
  }
}

export const hitlEscalationHandler = new HITLEscalationHandler();
