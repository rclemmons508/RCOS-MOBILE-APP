import React, { useState } from 'react';
import { Send, X, FileEdit, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { SendEmailParams } from '../../lib/gmail';
import { GmailConfirmModal, GmailActionType } from './GmailConfirmModal';

interface GmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (params: SendEmailParams) => Promise<void>;
  onSaveDraft: (params: SendEmailParams) => Promise<void>;
  initialRecipient?: string;
  initialSubject?: string;
  initialBody?: string;
  threadId?: string;
}

const TEMPLATES = [
  {
    name: 'Emergency Dispatch',
    subject: 'URGENT: Emergency Field Technician Dispatched',
    body: `Hello,\n\nOur senior field technician has been dispatched to your facility. Estimated arrival time is within 45 minutes.\n\nTechnician: Dave Vance (Lead SCADA / Refrigeration Specialist)\nVehicle: Unit 04\nDirect Dispatch Radio: (555) 019-4820\n\nPlease ensure mechanical room access is unlocked.\n\nBest regards,\nRC Solutions Operations`,
  },
  {
    name: 'Quote Proposal',
    subject: 'Estimate: Commercial HVAC Overhaul & Service Agreement',
    body: `Hello,\n\nThank you for reaching out to RC Solutions. Following our on-site diagnostic, we have prepared a comprehensive service and overhaul proposal.\n\nScope of Work:\n- High-side pressure manifold leak inspection\n- 40A Contactor replacement and wire harness test\n- R-410A system balance and thermal efficiency validation\n\nTotal Estimated Amount: $1,850.00\nValid for: 30 days\n\nPlease reply to this email to confirm schedule authorization.\n\nBest regards,\nRC Solutions Field Engineering`,
  },
  {
    name: 'Job Completed',
    subject: 'Work Order Completed: Facility System Sign-Off',
    body: `Hello,\n\nThis notification confirms that the scheduled service on your cooling plant has been completed and verified to exceed nominal operating tolerances.\n\n- All safety relief valves certified\n- Delta T across evaporator coils: 19.4°F (Optimal)\n- 100% digital telemetry handshake established\n\nFull service sign-off documentation is archived in the RCOS system.\n\nBest regards,\nRC Solutions Field Team`,
  },
];

export const GmailComposeModal: React.FC<GmailComposeModalProps> = ({
  isOpen,
  onClose,
  onSend,
  onSaveDraft,
  initialRecipient = '',
  initialSubject = '',
  initialBody = '',
  threadId,
}) => {
  const [to, setTo] = useState(initialRecipient);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Mandatory Confirmation Modal State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<GmailActionType>('send');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl: { subject: string; body: string }) => {
    if (!subject) setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const handleRequestSend = () => {
    if (!to.trim()) {
      alert('Please specify a recipient email address.');
      return;
    }
    setConfirmAction('send');
    setConfirmOpen(true);
  };

  const handleRequestDraft = () => {
    setConfirmAction('draft');
    setConfirmOpen(true);
  };

  const handleExecuteConfirmedAction = async () => {
    setIsProcessing(true);
    try {
      const emailParams: SendEmailParams = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim() || '(No Subject)',
        body,
        threadId,
      };

      if (confirmAction === 'send') {
        await onSend(emailParams);
      } else if (confirmAction === 'draft') {
        await onSaveDraft(emailParams);
      }
      setConfirmOpen(false);
      onClose();
    } catch (err: any) {
      alert(`Action failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Compose Gmail Message</h3>
                <p className="text-[11px] text-zinc-400">Authenticated via Google Workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {/* Template Shortcuts */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-lime-400" />
                <span>Quick Operations Templates</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-400">To:</label>
                <button
                  type="button"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-[10px] text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{showCcBcc ? 'Hide Cc/Bcc' : 'Add Cc/Bcc'}</span>
                  {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@company.com or technician@rcsolutions.com"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition"
              />
            </div>

            {/* Cc / Bcc Expandable */}
            {showCcBcc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-100">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Cc:</label>
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="manager@company.com"
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Bcc:</label>
                  <input
                    type="email"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="audit@rcsolutions.com"
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                  />
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-400">Subject:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email Subject..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition font-medium"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-400">Message Body:</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your email message here..."
                className="w-full p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition leading-relaxed resize-none font-sans"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleRequestDraft}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestSend}
                disabled={!to.trim() || !subject.trim()}
                className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-lime-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Review & Send</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mandatory User Confirmation Modal for Destructive Workspace Operations */}
      <GmailConfirmModal
        isOpen={confirmOpen}
        actionType={confirmAction}
        title={confirmAction === 'send' ? 'Confirm Outbound Email' : 'Save Gmail Draft'}
        description={
          confirmAction === 'send'
            ? `Are you sure you want to send this email via Gmail? The message will be dispatched directly from your authenticated Google Workspace account to the designated recipient.`
            : `Save this message as a draft in your Gmail account? You will be able to review or send it later.`
        }
        targetDetails={{
          recipient: to,
          subject: subject || '(No Subject)',
          impactSummary: confirmAction === 'send'
            ? 'This action sends an active email to an external or internal mailbox.'
            : 'Stored in Gmail Drafts folder.',
        }}
        confirmButtonText={confirmAction === 'send' ? 'Confirm & Send' : 'Save to Drafts'}
        isProcessing={isProcessing}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
