import React, { useState } from 'react';
import {
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Clock,
  Send,
  ChevronRight,
} from 'lucide-react';
import { AgentInboxMessage, TabType } from '../types';
import { AGENT_META } from '../services/agentInboxService';
import { buildSmsUrl, isFollowupMessage, parseSmsUrl } from '../utils/followups';
import { safeOpenUrl } from '../lib/safeOpen';

interface AgentInboxMessageCardProps {
  msg: AgentInboxMessage;
  onRespond: (msg: AgentInboxMessage, action: 'answered' | 'dismissed' | 'snoozed', text?: string) => void;
  onNavigateTab: (tab: TabType) => void;
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

/**
 * One AI Team message, with its full actions — moved verbatim out of the
 * retired AgentInboxModal so the Operations feed renders it inline.
 * Reply / snooze / dismiss and the follow-up Send now / Edit / Dismiss
 * all behave exactly as they did in the modal.
 *
 * Follow-up drafts (Send now / Edit / Dismiss). Detected by the sms:
 * action the engine stores. Send now only OPENS the phone's SMS app —
 * nothing is marked sent; the owner taps Dismiss once they've actually
 * sent it.
 */
export const AgentInboxMessageCard: React.FC<AgentInboxMessageCardProps> = ({
  msg,
  onRespond,
  onNavigateTab,
}) => {
  const agent = AGENT_META[msg.agent] || AGENT_META.system;
  const kind = KIND_META[msg.kind] || KIND_META.suggestion;
  const KindIcon = kind.icon;
  const [reply, setReply] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const done = msg.status !== 'unread' && msg.status !== 'read';

  const followup = isFollowupMessage(msg);
  const sms = followup ? parseSmsUrl(msg.actionUrl) : null;
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(sms?.text || '');
  const openSmsApp = (draft: string) => {
    if (!sms) return;
    void safeOpenUrl(buildSmsUrl(sms.phone, draft), { allowContact: true });
  };

  const goAction = () => {
    if (msg.actionTab) onNavigateTab(msg.actionTab);
    // Server-stored string: only http(s), same-app routes and sms:/tel:/mailto: open.
    else if (msg.actionUrl) void safeOpenUrl(msg.actionUrl, { allowContact: true });
    onRespond(msg, 'answered');
  };

  return (
    <div
      className={`rounded-2xl border p-3.5 transition-opacity ${
        done ? 'bg-[#0c1211]/40 border-[#1d2b26] opacity-60' : 'bg-[#0c1211] border-[#1d2b26]'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${agent.bg}`}>
          <span className={agent.color}>{agent.name}</span>
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${kind.chip}`}>
          <KindIcon className="w-3 h-3" />
          {kind.label}
        </span>
        <span className="ml-auto text-xs text-zinc-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(msg.createdAt)}
        </span>
      </div>

      <div className="mt-2 text-sm font-bold text-white">{msg.title}</div>
      <div className="mt-1 text-xs text-zinc-400 leading-relaxed">{msg.body}</div>

      {msg.status === 'snoozed' && (
        <div className="mt-2 text-xs text-zinc-500 italic">Snoozed — I&apos;ll bring this back tomorrow.</div>
      )}
      {msg.status === 'answered' && msg.responseText && (
        <div className="mt-2 text-xs text-zinc-500 italic">Your reply: &quot;{msg.responseText}&quot;</div>
      )}

      {!done && (
        <div className="mt-3">
          {followup && !editOpen && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => openSmsApp(sms?.text || '')}
                  className="min-h-[48px] flex-1 py-2 rounded-xl bg-[#22ec72] text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Send className="w-3.5 h-3.5" /> Send now
                </button>
                <button
                  onClick={() => {
                    setEditText(sms?.text || '');
                    setEditOpen(true);
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Edit
                </button>
                <button
                  onClick={() => onRespond(msg, 'dismissed')}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Dismiss
                </button>
              </div>
              <div className="text-xs text-zinc-500">
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
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#22ec72]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => openSmsApp(editText)}
                  disabled={!editText.trim()}
                  className="min-h-[48px] flex-1 py-2 rounded-xl bg-[#22ec72] text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Open in SMS app
                </button>
                <button
                  onClick={() => setEditOpen(false)}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
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
                className="min-h-[48px] flex-1 py-2 rounded-xl bg-[#22ec72] text-black text-xs font-extrabold active:scale-98"
              >
                Reply
              </button>
              <button
                onClick={() => onRespond(msg, 'dismissed')}
                className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
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
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#22ec72]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => reply.trim() && onRespond(msg, 'answered', reply.trim())}
                  disabled={!reply.trim()}
                  className="min-h-[48px] flex-1 py-2 rounded-xl bg-[#22ec72] text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
                <button
                  onClick={() => onRespond(msg, 'dismissed')}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
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
                  className="min-h-[48px] flex-1 py-2 rounded-xl bg-[#22ec72] text-black text-xs font-extrabold flex items-center justify-center gap-1 active:scale-98"
                >
                  {msg.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {msg.kind === 'suggestion' && (
                <button
                  onClick={() => onRespond(msg, 'snoozed')}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
                >
                  Tomorrow
                </button>
              )}
              <button
                onClick={() => onRespond(msg, 'dismissed')}
                className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold active:scale-98"
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
