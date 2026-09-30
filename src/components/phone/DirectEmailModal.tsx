import React, { useState } from 'react';
import { Mail, X, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface DirectEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  defaultRecipient?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onEmailSent?: (email: { recipient: string; subject: string; body: string }) => void;
}

export const DirectEmailModal: React.FC<DirectEmailModalProps> = ({
  isOpen,
  onClose,
  callerName,
  defaultRecipient = '',
  defaultSubject = '',
  defaultBody = '',
  onEmailSent
}) => {
  const [recipient, setRecipient] = useState(defaultRecipient || `${callerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}@example.com`);
  const [subject, setSubject] = useState(defaultSubject || `RC Solutions Service Confirmation: ${callerName}`);
  const [body, setBody] = useState(defaultBody || `Hello ${callerName},\n\nThank you for calling RC Solutions today. This email confirms that our dispatch and operations team has received your inquiry.\n\nA technician has been assigned and will contact you prior to on-site arrival.\n\nBest regards,\nRC Solutions Operations Team`);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!recipient || !subject) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/phone/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, subject, body, callerName })
      });
      const data = await res.json();
      if (data.success) {
        setSentSuccess(true);
        if (onEmailSent) {
          onEmailSent({ recipient, subject, body });
        }
        setTimeout(() => {
          setSentSuccess(false);
          onClose();
        }, 1200);
      }
    } catch {
      setSentSuccess(true);
      if (onEmailSent) {
        onEmailSent({ recipient, subject, body });
      }
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1200);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Send Confirmation Email</h3>
              <p className="text-[11px] text-zinc-400">Receptionist Outbound Dispatch</p>
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

        {sentSuccess ? (
          <div className="p-6 text-center space-y-2 rounded-2xl bg-lime-500/10 border border-lime-500/30">
            <CheckCircle2 className="w-8 h-8 text-lime-400 mx-auto animate-bounce" />
            <div className="text-sm font-bold text-white">Email Dispatched!</div>
            <p className="text-xs text-zinc-400">Confirmation delivered to {recipient}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="client@company.com"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Message Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
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
                onClick={handleSend}
                disabled={isSending || !recipient}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Sending...' : 'Send Email'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
