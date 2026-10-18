import { 
  BusinessAccount, 
  ActionRecord, 
  ActionType, 
  RiskCategory, 
  TraceStep, 
  ActionResult,
  EditedAmounts,
  PipelineStage
} from '../src/types';
import { executeGeminiWithFallback, FAST_MODEL, PRIMARY_MODEL } from './gemini';
import { db } from './db';
import { AI_EMPLOYEES } from '../src/data/employees';
import { withBehaviorProtocol } from '../src/utils/agentBehavior';

interface RoutingClassification {
  employeeId: string;
  actionType: ActionType;
  riskCategory: RiskCategory;
  title: string;
  dollarAmount?: number;
  isSafetyIssue: boolean;
  isComplexMultiStep: boolean;
  plainStepSummary: string;
}

const toNonNegativeNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Sanitize owner-edited amounts (Bug 3): recompute each item total as
 * quantity × unitPrice. The owner's typed `totalAmount` wins when valid;
 * otherwise the sum of item totals is used.
 */
function sanitizeEditedAmounts(edited: EditedAmounts): EditedAmounts {
  const items = (Array.isArray(edited.items) ? edited.items : []).map((item) => {
    const quantity = toNonNegativeNumber(item?.quantity, 1);
    const unitPrice = toNonNegativeNumber(item?.unitPrice, 0);
    return {
      description: String(item?.description ?? ''),
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
  });
  const summed = items.reduce((sum, item) => sum + item.total, 0);
  return {
    kind: edited.kind,
    clientName: String(edited.clientName ?? '').trim(),
    items,
    totalAmount: toNonNegativeNumber(edited.totalAmount, summed),
    ...(edited.terms !== undefined ? { terms: String(edited.terms) } : {}),
    ...(edited.invoiceNumber !== undefined ? { invoiceNumber: String(edited.invoiceNumber) } : {}),
    ...(edited.dueDate !== undefined ? { dueDate: String(edited.dueDate) } : {}),
    ...(edited.paymentInstructions !== undefined ? { paymentInstructions: String(edited.paymentInstructions) } : {}),
    ...(edited.notes !== undefined ? { notes: String(edited.notes) } : {}),
  };
}

export class RcosEngine {
  /**
   * Classify user command or customer request using Gemini with business context
   */
  static async classifyAndRoute(
    business: BusinessAccount,
    instruction: string,
    customerContext?: Record<string, any>
  ): Promise<RoutingClassification> {
    const activeEmployeeList = AI_EMPLOYEES.filter(
      emp => business.activeEmployees[emp.id] !== false
    ).map(e => `${e.id}: ${e.name} (${e.roleTitle} - ${e.department}) -> ${e.coreJob}`);

    const prompt = `You are the RCOS Master Routing Engine for ${business.name} (Industry: ${business.industry}).
Business Context:
- Available Services: ${business.services.join(', ')}
- Pricing Approach: ${business.pricingApproach}
- Brand Tone: ${business.brandTone}
- Global Autonomy Mode: ${business.autonomyMode}
- Approval Dollar Safety Threshold: $${business.dollarThreshold}

Available Active AI Employees:
${activeEmployeeList.join('\n')}

Routing Priority Hierarchy (HIGHEST PRIORITY WINS):
1. Safety hazard, injury risk, legal liability, urgent top-level approval -> executive_assistant
2. Technical bug, workflow loop, system logic error -> automation_specialist
3. Complex multi-step project, timeline, scope definition -> project_manager
4. Field work / physical inspection / on-site repair -> technician
5. Scheduling, crew dispatch, calendar booking -> operations
6. Quote, estimate, proposal, pricing calculation -> sales
7. Invoicing, billing, balance collection, payment verification -> finance
8. Client complaint, support request, appointment reminder -> customer_service
9. Staff onboarding, employee policy, hiring checklist -> hr
10. Promotional campaigns, social media, marketing copy -> marketing
11. Missing information, record updating, file archiving -> admin
12. Operational report, weekly analytics, performance metrics -> business_analyst

User Instruction / Incoming Work Item:
"${instruction}"
${customerContext ? `Additional Customer Info: ${JSON.stringify(customerContext)}` : ''}

Determine the single best assigned employee and action metadata.
Return ONLY valid JSON with this exact structure:
{
  "employeeId": "one of the available employee IDs (e.g. sales, finance, operations, customer_service, technician, etc.)",
  "actionType": "send_message | generate_quote | schedule_job | send_invoice | post_content | update_record | draft_document | safety_review | operational_task",
  "riskCategory": "internal_draft | routine_outbound | commitment_outbound | money_movement | public_post | system_settings",
  "title": "Concise friendly task title (max 60 chars, e.g. 'Draft Deep Clean Quote for Mrs. Rodriguez')",
  "dollarAmount": 0 (estimate if quote or invoice or money movement, or 0 if none),
  "isSafetyIssue": false,
  "isComplexMultiStep": false,
  "plainStepSummary": "Short friendly current progress statement (e.g. 'Reviewing request and checking service requirements')"
}`;

    const fallbackClassification = (): string => {
      const lower = instruction.toLowerCase();
      let empId = 'admin';
      let actType: ActionType = 'operational_task';
      let risk: RiskCategory = 'internal_draft';

      if (lower.includes('quote') || lower.includes('estimate') || lower.includes('price')) {
        empId = 'sales';
        actType = 'generate_quote';
        risk = 'routine_outbound';
      } else if (lower.includes('invoice') || lower.includes('bill') || lower.includes('payment') || lower.includes('collect')) {
        empId = 'finance';
        actType = 'send_invoice';
        risk = 'money_movement';
      } else if (lower.includes('schedule') || lower.includes('dispatch') || lower.includes('book') || lower.includes('calendar')) {
        empId = 'operations';
        actType = 'schedule_job';
        risk = 'routine_outbound';
      } else if (lower.includes('support') || lower.includes('complaint') || lower.includes('client') || lower.includes('customer')) {
        empId = 'customer_service';
        actType = 'send_message';
        risk = 'routine_outbound';
      } else if (lower.includes('automation') || lower.includes('integration') || lower.includes('webhook') || lower.includes('fix')) {
        empId = 'automation_specialist';
        actType = 'operational_task';
        risk = 'internal_draft';
      }

      return JSON.stringify({
        employeeId: empId,
        actionType: actType,
        riskCategory: risk,
        title: instruction.slice(0, 50),
        dollarAmount: actType === 'send_invoice' ? 250 : 0,
        isSafetyIssue: false,
        isComplexMultiStep: false,
        plainStepSummary: `Assigned to ${empId}. Ingesting task into operational queue`
      });
    };

    try {
      const res = await executeGeminiWithFallback({
        preferredModel: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
        fallbackFn: fallbackClassification
      });

      const parsed: RoutingClassification = JSON.parse(res.text || fallbackClassification());

      // Enforce hard routing rules
      if (parsed.isSafetyIssue) {
        parsed.employeeId = 'executive_assistant';
        parsed.riskCategory = 'system_settings';
      }

      // Hard override: Money movement ALWAYS requires money_movement risk category
      if (parsed.actionType === 'send_invoice' || (parsed.dollarAmount && parsed.dollarAmount > 0 && parsed.actionType !== 'generate_quote')) {
        parsed.riskCategory = 'money_movement';
      }

      // Verify employee exists & is active
      const exists = AI_EMPLOYEES.some(e => e.id === parsed.employeeId);
      if (!exists || business.activeEmployees[parsed.employeeId] === false) {
        parsed.employeeId = 'executive_assistant';
      }

      return parsed;
    } catch (err) {
      console.error('Classification error:', err);
      const fallbackParsed = JSON.parse(fallbackClassification());
      return fallbackParsed;
    }
  }

  /**
   * Determine if an action requires owner approval based on the non-negotiable risk rules
   */
  static determineApprovalRequirement(
    business: BusinessAccount,
    riskCategory: RiskCategory,
    dollarAmount?: number
  ): boolean {
    // 1. Money movement ALWAYS requires approval (non-overridable)
    if (riskCategory === 'money_movement') {
      return true;
    }

    // 2. Dollar threshold safety net
    if (dollarAmount && dollarAmount > 0 && dollarAmount >= business.dollarThreshold) {
      return true;
    }

    // 3. Supervised mode forces approval on everything except purely internal drafts
    if (business.autonomyMode === 'supervised') {
      return riskCategory !== 'internal_draft';
    }

    // 4. Autonomous mode risk defaults
    switch (riskCategory) {
      case 'internal_draft':
      case 'routine_outbound':
        return false;
      case 'commitment_outbound':
      case 'public_post':
      case 'system_settings':
        return true;
      default:
        return true;
    }
  }

  /**
   * Execute the work item using live Gemini with the employee's persona, generating
   * friendly plain-English step summaries, complete step-by-step traces, and real structured outputs.
   */
  static async executeAction(
    business: BusinessAccount,
    action: ActionRecord,
    instruction: string,
    // The assigned employee's Behavior & Decision Protocol. Callers that
    // run without client context (automatic intake routing, command bar)
    // pass nothing and the standard protocol applies.
    behaviorProtocol?: unknown
  ): Promise<ActionRecord> {
    const employee = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
    
    // Build initial trace step
    const initialTrace: TraceStep = {
      stepNumber: 1,
      stage: 'Intake & Qualification',
      action: 'Context ingestion and safety triage',
      checked: `Business preset: ${business.industry} | Active employee: ${employee.name} (${employee.roleTitle})`,
      ruleApplied: 'Priority routing & risk boundary check',
      dataUsed: `Instruction: "${instruction}"`,
      timestamp: new Date().toISOString()
    };
    action.fullTrace = [initialTrace];
    action.stepSummary = `Checking ${business.name} service records and requirements...`;
    db.saveAction(action);

    const executionPrompt = withBehaviorProtocol(`You are ${employee.name}, ${employee.roleTitle} for "${business.name}" in the ${business.industry} industry.
Brand Tone: ${business.brandTone}
Pricing Approach: ${business.pricingApproach}
Services Offered: ${business.services.join(', ')}
Task to Execute: "${instruction}"
Action Type: ${action.actionType}
Risk Category: ${action.riskCategory}

You MUST generate real, complete operational work (NOT generic placeholders or stubs).
Format your response as valid JSON matching this schema:
{
  "friendlyStepSummary": "A single reassuring, plain-English progress line for the owner (e.g. 'Quote for 3-bedroom deep clean prepared for your review')",
  "traceSteps": [
    {
      "stage": "Qualification",
      "action": "What you checked or verified",
      "checked": "Specific records, pricing rules, or customer requirements analyzed",
      "ruleApplied": "Policy or operational rule applied",
      "dataUsed": "Specific facts used"
    },
    {
      "stage": "Execution",
      "action": "Concrete operational work performed",
      "checked": "Formulas, safety checklists, or templates referenced",
      "ruleApplied": "Standard Operating Procedure adherence",
      "dataUsed": "Calculated parameters or drafted text"
    }
  ],
  "result": {
    "summary": "Clear, concise overview of what was accomplished",
    "text": "The full drafted body (e.g. email draft, message, operational note, or report)",
    "quoteDetails": {
      "clientName": "Client Name or 'Valued Client'",
      "items": [
        { "description": "Service item description", "quantity": 1, "unitPrice": 120, "total": 120 }
      ],
      "totalAmount": 120,
      "validDays": 30,
      "terms": "Standard payment upon completion terms"
    },
    "invoiceDetails": {
      "invoiceNumber": "INV-2026-001",
      "clientName": "Client Name",
      "amount": 120,
      "totalAmount": 120,
      "items": [
        { "description": "Service item description", "quantity": 1, "unitPrice": 120, "total": 120, "amount": 120 }
      ],
      "dueDate": "Net 15 days",
      "paymentInstructions": "Payable via bank transfer or credit card"
    },
    "scheduleDetails": {
      "jobTitle": "Scheduled Service",
      "scheduledDate": "Next available date (e.g. Monday, 9:00 AM)",
      "timeWindow": "2-3 hours",
      "assignedTech": "Assigned technician name",
      "location": "Client service address"
    },
    "documentDetails": {
      "title": "Document Title",
      "category": "Standard Operating Procedure / Policy / Report",
      "body": "Full structured document text"
    },
    "messageDetails": {
      "recipient": "Client or Team Member",
      "channel": "SMS or Email",
      "message": "Full courteous message draft"
    }
  }
}
Note: Only populate the specific details relevant to this actionType (e.g. quoteDetails for generate_quote, invoiceDetails for send_invoice, scheduleDetails for schedule_job, etc.). Always include summary and text.`,
      behaviorProtocol
    );

    const fallbackExecution = (): string => {
      const isQuote = action.actionType === 'generate_quote';
      const isInvoice = action.actionType === 'send_invoice';
      const isSchedule = action.actionType === 'schedule_job';
      const isMessage = action.actionType === 'send_message';

      return JSON.stringify({
        friendlyStepSummary: isQuote 
          ? `Service estimate prepared for client review ($${action.dollarAmount || 250})`
          : isInvoice
          ? `Invoice drafted and held for financial authorization ($${action.dollarAmount || 250})`
          : isSchedule
          ? `Service appointment routed to field specialist`
          : `Operational task drafted and synchronized with workforce`,
        traceSteps: [
          {
            stage: 'Qualification',
            action: 'Evaluated instruction against rate card and active employee SOPs',
            checked: `${business.name} parameters and client history verified`,
            ruleApplied: 'Workforce role mapping & compliance safeguard',
            dataUsed: instruction
          },
          {
            stage: 'Execution',
            action: 'Constructed operational record and output payload',
            checked: 'Required fields and compliance limits checked',
            ruleApplied: 'Deterministic fallback protocol',
            dataUsed: `${employee.name} (${employee.roleTitle})`
          }
        ],
        result: {
          summary: `Task executed by ${employee.name} for ${business.name}`,
          text: `Operational deliverable for: "${instruction}". Processed in adherence with ${business.industry} standards.`,
          quoteDetails: isQuote ? {
            clientName: 'Valued Client',
            items: [
              { description: `${business.services[0] || 'Professional Service'} Package`, quantity: 1, unitPrice: action.dollarAmount || 250, total: action.dollarAmount || 250 }
            ],
            totalAmount: action.dollarAmount || 250,
            validDays: 30,
            terms: 'Standard net terms upon completion'
          } : undefined,
          invoiceDetails: isInvoice ? {
            invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
            clientName: 'Valued Client',
            amount: action.dollarAmount || 250,
            totalAmount: action.dollarAmount || 250,
            items: [
              { description: `${business.services[0] || 'Professional Service'} Delivered`, quantity: 1, unitPrice: action.dollarAmount || 250, total: action.dollarAmount || 250, amount: action.dollarAmount || 250 }
            ],
            dueDate: 'Net 15 days',
            paymentInstructions: 'ACH or Corporate Card'
          } : undefined,
          scheduleDetails: isSchedule ? {
            jobTitle: action.title || 'Scheduled Service Inspection',
            scheduledDate: 'Next available business window',
            timeWindow: '8:00 AM - 12:00 PM',
            assignedTech: 'Lead Field Specialist',
            location: 'Client service address'
          } : undefined,
          messageDetails: isMessage ? {
            recipient: 'Client',
            channel: 'SMS/Email',
            message: `Hello from ${business.name}. Regarding your request: "${instruction}", we are reviewing your details and will follow up shortly.`
          } : undefined
        }
      });
    };

    try {
      const res = await executeGeminiWithFallback({
        preferredModel: PRIMARY_MODEL,
        contents: executionPrompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
        fallbackFn: fallbackExecution
      });

      let parsed: any;
      try {
        parsed = JSON.parse(res.text || fallbackExecution());
      } catch {
        parsed = JSON.parse(fallbackExecution());
      }

      // Update trace
      let stepCounter = 2;
      if (Array.isArray(parsed.traceSteps)) {
        for (const step of parsed.traceSteps) {
          action.fullTrace.push({
            stepNumber: stepCounter++,
            stage: step.stage || 'Execution',
            action: step.action || 'Operational execution',
            checked: step.checked || 'Standard parameters verified',
            ruleApplied: step.ruleApplied || 'Standard operating procedure',
            dataUsed: step.dataUsed || 'Current business context',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Update dollar amount if detected
      if (parsed.result?.quoteDetails?.totalAmount) {
        action.dollarAmount = parsed.result.quoteDetails.totalAmount;
      } else if (parsed.result?.invoiceDetails?.totalAmount) {
        action.dollarAmount = parsed.result.invoiceDetails.totalAmount;
      }

      // Re-check approval requirement now that we have exact figures
      action.requiresApproval = this.determineApprovalRequirement(
        business,
        action.riskCategory,
        action.dollarAmount
      );
      action.requiresReview = action.requiresApproval;

      action.result = parsed.result || { summary: 'Task completed successfully', text: '' };

      if (!action.fullTrace) action.fullTrace = [];

      if (action.requiresApproval) {
        action.status = 'awaiting_approval';
        action.stepSummary = parsed.friendlyStepSummary || 'Ready for your review and approval';
        action.fullTrace.push({
          stepNumber: stepCounter++,
          stage: 'Approval Queue',
          action: 'Held for owner approval per safety governance',
          checked: `Risk Category: ${action.riskCategory} | Value: $${action.dollarAmount || 0}`,
          ruleApplied: action.riskCategory === 'money_movement' 
            ? 'Mandatory money-movement safety lock' 
            : 'Owner approval threshold / commitment safeguard',
          dataUsed: 'Drafted work package',
          timestamp: new Date().toISOString()
        });
      } else {
        action.status = 'completed';
        action.completedAt = new Date().toISOString();
        action.stepSummary = parsed.friendlyStepSummary || 'Completed automatically';
        action.fullTrace.push({
          stepNumber: stepCounter++,
          stage: 'Completion',
          action: 'Autonomous execution finalized',
          checked: 'Autonomous safety boundary clear',
          ruleApplied: 'Routine autonomous processing authorized',
          dataUsed: 'Final execution artifact',
          timestamp: new Date().toISOString()
        });
      }

      action.updatedAt = new Date().toISOString();
      return db.saveAction(action);
    } catch (err) {
      console.error('Execution failure:', err);
      action.status = 'failed';
      action.stepSummary = 'Encountered an operational error during processing';
      action.fullTrace.push({
        stepNumber: action.fullTrace.length + 1,
        stage: 'Execution Failure',
        action: 'System error logged',
        checked: 'Execution pipeline error',
        ruleApplied: 'Error isolation',
        dataUsed: String(err),
        timestamp: new Date().toISOString()
      });
      action.updatedAt = new Date().toISOString();
      return db.saveAction(action);
    }
  }

  /**
   * Handle owner approval decisions (Approve, Edit & Approve, or Reject).
   * On 'edited', `editedAmounts` carries the structured amounts the owner
   * changed in Review edit mode (Bug 3) and is applied to quoteDetails /
   * invoiceDetails with dollarAmount / financialAmount kept in sync, so the
   * header badge, money pipeline, and mark-paid all see the edited total.
   * The money_movement approval requirement is unchanged: edits still go
   * through owner approval, they just actually take effect now.
   */
  static async handleApprovalDecision(
    business: BusinessAccount,
    actionId: string,
    decision: 'approved' | 'rejected' | 'edited',
    editedContent?: string,
    reviewerNote?: string,
    editedAmounts?: EditedAmounts
  ): Promise<ActionRecord | null> {
    const action = db.getAction(actionId);
    if (!action) return null;

    if (!action.fullTrace) action.fullTrace = [];

    // Tolerate structured edits arriving inside `editedContent` (e.g. a
    // caller that forwards the whole request body as one field): treat an
    // object shaped like EditedAmounts as the edit payload, not draft text.
    let structuredEdits = editedAmounts;
    let textEdit = editedContent;
    const maybeStructured = editedContent as unknown as EditedAmounts | undefined;
    if (
      !structuredEdits &&
      maybeStructured &&
      typeof maybeStructured === 'object' &&
      (maybeStructured.kind === 'quote' || maybeStructured.kind === 'invoice') &&
      Array.isArray(maybeStructured.items)
    ) {
      structuredEdits = maybeStructured;
      textEdit = undefined;
    }
    const cleanEdits = decision === 'edited' && structuredEdits
      ? sanitizeEditedAmounts(structuredEdits)
      : undefined;

    action.approvalDecision = {
      decision,
      editedContent: textEdit,
      decidedAt: new Date().toISOString(),
      decidedBy: 'owner',
      reviewerNote,
      ...(cleanEdits ? { editedAmounts: cleanEdits } : {}),
    };

    if (decision === 'rejected') {
      action.status = 'rejected';
      action.stepSummary = 'Rejected by owner';
      action.fullTrace.push({
        stepNumber: action.fullTrace.length + 1,
        stage: 'Review Decision',
        action: 'Task rejected by owner',
        checked: 'Owner decision',
        ruleApplied: 'Manual owner override: Cancelled',
        dataUsed: reviewerNote || 'No rejection note provided',
        timestamp: new Date().toISOString()
      });
    } else {
      action.status = 'completed';
      action.completedAt = new Date().toISOString();
      action.stepSummary = decision === 'edited' ? 'Approved with owner modifications' : 'Approved and completed';
      if (textEdit && action.result) {
        action.result.text = textEdit;
        if (action.result.messageDetails) action.result.messageDetails.message = textEdit;
      }
      // Apply the owner's structured amount edits (Bug 3). Totals stay
      // consistent everywhere: details block, header badge (dollarAmount /
      // financialAmount), money pipeline, and mark-paid (which reads
      // invoiceDetails.totalAmount, falling back to dollarAmount).
      if (cleanEdits && action.result) {
        if (cleanEdits.kind === 'quote') {
          const prev = action.result.quoteDetails;
          action.result.quoteDetails = {
            clientName: cleanEdits.clientName || prev?.clientName || 'Valued Client',
            items: cleanEdits.items,
            totalAmount: cleanEdits.totalAmount,
            validDays: prev?.validDays ?? 30,
            ...(cleanEdits.terms !== undefined
              ? { terms: cleanEdits.terms }
              : prev?.terms !== undefined
                ? { terms: prev.terms }
                : {}),
          };
          action.dollarAmount = cleanEdits.totalAmount;
          action.financialAmount = cleanEdits.totalAmount;
        } else {
          const prev = action.result.invoiceDetails;
          action.result.invoiceDetails = {
            clientName: cleanEdits.clientName || prev?.clientName || 'Valued Client',
            invoiceNumber: cleanEdits.invoiceNumber || prev?.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
            amount: cleanEdits.totalAmount,
            totalAmount: cleanEdits.totalAmount,
            items: cleanEdits.items.map((item) => ({ ...item, amount: item.total })),
            dueDate: cleanEdits.dueDate ?? prev?.dueDate ?? 'Net 15 days',
            ...(cleanEdits.paymentInstructions !== undefined
              ? { paymentInstructions: cleanEdits.paymentInstructions }
              : prev?.paymentInstructions !== undefined
                ? { paymentInstructions: prev.paymentInstructions }
                : {}),
            ...(cleanEdits.notes !== undefined
              ? { notes: cleanEdits.notes }
              : prev?.notes !== undefined
                ? { notes: prev.notes }
                : {}),
          };
          action.dollarAmount = cleanEdits.totalAmount;
          action.financialAmount = cleanEdits.totalAmount;
        }
      }
      action.fullTrace.push({
        stepNumber: action.fullTrace.length + 1,
        stage: 'Review Decision',
        action: decision === 'edited' ? 'Owner modified and approved' : 'Owner approved execution',
        checked: 'Owner authorization confirmed',
        ruleApplied: 'Owner override: Approved',
        dataUsed: cleanEdits
          ? `Owner-edited total: $${cleanEdits.totalAmount}. ${reviewerNote || 'Direct owner sign-off'}`
          : reviewerNote || 'Direct owner sign-off',
        timestamp: new Date().toISOString()
      });

      // If quote was approved, automatically trigger Operations to draft the scheduled job!
      if (action.actionType === 'generate_quote') {
        setTimeout(async () => {
          try {
            const followUpInstruction = `Schedule the approved quote for ${action.result?.quoteDetails?.clientName || 'the client'}: ${action.title}`;
            const classification = await RcosEngine.classifyAndRoute(business, followUpInstruction);
            const scheduledAction: ActionRecord = {
              id: `act_${Date.now()}_ops`,
              businessId: business.id,
              requestId: action.requestId,
              employeeId: 'operations',
              actionType: 'schedule_job',
              title: `Schedule Job: ${action.title}`,
              status: 'running',
              stepSummary: 'Routing approved quote into crew scheduling...',
              fullTrace: [],
              riskCategory: classification.riskCategory,
              requiresApproval: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            db.saveAction(scheduledAction);
            await RcosEngine.executeAction(business, scheduledAction, followUpInstruction);
          } catch (e) {
            console.error('Follow-up ops error:', e);
          }
        }, 500);
      }
    }

    action.updatedAt = new Date().toISOString();
    return db.saveAction(action);
  }
}
