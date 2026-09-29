import React from 'react';
import { AlertTriangle, Send, Trash2, ShieldAlert, FileEdit, X } from 'lucide-react';

export type GmailActionType = 'send' | 'trash' | 'delete' | 'draft';

interface GmailConfirmModalProps {
  isOpen: boolean;
  actionType: GmailActionType;
  title: string;
  description: string;
  targetDetails?: {
    recipient?: string;
    subject?: string;
    itemCount?: number;
    impactSummary?: string;
  };
  confirmButtonText?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const GmailConfirmModal: React.FC<GmailConfirmModalProps> = ({
  isOpen,
  actionType,
  title,
  description,
  targetDetails,
  confirmButtonText,
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getActionTheme = () => {
    switch (actionType) {
      case 'delete':
        return {
          icon: ShieldAlert,
          iconBg: 'bg-red-500/10 text-red-400 border-red-500/30',
          btnBg: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50',
          defaultBtnText: 'Permanently Delete',
          badgeText: 'Irreversible Deletion',
          badgeColor: 'text-red-400 bg-red-950/60 border-red-800/60',
        };
      case 'trash':
        return {
          icon: Trash2,
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/50',
          defaultBtnText: 'Move to Trash',
          badgeText: 'Move to Trash',
          badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
        };
      case 'send':
        return {
          icon: Send,
          iconBg: 'bg-lime-500/10 text-lime-400 border-lime-500/30',
          btnBg: 'bg-lime-500 hover:bg-lime-400 text-black font-bold shadow-lg shadow-lime-950/50',
          defaultBtnText: 'Confirm & Send Email',
          badgeText: 'Outbound Gmail Message',
          badgeColor: 'text-lime-400 bg-lime-950/60 border-lime-800/60',
        };
      case 'draft':
      default:
        return {
          icon: FileEdit,
          iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/50',
          defaultBtnText: 'Save Draft',
          badgeText: 'Gmail Draft',
          badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800/60',
        };
    }
  };

  const theme = getActionTheme();
  const Icon = theme.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-left relative">
        
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${theme.iconBg} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${theme.badgeColor} font-semibold inline-block mb-1`}>
                {theme.badgeText}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 cursor-pointer transition disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Description */}
        <p className="text-xs text-zinc-300 leading-relaxed">
          {description}
        </p>

        {/* Detailed Item Context Box */}
        {targetDetails && (
          <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-2 text-xs">
            {targetDetails.recipient && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500 font-medium shrink-0">Recipient:</span>
                <span className="text-zinc-200 font-mono text-[11px] truncate text-right">
                  {targetDetails.recipient}
                </span>
              </div>
            )}
            {targetDetails.subject && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500 font-medium shrink-0">Subject:</span>
                <span className="text-zinc-200 font-semibold truncate text-right">
                  {targetDetails.subject}
                </span>
              </div>
            )}
            {targetDetails.itemCount !== undefined && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500 font-medium">Affected Items:</span>
                <span className="text-zinc-200 font-mono font-bold">
                  {targetDetails.itemCount} message{targetDetails.itemCount === 1 ? '' : 's'}
                </span>
              </div>
            )}
            {targetDetails.impactSummary && (
              <div className="pt-1.5 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                {targetDetails.impactSummary}
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-40 flex items-center gap-2 ${theme.btnBg}`}
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmButtonText || theme.defaultBtnText}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
