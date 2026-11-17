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

// Blank starter templates — no names, amounts, or job details baked in.
// Each one is a frame with {placeholders} for the sender to fill in from
// the real job or customer before sending.
const TEMPLATES = [
  {
    name: 'Emergency Dispatch',
    subject: 'URGENT: Emergency Field Technician Dispatched',
    body: `Hello {customerName},\n\nOur field technician has been dispatched to your facility.\n\nTechnician: {technician}\nEstimated arrival: {eta}\n\nPlease ensure access is unlocked.\n\nBest regards,\n{businessName}`,
  },
  {
    name: 'Quote Proposal',
    subject: 'Estimate: {jobTitle}',
    body: `Hello {customerName},\n\nThank you for reaching out to {businessName}. Following our on-site visit, we have prepared a proposal.\n\nScope of work:\n{scope}\n\nTotal estimated amount: {amount}\nValid for: 30 days\n\nPlease reply to this email to confirm.\n\nBest regards,\n{businessName}`,
  },
  {
    name: 'Job Completed',
    subject: 'Work Order Completed: {jobTitle}',
    body: `Hello {customerName},\n\nThis confirms the scheduled service at {address} has been completed.\n\nWork performed:\n{workSummary}\n\nThank you for choosing {businessName}.\n\nBest regards,\n{businessName}`,
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
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/20">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Compose Gmail Message</h3>
                <p className="text-xs text-zinc-400">Authenticated via Google Workspace</p>
              </div>
            </div>
            <button aria-label="Close"
              type="button"
              onClick={onClose}
              className="min-h-[48px] p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {/* Template Shortcuts */}
            <div className="space-y-1.5">
              <span className="text-xs uppercase font-mono tracking-wider text-zinc-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#22ec72]" />
                <span>Quick Operations Templates</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="min-h-[48px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400">To:</label>
                <button
                  type="button"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="min-h-[48px] text-xs text-[#22ec72] hover:underline flex items-center gap-0.5 cursor-pointer"
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
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72] transition"
              />
            </div>

            {/* Cc / Bcc Expandable */}
            {showCcBcc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-100">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Cc:</label>
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="manager@company.com"
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Bcc:</label>
                  <input
                    type="email"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="audit@rcsolutions.com"
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]"
                  />
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Subject:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email Subject..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72] transition font-medium"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Message Body:</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your email message here..."
                className="w-full p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72] transition leading-relaxed resize-none font-sans"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleRequestDraft}
              className="min-h-[48px] px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-3 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestSend}
                disabled={!to.trim() || !subject.trim()}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-[#22ec72]/10 disabled:opacity-40 disabled:cursor-not-allowed"
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
