import { 
  BusinessAccount, 
  ActionRecord, 
  ActionType, 
  RiskCategory, 
  TraceStep, 
  ActionResult,
  PipelineStage
} from '../src/types';
import { ai, PRIMARY_MODEL, FAST_MODEL } from './gemini';
import { db } from './db';
import { AI_EMPLOYEES } from '../src/data/employees';

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

    try {
      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed: RoutingClassification = JSON.parse(response.text || '{}');

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
      return {
        employeeId: 'admin',
        actionType: 'draft_document',
        riskCategory: 'internal_draft',
        title: instruction.slice(0, 50),
        dollarAmount: 0,
        isSafetyIssue: false,
        isComplexMultiStep: false,
        plainStepSummary: 'Ingesting task into operational queue'
      };
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
    instruction: string
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

    const executionPrompt = `You are ${employee.name}, ${employee.roleTitle} for "${business.name}" in the ${business.industry} industry.
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
      "items": [
        { "description": "Service item description", "amount": 120 }
      ],
      "totalAmount": 120,
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
Note: Only populate the specific details relevant to this actionType (e.g. quoteDetails for generate_quote, invoiceDetails for send_invoice, scheduleDetails for schedule_job, etc.). Always include summary and text.`;

    try {
      let rawText = '';
      try {
        const response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: executionPrompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        rawText = response.text || '{}';
      } catch (primaryErr) {
        console.warn('Primary model busy, falling back to fast model:', primaryErr);
        const fallbackRes = await ai.models.generateContent({
          model: FAST_MODEL,
          contents: executionPrompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        rawText = fallbackRes.text || '{}';
      }

      const parsed = JSON.parse(rawText);

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
   * Handle owner approval decisions (Approve, Edit & Approve, or Reject)
   */
  static async handleApprovalDecision(
    business: BusinessAccount,
    actionId: string,
    decision: 'approved' | 'rejected' | 'edited',
    editedContent?: string,
    reviewerNote?: string
  ): Promise<ActionRecord | null> {
    const action = db.getAction(actionId);
    if (!action) return null;

    if (!action.fullTrace) action.fullTrace = [];

    action.approvalDecision = {
      decision,
      editedContent,
      decidedAt: new Date().toISOString(),
      decidedBy: 'owner',
      reviewerNote
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
      if (editedContent && action.result) {
        action.result.text = editedContent;
        if (action.result.messageDetails) action.result.messageDetails.message = editedContent;
      }
      action.fullTrace.push({
        stepNumber: action.fullTrace.length + 1,
        stage: 'Review Decision',
        action: decision === 'edited' ? 'Owner modified and approved' : 'Owner approved execution',
        checked: 'Owner authorization confirmed',
        ruleApplied: 'Owner override: Approved',
        dataUsed: reviewerNote || 'Direct owner sign-off',
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
