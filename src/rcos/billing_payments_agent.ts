// RC Solutions Financial Settlement & Billing Payments Agent
// Location: rcos/billing/billing_payments_agent.ts

import { syncPaymentStatus, PaymentSyncResult } from './client_crm_health';
import { telemetryAuditLogger } from './telemetry_audit_logger';

export type JobCategory = 'HVAC' | 'Electrical' | 'Automation' | 'Security' | 'Maintenance' | 'Software AI';
export type PaymentMethod = 'ivr_phone_auth' | 'sms_checkout_link' | 'card_on_file' | 'ach_direct';
export type InvoiceStatus = 'draft' | 'issued' | 'paid_in_full' | 'partially_paid' | 'overdue';

export interface JobEstimateInput {
  jobId: string;
  clientId: string;
  clientName: string;
  category: JobCategory;
  estimatedLaborHours: number;
  materialsCost: number;
  isEmergencyDispatch: boolean;
  technicianTier?: 'Senior Specialist' | 'Journeyman' | 'Apprentice';
}

export interface JobEstimateBreakdown {
  estimateId: string;
  jobId: string;
  clientId: string;
  hourlyRate: number;
  laborTotal: number;
  materialsTotal: number;
  emergencySurcharge: number;
  subtotal: number;
  estimatedTax: number;
  totalEstimate: number;
  requiredDepositPercentage: number;
  requiredDepositAmount: number;
  createdAt: string;
}

export interface DepositPaymentResult {
  transactionId: string;
  jobId: string;
  clientId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  status: 'authorized_and_captured' | 'failed' | 'requires_hitl';
  receiptNumber: string;
  crmSync: PaymentSyncResult;
  timestamp: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface GeneratedInvoice {
  invoiceId: string;
  jobId: string;
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  depositPreviouslyPaid: number;
  finalBalanceDue: number;
  dueDate: string;
  issuedAt: string;
  crmSyncRecord?: PaymentSyncResult;
}

export class BillingPaymentsAgent {
  private baseHourlyRates: Record<JobCategory, number> = {
    'HVAC': 145,
    'Electrical': 165,
    'Automation': 195,
    'Security': 155,
    'Maintenance': 120,
    'Software AI': 225
  };

  private emergencyMultiplier = 1.45; // 45% premium for urgent dispatch

  private activeInvoices: GeneratedInvoice[] = [
    {
      invoiceId: 'INV-2026-0881',
      jobId: 'job-1',
      clientId: 'client-1',
      clientName: 'Apex Commercial Tower',
      status: 'paid_in_full',
      lineItems: [
        { description: 'Emergency HVAC Compressor Diagnostic & Coil Purge', quantity: 3.5, unitPrice: 145, total: 507.50 },
        { description: 'OEM High-Pressure Refrigerant & Valve Kit', quantity: 1, unitPrice: 340, total: 340.00 },
        { description: 'Priority Emergency Response Surcharge', quantity: 1, unitPrice: 220, total: 220.00 }
      ],
      subtotal: 1067.50,
      tax: 85.40,
      depositPreviouslyPaid: 350.00,
      finalBalanceDue: 0.00,
      dueDate: '2026-08-15',
      issuedAt: '2026-08-01'
    }
  ];

  public calculateEstimate(input: JobEstimateInput): JobEstimateBreakdown {
    const baseRate = this.baseHourlyRates[input.category] || 150;
    const tierMultiplier = input.technicianTier === 'Senior Specialist' ? 1.25 : 1.0;
    const effectiveHourlyRate = Math.round(baseRate * tierMultiplier);
    const laborTotal = Math.round(input.estimatedLaborHours * effectiveHourlyRate);
    const materialsTotal = Math.round(input.materialsCost);
    const emergencySurcharge = input.isEmergencyDispatch
      ? Math.round((laborTotal + materialsTotal) * (this.emergencyMultiplier - 1))
      : 0;

    const subtotal = laborTotal + materialsTotal + emergencySurcharge;
    const estimatedTax = Math.round(subtotal * 0.0825);
    const totalEstimate = subtotal + estimatedTax;

    const requiredDepositPercentage = input.isEmergencyDispatch ? 35 : 20;
    const requiredDepositAmount = Math.round((totalEstimate * requiredDepositPercentage) / 100);

    const estimate: JobEstimateBreakdown = {
      estimateId: `EST-${Math.floor(1000 + Math.random() * 9000)}`,
      jobId: input.jobId,
      clientId: input.clientId,
      hourlyRate: effectiveHourlyRate,
      laborTotal,
      materialsTotal,
      emergencySurcharge,
      subtotal,
      estimatedTax,
      totalEstimate,
      requiredDepositPercentage,
      requiredDepositAmount,
      createdAt: new Date().toISOString()
    };

    telemetryAuditLogger.recordAuditEvent(
      'billing-agent',
      'BILLING_SETTLEMENT',
      `Generated Job Estimate #${estimate.estimateId} ($${totalEstimate.toLocaleString()}) for ${input.clientName}`
    );

    return estimate;
  }

  public async processDepositPayment(
    jobId: string,
    clientId: string,
    depositAmount: number,
    paymentMethod: PaymentMethod = 'ivr_phone_auth',
    _callerPhone?: string
  ): Promise<DepositPaymentResult> {
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const receiptNumber = `RCP-${Math.floor(100000 + Math.random() * 900000)}`;

    const crmSync = syncPaymentStatus(clientId, depositAmount, true);

    telemetryAuditLogger.recordAuditEvent(
      'billing-agent',
      'BILLING_SETTLEMENT',
      `Captured deposit of $${depositAmount.toLocaleString()} via ${paymentMethod} for Job ${jobId}. CRM health score updated to ${crmSync.newHealthScore}/100.`
    );

    return {
      transactionId,
      jobId,
      clientId,
      amountPaid: depositAmount,
      paymentMethod,
      status: 'authorized_and_captured',
      receiptNumber,
      crmSync,
      timestamp: new Date().toISOString()
    };
  }

  public generateInvoiceOnDispatchCompletion(
    job: {
      id: string;
      title: string;
      clientId: string;
      clientName: string;
      estimatedValue: number;
      category?: string;
    },
    actualLaborHours: number = 3.5,
    depositAlreadyPaid: number = 250
  ): GeneratedInvoice {
    const hourlyRate = 165;
    const laborCost = Math.round(actualLaborHours * hourlyRate);
    const partsCost = Math.max(120, Math.round(job.estimatedValue * 0.45));
    const subtotal = laborCost + partsCost;
    const tax = Math.round(subtotal * 0.0825);
    const grossTotal = subtotal + tax;
    const finalBalanceDue = Math.max(0, grossTotal - depositAlreadyPaid);

    const lineItems: InvoiceLineItem[] = [
      {
        description: `Field Ops Technician Service (${actualLaborHours}h @ $${hourlyRate}/hr)`,
        quantity: actualLaborHours,
        unitPrice: hourlyRate,
        total: laborCost
      },
      {
        description: 'Certified Field Components, Consumables & Testing',
        quantity: 1,
        unitPrice: partsCost,
        total: partsCost
      }
    ];

    if (depositAlreadyPaid > 0) {
      lineItems.push({
        description: `Pre-Authorized Deposit Credit (Collected via IVR)`,
        quantity: 1,
        unitPrice: -depositAlreadyPaid,
        total: -depositAlreadyPaid
      });
    }

    const crmSyncRecord = syncPaymentStatus(job.clientId, finalBalanceDue, false);

    const newInvoice: GeneratedInvoice = {
      invoiceId: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      jobId: job.id,
      clientId: job.clientId,
      clientName: job.clientName,
      status: finalBalanceDue === 0 ? 'paid_in_full' : 'issued',
      lineItems,
      subtotal,
      tax,
      depositPreviouslyPaid: depositAlreadyPaid,
      finalBalanceDue,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().split('T')[0],
      issuedAt: new Date().toISOString().split('T')[0],
      crmSyncRecord
    };

    this.activeInvoices.unshift(newInvoice);

    telemetryAuditLogger.recordAuditEvent(
      'billing-agent',
      'BILLING_SETTLEMENT',
      `Auto-generated invoice ${newInvoice.invoiceId} for ${job.clientName}. Balance: $${finalBalanceDue.toLocaleString()}. CRM health updated.`
    );

    return newInvoice;
  }

  public getInvoices(): GeneratedInvoice[] {
    return [...this.activeInvoices];
  }
}

export const billingPaymentsAgent = new BillingPaymentsAgent();
