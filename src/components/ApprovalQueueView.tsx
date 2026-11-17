import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Edit3, 
  Clock, 
  ShieldAlert, 
  DollarSign, 
  FileText, 
  Calendar, 
  User, 
  CheckCircle,
  AlertTriangle,
  Send,
  Loader2,
  ClipboardList,
  Briefcase,
  BadgeCheck,
  ChevronDown,
  Plus
} from 'lucide-react';
import { ActionRecord, BusinessAccount, EditedAmounts, EditedLineItem, InvoicePrefill } from '../types';
import { apiFetch } from '../lib/api';
import { asStringList } from '../utils/safeRender';
import { AI_EMPLOYEES } from '../data/employees';

interface ApprovalQueueViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  onDecision: (actionId: string, decision: 'approved' | 'rejected' | 'edited', editedContent?: string, note?: string, editedAmounts?: EditedAmounts) => Promise<boolean | void>;
  onRefresh: () => void;
  onScheduleJob: (action: ActionRecord) => Promise<void>;
  onMarkPaid: (action: ActionRecord) => Promise<void>;
  onMoneyCreated?: (createdId?: string) => void;
  invoicePrefill: InvoicePrefill | null;
  onInvoicePrefillConsumed: () => void;
}

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; count: number }> = ({
  icon,
  title,
  subtitle,
  count,
}) => (
  <div className="flex items-center gap-2.5 px-1">
    <div className="w-8 h-8 rounded-xl bg-[#0c1211] border border-[#1d2b26] flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {title}
        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {count}
        </span>
      </h3>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  </div>
);

const QuoteInvoiceModal: React.FC<{
  mode: 'quote' | 'invoice';
  business: BusinessAccount;
  prefill?: InvoicePrefill | null;
  onClose: () => void;
  onCreated: (createdId?: string) => void;
}> = ({ mode, business, prefill, onClose, onCreated }) => {
  const [clientName, setClientName] = useState(prefill?.clientName || '');
  const [serviceName, setServiceName] = useState(prefill?.serviceName || business.services?.[0] || '');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
  const [details, setDetails] = useState(prefill?.details || '');
  const [dueDays, setDueDays] = useState('15');
  const [hours, setHours] = useState('3');
  const [materials, setMaterials] = useState('250');
  const [isEmergency, setIsEmergency] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isQuote = mode === 'quote';
  const inputCls =
    'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]';

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);
    try {
      const est = await apiFetch<any>('/api/billing/estimate', {
        method: 'POST',
        body: JSON.stringify({
          category: business.industry || 'General',
          hours: Number(hours) || 0,
          materials: Number(materials) || 0,
          isEmergency,
        }),
      });
      if (est && typeof est.total === 'number') setAmount(String(est.total));
    } catch (e: any) {
      setError(e?.message || 'Estimate failed. Enter the amount manually.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!clientName.trim() || !amt || amt <= 0) {
      setError('Add a client name and an amount over $0.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = isQuote ? '/api/phone/request-quote' : '/api/phone/request-invoice';
      const body = isQuote
        ? {
            clientName: clientName.trim(),
            serviceName: serviceName.trim() || 'Service',
            estimatedAmount: amt,
            details: details.trim(),
            businessId: business.id,
          }
        : {
            clientName: clientName.trim(),
            serviceName: serviceName.trim() || 'Service',
            invoiceAmount: amt,
            dueDays: Number(dueDays) || 15,
            details: details.trim(),
            businessId: business.id,
          };
      const created = await apiFetch<any>(endpoint, { method: 'POST', body: JSON.stringify(body) });
      onCreated(created?.id);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {isQuote ? <FileText className="w-4 h-4 text-[#22ec72]" /> : <DollarSign className="w-4 h-4 text-[#22ec72]" />}
            <span>{isQuote ? 'New Quote' : 'New Invoice'}</span>
          </h3>
          <button aria-label="Close" type="button" onClick={onClose} className="min-h-[48px] text-zinc-500 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          {isQuote
            ? 'Creates a quote held for your approval in the queue below.'
            : 'Creates an invoice held for your approval in the queue below.'}
        </p>

        <div className="space-y-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name *" className={inputCls} />
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Service</label>
            {business.services && business.services.length > 0 ? (
              <select value={serviceName} onChange={(e) => setServiceName(e.target.value)} className={inputCls}>
                {asStringList(business.services).map((sv) => (
                  <option key={sv} value={sv}>{sv}</option>
                ))}
              </select>
            ) : (
              <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Service" className={inputCls} />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Amount (USD) *
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className={`${inputCls} font-mono text-sm`}
            />
          </div>

          {isQuote && (
            <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Estimate helper</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" inputMode="decimal" className={inputCls} />
                <input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Materials $" inputMode="decimal" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} className="accent-[#22ec72] w-4 h-4" />
                <span>Emergency rate</span>
              </label>
              <button
                type="button"
                onClick={handleCalculate}
                disabled={calculating}
                className="min-h-[48px] w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-bold text-white transition cursor-pointer"
              >
                {calculating ? 'Calculating…' : 'Calculate amount'}
              </button>
            </div>
          )}

          {!isQuote && (
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment due in (days)</label>
              <input value={dueDays} onChange={(e) => setDueDays(e.target.value)} inputMode="numeric" className={inputCls} />
            </div>
          )}

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Notes (scope, terms…)"
            rows={3}
            className={`${inputCls} font-sans`}
          />
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-[48px] flex-1 py-2.5 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] disabled:opacity-50 text-black text-xs font-extrabold transition cursor-pointer"
          >
            {submitting ? 'Saving…' : isQuote ? 'Create Quote' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  business,
  actions,
  onDecision,
  onRefresh,
  onScheduleJob,
  onMarkPaid,
  onMoneyCreated,
  invoicePrefill,
  onInvoicePrefillConsumed
}) => {
  const [modalMode, setModalMode] = useState<'quote' | 'invoice' | null>(null);
  const [modalPrefill, setModalPrefill] = useState<InvoicePrefill | null>(null);
  const [pipelineBusyId, setPipelineBusyId] = useState<string | null>(null);
  const pendingActions = actions.filter(a => a.status === 'awaiting_approval');

  // Open the invoice modal pre-filled when a completed job asks for one.
  useEffect(() => {
    if (invoicePrefill) {
      setModalPrefill(invoicePrefill);
      setModalMode('invoice');
      onInvoicePrefillConsumed();
    }
  }, [invoicePrefill, onInvoicePrefillConsumed]);

  // Money pipeline: approved quotes & invoices, with their next step.
  // Invoices live in the filterable list above; approved quotes keep their
  // own section below (their next step is Schedule Job, not Mark Paid).
  const approvedMoney = actions
    .filter(a => a.status === 'approved' && (a.result?.quoteDetails || a.result?.invoiceDetails))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const approvedQuotes = approvedMoney.filter(a => a.result?.quoteDetails);

  /**
   * Invoice status from the real record. `dueDate` is stored as a display
   * string ("Net-15 days") or an edited date, so "overdue" is computed from
   * it only when it parses — never guessed. An invoice with an unparseable
   * due date is never called overdue.
   */
  type InvoiceStatus = 'paid' | 'overdue' | 'unpaid' | 'awaiting';
  const invoiceDueMs = (a: ActionRecord): number | null => {
    const due = a.result?.invoiceDetails?.dueDate || '';
    const asDate = Date.parse(due);
    if (!Number.isNaN(asDate)) return asDate;
    const m = /net[-\s]?(\d+)\s*days?/i.exec(due);
    if (m) {
      const created = Date.parse(a.createdAt);
      return Number.isNaN(created) ? null : created + Number(m[1]) * 24 * 60 * 60 * 1000;
    }
    return null;
  };
  const invoiceStatus = (a: ActionRecord): InvoiceStatus => {
    if (a.status === 'awaiting_approval') return 'awaiting';
    if (a.paymentStatus === 'paid') return 'paid';
    const due = invoiceDueMs(a);
    if (due !== null && Date.now() > due) return 'overdue';
    return 'unpaid';
  };
  const invoiceBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return { label: 'Paid', cls: 'bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30' };
      case 'overdue':
        return { label: 'Overdue', cls: 'bg-rose-500/10 text-rose-300 border border-rose-500/30' };
      case 'unpaid':
        return { label: 'Unpaid', cls: 'bg-amber-500/10 text-amber-300 border border-amber-500/30' };
      default:
        return { label: 'Awaiting approval', cls: 'bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30' };
    }
  };
  // Every invoice the owner has seen: approved ones and ones still waiting
  // for approval. Rejected invoices are not money owed — they stay out.
  const invoiceRecords = actions
    .filter(a => a.result?.invoiceDetails && (a.status === 'awaiting_approval' || a.status === 'approved'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const invoiceCounts = {
    all: invoiceRecords.length,
    unpaid: invoiceRecords.filter(a => invoiceStatus(a) === 'unpaid').length,
    paid: invoiceRecords.filter(a => invoiceStatus(a) === 'paid').length,
    overdue: invoiceRecords.filter(a => invoiceStatus(a) === 'overdue').length,
  };
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const filteredInvoices = invoiceRecords.filter((a) =>
    invoiceFilter === 'all' ? true : invoiceStatus(a) === invoiceFilter
  );

  // Vision-aligned grouping: quotes & proposals need sign-off; escalations need the owner's call.
  // Invoice actions awaiting approval live in the invoice list above, not
  // here — they already show their Approve / Edit / Reject controls there.
  const isQuoteAction = (act: ActionRecord) =>
    ['generate_quote', 'draft_document', 'send_invoice'].includes(act.actionType || '');
  const isEscalationAction = (act: ActionRecord) =>
    act.actionType === 'safety_review' || ['money_movement', 'system_settings'].includes(act.riskCategory);
  const approvalActions = pendingActions.filter((act) => !act.result?.invoiceDetails);
  const quoteActions = approvalActions.filter(isQuoteAction);
  const escalationActions = approvalActions.filter((act) => !isQuoteAction(act) && isEscalationAction(act));
  const otherActions = approvalActions.filter((act) => !isQuoteAction(act) && !isEscalationAction(act));
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  // Structured amounts being edited in Review edit mode (Bug 3). Seeded from
  // the card's quoteDetails / invoiceDetails when Edit is tapped; null when
  // the card has no amounts block or nothing is being edited.
  const [editAmounts, setEditAmounts] = useState<EditedAmounts | null>(null);
  const [rejectionNote, setRejectionNote] = useState<string>('');
  const [rejectingActionId, setRejectingActionId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      await onDecision(actionId, 'approved');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditAndApprove = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const ok = await onDecision(actionId, 'edited', editText, undefined, editAmounts ?? undefined);
      // Keep the edit form (and the owner's edits) open when it failed.
      if (ok === false) return;
      setEditingActionId(null);
      setEditAmounts(null);
    } finally {
      setProcessingId(null);
    }
  };

  // Seed the edit form from the card's stored amounts. Invoice line items
  // stored by older flows may only carry `amount`, so normalize each item
  // to quantity / unitPrice / total before editing.
  const seedEditAmounts = (action: ActionRecord): EditedAmounts | null => {
    const quote = action.result?.quoteDetails;
    if (quote) {
      return {
        kind: 'quote',
        clientName: quote.clientName,
        items: (quote.items || []).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
        totalAmount: quote.totalAmount,
        ...(quote.terms !== undefined ? { terms: quote.terms } : {}),
      };
    }
    const invoice = action.result?.invoiceDetails;
    if (invoice) {
      const items = (invoice.items || []).map((item) => {
        const quantity = item.quantity ?? 1;
        const unitPrice = item.unitPrice ?? item.amount ?? item.total ?? 0;
        return {
          description: item.description,
          quantity,
          unitPrice,
          total: quantity * unitPrice,
        };
      });
      return {
        kind: 'invoice',
        clientName: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber,
        items,
        totalAmount: invoice.totalAmount ?? invoice.amount,
        ...(invoice.dueDate !== undefined ? { dueDate: invoice.dueDate } : {}),
        ...(invoice.paymentInstructions !== undefined ? { paymentInstructions: invoice.paymentInstructions } : {}),
        ...(invoice.notes !== undefined ? { notes: invoice.notes } : {}),
      };
    }
    return null;
  };

  const startEdit = (action: ActionRecord) => {
    setEditingActionId(action.id);
    setEditText(action.result?.text || '');
    setEditAmounts(seedEditAmounts(action));
    setRejectingActionId(null);
  };

  // Recompute the edited line total and the grand total whenever a line
  // item changes (Bug 3). Typing a total directly keeps the typed value.
  const updateEditItem = (index: number, patch: Partial<EditedLineItem>) => {
    setEditAmounts((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.total = (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0);
        return next;
      });
      return { ...prev, items, totalAmount: items.reduce((sum, item) => sum + item.total, 0) };
    });
  };

  const updateEditField = (patch: Partial<EditedAmounts>) => {
    setEditAmounts((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const addEditItem = () => {
    setEditAmounts((prev) =>
      prev ? { ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, total: 0 }] } : prev
    );
  };

  const removeEditItem = (index: number) => {
    setEditAmounts((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items, totalAmount: items.reduce((sum, item) => sum + item.total, 0) };
    });
  };

  const handleReject = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const ok = await onDecision(actionId, 'rejected', undefined, rejectionNote);
      if (ok === false) return;
      setRejectingActionId(null);
      setRejectionNote('');
    } finally {
      setProcessingId(null);
    }
  };

  const renderActionCard = (action: ActionRecord) => {
            const employee = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
            const isEditing = editingActionId === action.id;
            const isRejecting = rejectingActionId === action.id;
            const isBusy = processingId === action.id;
            // Amounts currently being edited on THIS card (null unless this
            // card is in edit mode and has a quote/invoice amounts block).
            const editingQuote = isEditing && editAmounts?.kind === 'quote' ? editAmounts : null;
            const editingInvoice = isEditing && editAmounts?.kind === 'invoice' ? editAmounts : null;
            const editInputCls = 'w-full bg-[#0c1211] border border-[#22ec72]/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none';
            const editItemInputCls = 'min-w-0 bg-[#0c1211] border border-[#22ec72]/50 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none';

            return (
              <div 
                key={action.id}
                className="p-5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-slate-700 transition space-y-4 shadow-xl"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1d2b26] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0c1211] border border-[#1d2b26] flex items-center justify-center text-white font-bold text-xs">
                      {employee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{action.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="text-[#22ec72] font-medium">{employee.name}</span>
                        <span>•</span>
                        <span>{employee.roleTitle}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">
                          {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {action.riskCategory === 'money_movement' && (
                      <span title="Needs your approval before it sends — you can still edit the amount." className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#22ec72]/15 text-[#22ec72] border border-[#22ec72]/25 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Approval required
                      </span>
                    )}
                    {action.dollarAmount && action.dollarAmount > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#0c1211] text-[#22ec72] border border-[#1d2b26]">
                        ${action.dollarAmount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Friendly status summary */}
                <div className="text-xs text-slate-300 flex items-center gap-2 bg-[#0c1211] px-3.5 py-2 rounded-xl border border-[#1d2b26]">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{action.stepSummary}</span>
                </div>

                {/* Draft Content Card */}
                <div className="space-y-3">
                  {/* Quote Details if present */}
                  {action.result?.quoteDetails && (
                    <div className="p-4 rounded-xl bg-[#0c1211] border border-[#1d2b26] space-y-3">
                      {editingQuote ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Client name</label>
                            <input
                              value={editingQuote.clientName}
                              onChange={(e) => updateEditField({ clientName: e.target.value })}
                              placeholder="Client name"
                              className={editInputCls}
                            />
                          </div>
                          <div className="space-y-2">
                            {editingQuote.items.map((item, idx) => (
                              <div key={idx} className="space-y-1.5 py-1 border-b border-[#1d2b26] last:border-0">
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={item.description}
                                    onChange={(e) => updateEditItem(idx, { description: e.target.value })}
                                    placeholder="Description"
                                    aria-label="Line item description"
                                    className={`${editItemInputCls} flex-1`}
                                  />
                                  <button type="button" onClick={() => removeEditItem(idx)} aria-label="Remove line item" className="min-h-[48px] text-slate-500 hover:text-rose-400 text-base leading-none px-1 cursor-pointer">
                                    ×
                                  </button>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={String(item.quantity)}
                                    onChange={(e) => updateEditItem(idx, { quantity: Number(e.target.value) || 0 })}
                                    inputMode="decimal"
                                    aria-label="Quantity"
                                    className={`${editItemInputCls} w-16 font-mono`}
                                  />
                                  <span className="text-slate-500 text-xs">×</span>
                                  <input
                                    value={String(item.unitPrice)}
                                    onChange={(e) => updateEditItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                                    inputMode="decimal"
                                    aria-label="Unit price"
                                    className={`${editItemInputCls} flex-1 font-mono`}
                                  />
                                  <span className="text-xs font-mono text-slate-400 shrink-0">= ${item.total.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={addEditItem} className="min-h-[48px] text-xs font-semibold text-[#22ec72] hover:text-[#22ec72] cursor-pointer">
                              + Add line item
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total amount (USD)</label>
                            <input
                              value={String(editingQuote.totalAmount)}
                              onChange={(e) => updateEditField({ totalAmount: Number(e.target.value) || 0 })}
                              inputMode="decimal"
                              aria-label="Total amount"
                              className={`${editInputCls} font-mono`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Terms</label>
                            <input
                              value={editingQuote.terms || ''}
                              onChange={(e) => updateEditField({ terms: e.target.value })}
                              placeholder="Terms"
                              className={editInputCls}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 border-b border-[#1d2b26] pb-2">
                            <span>Quote for: {action.result.quoteDetails.clientName}</span>
                            <span className="text-[#22ec72] font-mono text-sm">
                              Total: ${action.result.quoteDetails.totalAmount}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-300">
                            {(action.result.quoteDetails.items || []).map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-[#1d2b26] last:border-0">
                                <span>{item.description} (x{item.quantity})</span>
                                <span className="font-mono text-slate-400">${item.total}</span>
                              </div>
                            ))}
                          </div>
                          {action.result.quoteDetails.terms && (
                            <div className="text-xs text-slate-500 italic">
                              Terms: {action.result.quoteDetails.terms}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Invoice Details if present */}
                  {action.result?.invoiceDetails && (
                    <div className="p-4 rounded-xl bg-[#0c1211] border border-[#1d2b26] space-y-3">
                      {editingInvoice ? (
                        <>
                          <div className="text-xs font-semibold text-slate-200 border-b border-[#1d2b26] pb-2">
                            Invoice: {editingInvoice.invoiceNumber}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Client name</label>
                            <input
                              value={editingInvoice.clientName}
                              onChange={(e) => updateEditField({ clientName: e.target.value })}
                              placeholder="Client name"
                              className={editInputCls}
                            />
                          </div>
                          <div className="space-y-2">
                            {editingInvoice.items.map((item, idx) => (
                              <div key={idx} className="space-y-1.5 py-1 border-b border-[#1d2b26] last:border-0">
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={item.description}
                                    onChange={(e) => updateEditItem(idx, { description: e.target.value })}
                                    placeholder="Description"
                                    aria-label="Line item description"
                                    className={`${editItemInputCls} flex-1`}
                                  />
                                  <button type="button" onClick={() => removeEditItem(idx)} aria-label="Remove line item" className="min-h-[48px] text-slate-500 hover:text-rose-400 text-base leading-none px-1 cursor-pointer">
                                    ×
                                  </button>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={String(item.quantity)}
                                    onChange={(e) => updateEditItem(idx, { quantity: Number(e.target.value) || 0 })}
                                    inputMode="decimal"
                                    aria-label="Quantity"
                                    className={`${editItemInputCls} w-16 font-mono`}
                                  />
                                  <span className="text-slate-500 text-xs">×</span>
                                  <input
                                    value={String(item.unitPrice)}
                                    onChange={(e) => updateEditItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                                    inputMode="decimal"
                                    aria-label="Unit price"
                                    className={`${editItemInputCls} flex-1 font-mono`}
                                  />
                                  <span className="text-xs font-mono text-slate-400 shrink-0">= ${item.total.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={addEditItem} className="min-h-[48px] text-xs font-semibold text-[#22ec72] hover:text-[#22ec72] cursor-pointer">
                              + Add line item
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total amount (USD)</label>
                            <input
                              value={String(editingInvoice.totalAmount)}
                              onChange={(e) => updateEditField({ totalAmount: Number(e.target.value) || 0 })}
                              inputMode="decimal"
                              aria-label="Total amount"
                              className={`${editInputCls} font-mono`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Due date</label>
                            <input
                              value={editingInvoice.dueDate || ''}
                              onChange={(e) => updateEditField({ dueDate: e.target.value })}
                              placeholder="Due date (e.g. Net 15 days)"
                              className={editInputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Payment instructions</label>
                            <input
                              value={editingInvoice.paymentInstructions || ''}
                              onChange={(e) => updateEditField({ paymentInstructions: e.target.value })}
                              placeholder="Payment instructions"
                              className={editInputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                            <input
                              value={editingInvoice.notes || ''}
                              onChange={(e) => updateEditField({ notes: e.target.value })}
                              placeholder="Notes"
                              className={editInputCls}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 border-b border-[#1d2b26] pb-2">
                            <span>Invoice: {action.result.invoiceDetails.invoiceNumber} ({action.result.invoiceDetails.clientName})</span>
                            <span className="text-[#22ec72] font-mono text-sm">
                              Due: ${action.result.invoiceDetails.totalAmount}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-slate-300">
                            {action.result.invoiceDetails.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1">
                                <span>{item.description}</span>
                                <span className="font-mono text-slate-400">${item.amount ?? item.total}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-slate-400">
                            Due: {action.result.invoiceDetails.dueDate} • {action.result.invoiceDetails.paymentInstructions}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Standard Draft Text Body */}
                  {action.result?.text && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-slate-400">Drafted Content:</div>
                      {isEditing ? (
                        <textarea
                          rows={5}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-[#0c1211] border border-[#22ec72]/50 rounded-xl p-3 text-xs md:text-sm text-slate-100 focus:outline-none font-mono"
                        />
                      ) : (
                        <div className="p-3.5 rounded-xl bg-[#05090a] border border-[#1d2b26] text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {action.result.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rejection input box if triggered */}
                {isRejecting && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-2">
                    <label className="text-xs font-medium text-rose-300">Rejection Note (Optional):</label>
                    <input
                      type="text"
                      value={rejectionNote}
                      onChange={(e) => setRejectionNote(e.target.value)}
                      placeholder="Why is this rejected? (e.g. Price too low, incorrect customer name)..."
                      className="w-full bg-[#0c1211] border border-rose-800/40 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRejectingActionId(null)}
                        className="min-h-[48px] px-3 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(action.id)}
                        className="min-h-[48px] px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!isRejecting && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1d2b26]">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingActionId(null); setEditAmounts(null); }}
                          className="min-h-[48px] px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleEditAndApprove(action.id)}
                          className="min-h-[48px] px-4 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-[#05090a] font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save & Approve</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingActionId(action.id);
                            setEditingActionId(null);
                          }}
                          className="min-h-[48px] px-3 py-2 rounded-xl bg-transparent hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition border border-rose-900/30 cursor-pointer disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => startEdit(action)}
                          className="min-h-[48px] px-3 py-2 rounded-xl bg-[#1d2b26] hover:bg-[#1d2b26] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-[#1d2b26] cursor-pointer disabled:opacity-40"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(action.id)}
                          className="min-h-[48px] px-5 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-[#05090a] font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-[#22ec72]/20 cursor-pointer disabled:opacity-40"
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#05090a]" />
                              <span>Executing...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Approve & Execute</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
  };

  const renderMoneyCard = (action: ActionRecord) => {
    const quote = action.result?.quoteDetails;
    const invoice = action.result?.invoiceDetails;
    const busy = pipelineBusyId === action.id;
    return (
      <div key={action.id} className="p-4 rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {quote ? `Quote — ${quote.clientName}` : `Invoice ${invoice?.invoiceNumber} — ${invoice?.clientName}`}
            </div>
            <div className="text-xs text-slate-500">
              Approved {new Date(action.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="text-base font-mono font-extrabold text-[#22ec72] shrink-0">
            ${quote ? quote.totalAmount : invoice?.totalAmount}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quote && (
            action.scheduledJobId ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5" /> Job scheduled
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => { setPipelineBusyId(action.id); try { await onScheduleJob(action); } finally { setPipelineBusyId(null); } }}
                className="min-h-[48px] px-3 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] disabled:opacity-50 text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                Schedule Job
              </button>
            )
          )}
          {invoice && (
            action.paymentStatus === 'paid' ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5" /> Paid{action.paidAmount ? ` $${action.paidAmount}` : ''}
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => { setPipelineBusyId(action.id); try { await onMarkPaid(action); } finally { setPipelineBusyId(null); } }}
                className="min-h-[48px] px-3 py-2 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] disabled:opacity-50 text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                Mark Paid
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1d2b26] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Invoices</span>
            {pendingActions.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {pendingActions.length} Pending Review
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create &amp; manage invoices
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalMode('quote')}
            className="min-h-[48px] px-3 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Quote</span>
          </button>
          <button
            type="button"
            onClick={() => setModalMode('invoice')}
            className="min-h-[48px] px-3 py-2 rounded-xl bg-[#0c1211] hover:bg-[#16211c] border border-[#22ec72]/40 text-xs font-bold text-[#22ec72] flex items-center gap-1.5 transition cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>
      {modalMode && (
        <QuoteInvoiceModal
          mode={modalMode}
          business={business}
          prefill={modalMode === 'invoice' ? modalPrefill : null}
          onClose={() => { setModalMode(null); setModalPrefill(null); }}
          onCreated={(createdId) => { onRefresh(); onMoneyCreated?.(createdId); }}
        />
      )}

      {/* Invoice list — pills and rows from the real invoice records.
          Tapping a row expands it to the full card: Approve / Edit / Reject
          for one waiting on approval, Mark Paid for an approved unpaid one. */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              ['all', 'All', invoiceCounts.all],
              ['unpaid', 'Unpaid', invoiceCounts.unpaid],
              ['paid', 'Paid', invoiceCounts.paid],
              ['overdue', 'Overdue', invoiceCounts.overdue],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setInvoiceFilter(id);
                setExpandedInvoiceId(null);
              }}
              aria-pressed={invoiceFilter === id}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[32px] ${
                invoiceFilter === id
                  ? 'bg-[#22ec72] text-black'
                  : 'bg-[#0c1211] border border-[#1d2b26] text-zinc-400 hover:text-white'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {invoiceRecords.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-2">
            <DollarSign className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">No invoices yet</div>
            <p className="text-xs text-zinc-500">
              Approved quotes become jobs, and finished jobs become invoices here.
            </p>
            <button
              type="button"
              onClick={() => setModalMode('invoice')}
              className="min-h-[48px] mt-2 px-3 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black text-xs font-extrabold cursor-pointer"
            >
              Create Invoice
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-2">
            <DollarSign className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">
              No {invoiceFilter} invoices
            </div>
            <p className="text-xs text-zinc-500">Try a different filter.</p>
            <button
              type="button"
              onClick={() => setInvoiceFilter('all')}
              className="min-h-[48px] mt-2 px-3 py-1.5 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] text-xs font-semibold hover:border-[#22ec72]/50 transition-colors cursor-pointer"
            >
              Show all invoices
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInvoices.map((action) => {
              const invoice = action.result!.invoiceDetails!;
              const status = invoiceStatus(action);
              const badge = invoiceBadge(status);
              const expanded = expandedInvoiceId === action.id;
              return (
                <div key={action.id} className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedInvoiceId(expanded ? null : action.id)}
                    className="min-h-[48px] w-full flex items-center gap-3 p-3.5 text-left hover:bg-[#16211c]/40 transition cursor-pointer"
                  >
                    <span className="w-9 h-9 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-mono font-bold text-white truncate">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="block text-xs text-zinc-400 truncate">
                        {invoice.clientName} • {new Date(action.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </span>
                    <span className="text-sm font-mono font-extrabold text-[#22ec72] shrink-0">
                      ${(invoice.totalAmount ?? invoice.amount ?? 0).toLocaleString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3">
                      {action.status === 'approved' ? renderMoneyCard(action) : renderActionCard(action)}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setModalMode('invoice')}
              className="min-h-[48px] w-full py-2.5 rounded-xl bg-[#0c1211] border border-[#22ec72]/40 text-[#22ec72] text-xs font-bold hover:bg-[#22ec72]/10 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        )}
      </section>

      {approvalActions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#22ec72]/10 border border-[#22ec72]/30 flex items-center justify-center text-[#22ec72] mx-auto glow-rc-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">All caught up!</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no actions awaiting your approval. Your AI team will queue items here when money or customer commitments require your sign-off.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
            Needs your approval
          </div>
          {quoteActions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={<FileText className="w-4 h-4 text-[#22ec72]" />}
                title="Quotes & Proposals"
                subtitle="Review pricing and terms before they go to the customer."
                count={quoteActions.length}
              />
              <div className="space-y-4">{quoteActions.map(renderActionCard)}</div>
            </section>
          )}
          {escalationActions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
                title="Escalations"
                subtitle="Safety issues, money movement, and items that need your call."
                count={escalationActions.length}
              />
              <div className="space-y-4">{escalationActions.map(renderActionCard)}</div>
            </section>
          )}
          {otherActions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={<ClipboardList className="w-4 h-4 text-slate-400" />}
                title="Other Actions"
                subtitle="Everything else waiting for review."
                count={otherActions.length}
              />
              <div className="space-y-4">{otherActions.map(renderActionCard)}</div>
            </section>
          )}
        </div>
      )}

      {approvedQuotes.length > 0 && (
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionHeader
              icon={<Briefcase className="w-4 h-4 text-[#22ec72]" />}
              title="Approved Quotes"
              subtitle="Quotes you approved — schedule the job to keep the money moving."
              count={approvedQuotes.length}
            />
            <div className="space-y-3">{approvedQuotes.map(renderMoneyCard)}</div>
          </section>
        </div>
      )}
    </div>
  );
};
