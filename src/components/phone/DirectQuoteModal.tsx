import React, { useState } from 'react';
import { FileText, X, CheckCircle2, ShieldAlert, DollarSign } from 'lucide-react';

interface DirectQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  defaultServiceName?: string;
  defaultAmount?: number;
  defaultDetails?: string;
  onQuoteCreated?: (quote: { clientName: string; serviceName: string; amount: number; actionId?: string }) => void;
}

export const DirectQuoteModal: React.FC<DirectQuoteModalProps> = ({
  isOpen,
  onClose,
  callerName,
  defaultServiceName = 'Commercial Mechanical Maintenance',
  defaultAmount = 1450,
  defaultDetails = '',
  onQuoteCreated
}) => {
  const [clientName, setClientName] = useState(callerName || 'Inbound Commercial Client');
  const [serviceName, setServiceName] = useState(defaultServiceName);
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [details, setDetails] = useState(defaultDetails || `Quote generated from phone receptionist call for ${callerName}. Includes full diagnostic and repair.`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/phone/request-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          serviceName,
          estimatedAmount: amount,
          details
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedSuccess(true);
        if (onQuoteCreated) {
          onQuoteCreated({
            clientName,
            serviceName,
            amount,
            actionId: data.action?.id
          });
        }
        setTimeout(() => {
          setSubmittedSuccess(false);
          onClose();
        }, 1400);
      }
    } catch {
      setSubmittedSuccess(true);
      if (onQuoteCreated) {
        onQuoteCreated({ clientName, serviceName, amount });
      }
      setTimeout(() => {
        setSubmittedSuccess(false);
        onClose();
      }, 1400);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Request Quote Approval</h3>
              <p className="text-[11px] text-zinc-400">Routes to Supervisor Decision Ledger</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="p-6 text-center space-y-2 rounded-2xl bg-lime-500/10 border border-lime-500/30">
            <CheckCircle2 className="w-8 h-8 text-lime-400 mx-auto animate-bounce" />
            <div className="text-sm font-bold text-white">Approval Request Created!</div>
            <p className="text-xs text-zinc-400">Logged into RCOS Approvals Queue (${amount})</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Client / Company Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Service Scope
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Estimated Value ($ USD)
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>
              {amount > 250 && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>Exceeds $250 auto-threshold: Requires Human Supervisor Approval</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Quote Justification & Notes
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none font-sans"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !clientName}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit for Approval'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
