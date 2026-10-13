import React, { useEffect, useState } from 'react';
import {
  X,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Inbox,
  Clock,
  Send,
  ChevronRight,
} from 'lucide-react';
import { AgentInboxMessage, TabType } from '../types';
import { AGENT_META } from '../services/agentInboxService';
import { buildSmsUrl, isFollowupMessage, parseSmsUrl } from '../utils/followups';

interface AgentInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AgentInboxMessage[];
  onRespond: (msg: AgentInboxMessage, action: 'answered' | 'dismissed' | 'snoozed', text?: string) => void;
  onNavigateTab: (tab: TabType) => void;
  onMarkRead: (msg: AgentInboxMessage) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

const KIND_META = {
  alert: { label: 'Alert', icon: AlertTriangle, chip: 'text-red-300 bg-red-500/15 border-red-500/30' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, chip: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  question: { label: 'Question', icon: HelpCircle, chip: 'text-sky-300 bg-sky-500/15 border-sky-500/30' },
} as const;

const MessageCard: React.FC<{
  msg: AgentInboxMessage;
  onRespond: AgentInboxModalProps['onRespond'];
  onNavigateTab: (tab: TabType) => void;
}> = ({ msg, onRespond, onNavigateTab }) => {
  const agent = AGENT_META[msg.agent] || AGENT_META.system;
  const kind = KIND_META[msg.kind] || KIND_META.suggestion;
  const KindIcon = kind.icon;
  const [reply, setReply] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const done = msg.status !== 'unread' && msg.status !== 'read');

  // Follow-up drafts (Send now / Edit / Dismiss). Detected by the sms: action
  // the engine stores. Send now only OPENS the phone's SMS app — nothing is
  // marked sent; the owner taps Dismiss once they've actually sent it.
  const followup = isFollowupMessage(msg);
  const sms = followup ? parseSmsUrl(msg.actionUrl) : null;
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(sms?.text || '');
  const openSmsApp = (draft: string) => {
    if (!sms) return;
    window.location.href = buildSmsUrl(sms.phone, draft);
  };

  const goAction = () => {
    if (msg.actionTab) onNavigateTab(msg.actionTab);
    else if (msg.actionUrl) window.open(msg.actionUrl, '_blank', 'noopener');
    onRespond(msg, 'answered');
  };

  return (
    <div
      className={`rounded-2xl border p-3.5 transition-opacity ${
        done ? 'bg-zinc-900/40 border-zinc-800 opacity-60' : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${agent.bg}`}>
          <span className={agent.color}>{agent.name}</span>
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${kind.chip}`}>
          <KindIcon className="w-3 h-3" />
          {kind.label}
        </span>
        <span className="ml-auto text-[10px] text-zinc-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(msg.createdAt)}
        </span>
      </div>

      <div className="mt-2 text-sm font-bold text-white">{msg.title}</div>
      <div className="mt-1 text-xs text-zinc-400 leading-relaxed">{msg.body}</div>

      {msg.status === 'snoozed' && (
        <div className="mt-2 text-[10px] text-zinc-500 italic">Snoozed — I'll bring this back tomorrow.</div>
      )}
      {msg.status === 'answered' && msg.responseText && (
        <div className="mt-2 text-[10px] text-zinc-500 italic">Your reply: "{msg.responseText}"</div>
      )}

      {!done && (
        <div className="mt-3">
          {followup && !editOpen && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => openSmsApp(sms?.text || '')}
                  className="flex-1 py-2 rounded-xl bg-lime-500 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Send className="w-3.5 h-3.5" /> Send now
                </button>
                <button
                  onClick={() => {
                    setEditText(sms?.text || '');
                    setEditOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Edit
                </button>
                <button
                  onClick={() => onRespond(msg, 'dismissed')}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Dismiss
                </button>
              </div>
              <div className="text-[10px] text-zinc-500">
                Nothing has been sent yet. Send it from your texting app, then tap Dismiss.
              </div>
            </div>
          )}
          {followup && editOpen && (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                autoComplete="off"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => openSmsApp(editText)}
                  disabled={!editText.trim()}
                  className="flex-1 py-2 rounded-xl bg-lime-500 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Open in SMS app
                </button>
                <button
                  onClick={() => setEditOpen(false)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!followup && msg.kind === 'question' && !replyOpen && (
            <div className="flex gap-2">
              <button
                onClick={() => setReplyOpen(true)}
                className="flex-1 py-2 rounded-xl bg-lime-500 text-black text-xs font-extrabold active:scale-98"
              >
                Reply
              </button>
              <button
                onClick={() => onRespond(msg, 'dismissed')}
                className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
              >
                Dismiss
              </button>
            </div>
          )}
          {!followup && msg.kind === 'question' && replyOpen && (
            <div className="space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your answer…"
                rows={2}
                autoComplete="off"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => reply.trim() && onRespond(msg, 'answered', reply.trim())}
                  disabled={!reply.trim()}
                  className="flex-1 py-2 rounded-xl bg-lime-500 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
                <button
                  onClick={() => onRespond(msg, 'dismissed')}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {!followup && msg.kind !== 'question' && (
            <div className="flex gap-2">
              {msg.actionLabel && (
                <button
                  onClick={goAction}
                  className="flex-1 py-2 rounded-xl bg-lime-500 text-black text-xs font-extrabold flex items-center justify-center gap-1 active:scale-98"
                >
                  {msg.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {msg.kind === 'suggestion' && (
                <button
                  onClick={() => onRespond(msg, 'snoozed')}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Tomorrow
                </button>
              )}
              <button
                onClick={() => onRespond(msg, 'dismissed')}
                className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentInboxModal: React.FC<AgentInboxModalProps> = ({
  isOpen,
  onClose,
  messages,
  onRespond,
  onNavigateTab,
  onMarkRead,
}) => {
  useEffect(() => {
    if (isOpen) {
      messages.filter((m) => m.status === 'unread').forEach(onMarkRead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const active = messages.filter((m) => m.status === 'unread' || m.status === 'read' || m.status === 'snoozed');
  const handled = messages.filter((m) => m.status === 'answered' || m.status === 'dismissed');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-zinc-800">
          <Inbox className="w-5 h-5 text-lime-400" />
          <div className="text-base font-extrabold text-white">Agent Inbox</div>
          <div className="text-[10px] text-zinc-500">Your team messages you here</div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl bg-zinc-900 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {active.length === 0 && handled.length === 0 && (
            <div className="text-center py-10">
              <Inbox className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <div className="text-sm font-bold text-zinc-300">All caught up</div>
              <div className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                When your agents spot something or need a decision, they'll message you here.
              </div>
            </div>
          )}

          {active.map((m) => (
            <MessageCard key={m.id} msg={m} onRespond={onRespond} onNavigateTab={onNavigateTab} />
          ))}

          {handled.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider pt-2">
                Handled
              </div>
              {handled.slice(0, 5).map((m) => (
                <MessageCard key={m.id} msg={m} onRespond={onRespond} onNavigateTab={onNavigateTab} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
