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
  BadgeCheck
} from 'lucide-react';
import { ActionRecord, BusinessAccount, EditedAmounts, EditedLineItem, InvoicePrefill } from '../types';
import { apiFetch } from '../lib/api';
import { asStringList } from '../utils/safeRender';
import { AI_EMPLOYEES } from '../data/employees';

interface ApprovalQueueViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  onDecision: (actionId: string, decision: 'approved' | 'rejected' | 'edited', editedContent?: string, note?: string, editedAmounts?: EditedAmounts) => Promise<void>;
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
    <div className="w-8 h-8 rounded-xl bg-[#141822] border border-[#263044] flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {title}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {count}
        </span>
      </h3>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
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
    'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {isQuote ? <FileText className="w-4 h-4 text-lime-400" /> : <DollarSign className="w-4 h-4 text-emerald-400" />}
            <span>{isQuote ? 'New Quote' : 'New Invoice'}</span>
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          {isQuote
            ? 'Creates a quote held for your approval in the queue below.'
            : 'Creates an invoice held for your approval in the queue below.'}
        </p>

        <div className="space-y-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name *" className={inputCls} />
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Service</label>
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
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
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
              <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Estimate helper</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" inputMode="decimal" className={inputCls} />
                <input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Materials $" inputMode="decimal" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} className="accent-lime-500 w-4 h-4" />
                <span>Emergency rate</span>
              </label>
              <button
                type="button"
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-bold text-white transition cursor-pointer"
              >
                {calculating ? 'Calculating…' : 'Calculate amount'}
              </button>
            </div>
          )}

          {!isQuote && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment due in (days)</label>
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
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black text-xs font-extrabold transition cursor-pointer"
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
  const moneyPipeline = actions
    .filter(a => a.status === 'approved' && (a.result?.quoteDetails || a.result?.invoiceDetails))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  // Vision-aligned grouping: quotes & proposals need sign-off; escalations need the owner's call.
  const isQuoteAction = (act: ActionRecord) =>
    ['generate_quote', 'draft_document', 'send_invoice'].includes(act.actionType || '');
  const isEscalationAction = (act: ActionRecord) =>
    act.actionType === 'safety_review' || ['money_movement', 'system_settings'].includes(act.riskCategory);
  const quoteActions = pendingActions.filter(isQuoteAction);
  const escalationActions = pendingActions.filter((act) => !isQuoteAction(act) && isEscalationAction(act));
  const otherActions = pendingActions.filter((act) => !isQuoteAction(act) && !isEscalationAction(act));
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
      await onDecision(actionId, 'edited', editText, undefined, editAmounts ?? undefined);
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
        items: quote.items.map((item) => ({
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
      await onDecision(actionId, 'rejected', undefined, rejectionNote);
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
            const editInputCls = 'w-full bg-[#131722] border border-[#00ff66]/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none';
            const editItemInputCls = 'min-w-0 bg-[#131722] border border-[#00ff66]/50 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none';

            return (
              <div 
                key={action.id}
                className="p-5 rounded-2xl bg-[#0e1118] border border-[#21293a] hover:border-slate-700 transition space-y-4 shadow-xl"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2233] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#141822] border border-[#263044] flex items-center justify-center text-white font-bold text-xs">
                      {employee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{action.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-[#00ff66] font-medium">{employee.name}</span>
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
                      <span title="Needs your approval before it sends — you can still edit the amount." className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Approval required
                      </span>
                    )}
                    {action.dollarAmount && action.dollarAmount > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#141822] text-[#00ff66] border border-[#273248]">
                        ${action.dollarAmount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Friendly status summary */}
                <div className="text-xs text-slate-300 flex items-center gap-2 bg-[#121622] px-3.5 py-2 rounded-xl border border-[#1e2536]">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{action.stepSummary}</span>
                </div>

                {/* Draft Content Card */}
                <div className="space-y-3">
                  {/* Quote Details if present */}
                  {action.result?.quoteDetails && (
                    <div className="p-4 rounded-xl bg-[#121622] border border-[#222b3d] space-y-3">
                      {editingQuote ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client name</label>
                            <input
                              value={editingQuote.clientName}
                              onChange={(e) => updateEditField({ clientName: e.target.value })}
                              placeholder="Client name"
                              className={editInputCls}
                            />
                          </div>
                          <div className="space-y-2">
                            {editingQuote.items.map((item, idx) => (
                              <div key={idx} className="space-y-1.5 py-1 border-b border-[#171d2b] last:border-0">
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={item.description}
                                    onChange={(e) => updateEditItem(idx, { description: e.target.value })}
                                    placeholder="Description"
                                    aria-label="Line item description"
                                    className={`${editItemInputCls} flex-1`}
                                  />
                                  <button type="button" onClick={() => removeEditItem(idx)} aria-label="Remove line item" className="text-slate-500 hover:text-rose-400 text-base leading-none px-1 cursor-pointer">
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
                            <button type="button" onClick={addEditItem} className="text-[11px] font-semibold text-lime-400 hover:text-lime-300 cursor-pointer">
                              + Add line item
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total amount (USD)</label>
                            <input
                              value={String(editingQuote.totalAmount)}
                              onChange={(e) => updateEditField({ totalAmount: Number(e.target.value) || 0 })}
                              inputMode="decimal"
                              aria-label="Total amount"
                              className={`${editInputCls} font-mono`}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terms</label>
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
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 border-b border-[#1c2436] pb-2">
                            <span>Quote for: {action.result.quoteDetails.clientName}</span>
                            <span className="text-[#00ff66] font-mono text-sm">
                              Total: ${action.result.quoteDetails.totalAmount}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-300">
                            {action.result.quoteDetails.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-[#171d2b] last:border-0">
                                <span>{item.description} (x{item.quantity})</span>
                                <span className="font-mono text-slate-400">${item.total}</span>
                              </div>
                            ))}
                          </div>
                          {action.result.quoteDetails.terms && (
                            <div className="text-[11px] text-slate-500 italic">
                              Terms: {action.result.quoteDetails.terms}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Invoice Details if present */}
                  {action.result?.invoiceDetails && (
                    <div className="p-4 rounded-xl bg-[#121622] border border-[#222b3d] space-y-3">
                      {editingInvoice ? (
                        <>
                          <div className="text-xs font-semibold text-slate-200 border-b border-[#1c2436] pb-2">
                            Invoice: {editingInvoice.invoiceNumber}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client name</label>
                            <input
                              value={editingInvoice.clientName}
                              onChange={(e) => updateEditField({ clientName: e.target.value })}
                              placeholder="Client name"
                              className={editInputCls}
                            />
                          </div>
                          <div className="space-y-2">
                            {editingInvoice.items.map((item, idx) => (
                              <div key={idx} className="space-y-1.5 py-1 border-b border-[#171d2b] last:border-0">
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    value={item.description}
                                    onChange={(e) => updateEditItem(idx, { description: e.target.value })}
                                    placeholder="Description"
                                    aria-label="Line item description"
                                    className={`${editItemInputCls} flex-1`}
                                  />
                                  <button type="button" onClick={() => removeEditItem(idx)} aria-label="Remove line item" className="text-slate-500 hover:text-rose-400 text-base leading-none px-1 cursor-pointer">
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
                            <button type="button" onClick={addEditItem} className="text-[11px] font-semibold text-lime-400 hover:text-lime-300 cursor-pointer">
                              + Add line item
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total amount (USD)</label>
                            <input
                              value={String(editingInvoice.totalAmount)}
                              onChange={(e) => updateEditField({ totalAmount: Number(e.target.value) || 0 })}
                              inputMode="decimal"
                              aria-label="Total amount"
                              className={`${editInputCls} font-mono`}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due date</label>
                            <input
                              value={editingInvoice.dueDate || ''}
                              onChange={(e) => updateEditField({ dueDate: e.target.value })}
                              placeholder="Due date (e.g. Net 15 days)"
                              className={editInputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment instructions</label>
                            <input
                              value={editingInvoice.paymentInstructions || ''}
                              onChange={(e) => updateEditField({ paymentInstructions: e.target.value })}
                              placeholder="Payment instructions"
                              className={editInputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
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
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 border-b border-[#1c2436] pb-2">
                            <span>Invoice: {action.result.invoiceDetails.invoiceNumber} ({action.result.invoiceDetails.clientName})</span>
                            <span className="text-[#00ff66] font-mono text-sm">
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
                          <div className="text-[11px] text-slate-400">
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
                          className="w-full bg-[#131722] border border-[#00ff66]/50 rounded-xl p-3 text-xs md:text-sm text-slate-100 focus:outline-none font-mono"
                        />
                      ) : (
                        <div className="p-3.5 rounded-xl bg-[#090b0e] border border-[#1b2233] text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
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
                      className="w-full bg-[#121622] border border-rose-800/40 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRejectingActionId(null)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(action.id)}
                        className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!isRejecting && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1a2030]">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingActionId(null); setEditAmounts(null); }}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleEditAndApprove(action.id)}
                          className="px-4 py-2 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
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
                          className="px-3 py-2 rounded-xl bg-transparent hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition border border-rose-900/30 cursor-pointer disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => startEdit(action)}
                          className="px-3 py-2 rounded-xl bg-[#171d2b] hover:bg-[#20273a] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-[#273248] cursor-pointer disabled:opacity-40"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(action.id)}
                          className="px-5 py-2 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-[#00ff66]/20 cursor-pointer disabled:opacity-40"
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#090b0e]" />
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
      <div key={action.id} className="p-4 rounded-2xl bg-[#0e1118] border border-[#21293a] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {quote ? `Quote — ${quote.clientName}` : `Invoice ${invoice?.invoiceNumber} — ${invoice?.clientName}`}
            </div>
            <div className="text-[11px] text-slate-500">
              Approved {new Date(action.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="text-base font-mono font-extrabold text-[#00ff66] shrink-0">
            ${quote ? quote.totalAmount : invoice?.totalAmount}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quote && (
            action.scheduledJobId ? (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-lime-500/10 text-lime-300 border border-lime-500/30 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5" /> Job scheduled
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => { setPipelineBusyId(action.id); try { await onScheduleJob(action); } finally { setPipelineBusyId(null); } }}
                className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                Schedule Job
              </button>
            )
          )}
          {invoice && (
            action.paymentStatus === 'paid' ? (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5" /> Paid{action.paidAmount ? ` $${action.paidAmount}` : ''}
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => { setPipelineBusyId(action.id); try { await onMarkPaid(action); } finally { setPipelineBusyId(null); } }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1f2637] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Approval Queue</span>
            {pendingActions.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {pendingActions.length} Pending Review
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quotes waiting for your sign-off, and escalations that need your call.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalMode('quote')}
            className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Quote</span>
          </button>
          <button
            type="button"
            onClick={() => setModalMode('invoice')}
            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
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

      {pendingActions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0e1118] border border-[#1f2638] space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] mx-auto glow-rc-sm">
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
          {quoteActions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={<FileText className="w-4 h-4 text-lime-400" />}
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

      {moneyPipeline.length > 0 && (
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionHeader
              icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              title="Money Pipeline"
              subtitle="Approved quotes and invoices — keep them moving to paid."
              count={moneyPipeline.length}
            />
            <div className="space-y-3">{moneyPipeline.map(renderMoneyCard)}</div>
          </section>
        </div>
      )}
    </div>
  );
};
