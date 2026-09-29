import React, { useState } from 'react';
import { 
  X, 
  Reply, 
  Trash2, 
  Star, 
  Mail, 
  ArrowLeft, 
  ExternalLink, 
  Calendar, 
  User, 
  ShieldAlert, 
  Sparkles,
  Briefcase
} from 'lucide-react';
import { GmailMessageDetail } from '../../lib/gmail';
import { GmailConfirmModal, GmailActionType } from './GmailConfirmModal';

interface GmailMessageDetailModalProps {
  message: GmailMessageDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onReply: (message: GmailMessageDetail) => void;
  onToggleStar: (messageId: string, currentStarred: boolean) => Promise<void>;
  onMarkUnread: (messageId: string) => Promise<void>;
  onTrashMessage: (messageId: string) => Promise<void>;
  onPermanentDelete?: (messageId: string) => Promise<void>;
  onCreateJobFromEmail?: (message: GmailMessageDetail) => void;
}

export const GmailMessageDetailModal: React.FC<GmailMessageDetailModalProps> = ({
  message,
  isOpen,
  onClose,
  onReply,
  onToggleStar,
  onMarkUnread,
  onTrashMessage,
  onPermanentDelete,
  onCreateJobFromEmail,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<GmailActionType>('trash');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !message) return null;

  const handleRequestTrash = () => {
    setConfirmAction('trash');
    setConfirmOpen(true);
  };

  const handleRequestPermanentDelete = () => {
    setConfirmAction('delete');
    setConfirmOpen(true);
  };

  const handleExecuteConfirmedAction = async () => {
    setIsProcessing(true);
    try {
      if (confirmAction === 'trash') {
        await onTrashMessage(message.id);
      } else if (confirmAction === 'delete' && onPermanentDelete) {
        await onPermanentDelete(message.id);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-2xl max-h-[94vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-left">
          
          {/* Top Bar with Navigation & Actions */}
          <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Back to Inbox"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-zinc-300">Email Details</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Star Button */}
              <button
                type="button"
                onClick={() => onToggleStar(message.id, message.isStarred)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  message.isStarred
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800'
                }`}
                title={message.isStarred ? 'Starred' : 'Star this message'}
              >
                <Star className={`w-4 h-4 ${message.isStarred ? 'fill-amber-400' : ''}`} />
              </button>

              {/* Mark as Unread */}
              <button
                type="button"
                onClick={async () => {
                  await onMarkUnread(message.id);
                  onClose();
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Mark as unread"
              >
                <Mail className="w-4 h-4" />
              </button>

              {/* Trash */}
              <button
                type="button"
                onClick={handleRequestTrash}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                title="Move to trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {message.labelIds.map((lbl) => (
                  <span
                    key={lbl}
                    className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400"
                  >
                    {lbl}
                  </span>
                ))}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {message.subject || '(No Subject)'}
              </h2>
            </div>

            {/* Header Metadata Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-lime-400 shrink-0">
                    {message.from.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{message.from}</div>
                    <div className="text-[11px] text-zinc-400 font-mono truncate">
                      To: {message.to}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-mono shrink-0">
                  {message.date}
                </div>
              </div>

              {message.cc && (
                <div className="text-[11px] text-zinc-400 font-mono">
                  <span className="text-zinc-500 font-medium">Cc:</span> {message.cc}
                </div>
              )}
            </div>

            {/* Quick Dispatch Workflow Action */}
            {onCreateJobFromEmail && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-lime-950/20 border border-lime-800/40 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-lime-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                    <span>RCOS Operations Dispatch</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Automatically convert this email into an active field job or service dispatch
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCreateJobFromEmail(message);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-lime-950/50 transition shrink-0"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Create Job</span>
                </button>
              </div>
            )}

            {/* Email Body Rendering */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 min-h-[160px] text-zinc-200 text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <div 
                className="prose prose-invert max-w-none text-zinc-200 text-xs sm:text-sm"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }} 
              />
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleRequestPermanentDelete}
              className="text-[11px] text-red-400/80 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-950/20 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onReply(message);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-lime-950/50"
              >
                <Reply className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mandatory User Confirmation Modal for Destructive Workspace Operations */}
      <GmailConfirmModal
        isOpen={confirmOpen}
        actionType={confirmAction}
        title={confirmAction === 'trash' ? 'Move Email to Trash' : 'Permanently Delete Email'}
        description={
          confirmAction === 'trash'
            ? `Are you sure you want to move this email from "${message.from}" to your Gmail Trash? You can restore it later from Trash if needed.`
            : `Are you sure you want to permanently delete this email? This operation is IRREVERSIBLE and will permanently erase the message from your Google Workspace Gmail account.`
        }
        targetDetails={{
          recipient: message.from,
          subject: message.subject,
          itemCount: 1,
          impactSummary: confirmAction === 'trash' 
            ? 'Moves message to Gmail Trash folder.' 
            : 'Permanent, unrecoverable data deletion.',
        }}
        confirmButtonText={confirmAction === 'trash' ? 'Move to Trash' : 'Permanently Delete'}
        isProcessing={isProcessing}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
