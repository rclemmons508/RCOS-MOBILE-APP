import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { ActionRecord, BusinessAccount } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

interface ApprovalQueueViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  onDecision: (actionId: string, decision: 'approved' | 'rejected' | 'edited', editedContent?: string, note?: string) => Promise<void>;
}

export const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  business,
  actions,
  onDecision
}) => {
  const pendingActions = actions.filter(a => a.status === 'awaiting_approval');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
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
      await onDecision(actionId, 'edited', editText);
      setEditingActionId(null);
    } finally {
      setProcessingId(null);
    }
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
            Your safety net. Review commitment drafts, client quotes, and financial transactions before they go out.
          </p>
        </div>
      </div>

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
        <div className="space-y-4">
          {pendingActions.map((action) => {
            const employee = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
            const isEditing = editingActionId === action.id;
            const isRejecting = rejectingActionId === action.id;
            const isBusy = processingId === action.id;

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
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Money Movement Lock
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
                    </div>
                  )}

                  {/* Invoice Details if present */}
                  {action.result?.invoiceDetails && (
                    <div className="p-4 rounded-xl bg-[#121622] border border-[#222b3d] space-y-3">
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
                          onClick={() => setEditingActionId(null)}
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
                          onClick={() => {
                            setEditingActionId(action.id);
                            setEditText(action.result?.text || '');
                            setRejectingActionId(null);
                          }}
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
          })}
        </div>
      )}
    </div>
  );
};
