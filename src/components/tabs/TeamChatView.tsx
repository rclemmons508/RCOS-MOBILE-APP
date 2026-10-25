import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Users, MessageSquare } from 'lucide-react';
import { BusinessAccount, BusinessMember, TeamMessage, User } from '../../types';
import { teamService } from '../../services/teamService';
import { markTeamSeen } from '../../services/teamUnread';
import { useTeamLiveEvents } from '../../hooks/useTeamLiveEvents';
import {
  loadOutbox,
  enqueueTeamMessage,
  removeQueuedMessage,
  sendQueuedMessage,
  isOfflineFailure,
  QueuedTeamMessage
} from '../../services/teamOutbox';
import { resolveProfilePicture } from '../../utils/profilePicture';
import { haptic } from '../../utils/haptics';

interface TeamChatViewProps {
  businessId: string;
  business?: BusinessAccount | null;
  currentUser?: User | null;
  onBack?: () => void;
}

// Safety-net poll only. New messages normally arrive instantly over the
// live stream; this slow tick is the fallback while the stream is down,
// and it stays until the live path is proven on a real phone build.
const SAFETY_NET_POLL_MS = 30000;

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Small avatar: photo when there is one, colored initial circle otherwise. */
const MemberAvatar: React.FC<{ member?: BusinessMember | null; name: string; email: string; size?: 'sm' | 'md' }> = ({
  member,
  name,
  email,
  size = 'md'
}) => {
  const [broken, setBroken] = useState(false);
  const dims = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  const src = member?.avatar ? resolveProfilePicture(member.avatar, '') : '';
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`${dims} rounded-full object-cover border border-zinc-700 shrink-0`}
      />
    );
  }
  const initial = (name || email || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className={`${dims} rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 flex items-center justify-center font-bold shrink-0`}>
      {initial}
    </div>
  );
};

/**
 * Team Chat — messages between real people on the same company account.
 * Separate from the AI chat (GeminiChatView): these messages go to the
 * other humans on the team, not to an AI assistant. New messages arrive
 * live over the server stream while the screen is open, with a slow
 * 30-second safety-net refresh as fallback, so both phones see new
 * messages without tapping anything.
 */
export const TeamChatView: React.FC<TeamChatViewProps> = ({ businessId, business, currentUser, onBack }) => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [members, setMembers] = useState<BusinessMember[]>(business?.members || []);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Messages saved on this device because they could not be sent yet
  // (see teamOutbox.ts). Shown in the chat as "Still sending…" so a
  // failed send is never silently lost.
  const [queued, setQueued] = useState<QueuedTeamMessage[]>([]);
  // 'saved' only after the server list actually loaded; 'unknown'
  // until then or after a failed load. The status line never claims
  // "Saved" on a guess.
  const [syncState, setSyncState] = useState<'saved' | 'unknown'>('unknown');
  const flushingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const myEmail = (currentUser?.email || '').toLowerCase();

  // The chat is open, so everything loaded here counts as seen — this
  // is what clears the unread badge on the Messages tab.
  const applyMessages = useCallback((msgs: TeamMessage[]) => {
    const list = Array.isArray(msgs) ? msgs : [];
    setMessages(list);
    if (list.length > 0) markTeamSeen(businessId, list[list.length - 1].id);
  }, [businessId]);

  const loadMessages = useCallback(async () => {
    if (!businessId || !currentUser?.email) return;
    try {
      const msgs = await teamService.getTeamMessages(businessId, currentUser.email);
      applyMessages(msgs);
      setSyncState('saved');
    } catch {
      /* keep the last good list — a blip must not blank the chat */
      setSyncState('unknown');
    }
  }, [businessId, currentUser?.email, applyMessages]);

  const loadAll = useCallback(async () => {
    if (!businessId || !currentUser?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setQueued(loadOutbox(businessId));
    try {
      const [msgs, roster] = await Promise.all([
        teamService.getTeamMessages(businessId, currentUser.email),
        teamService.getTeam(businessId, currentUser.email)
      ]);
      applyMessages(msgs);
      setSyncState('saved');
      if (roster?.members) setMembers(roster.members);
    } catch (e: any) {
      setError(e?.message || 'Could not load the team chat. Please try again.');
      setSyncState('unknown');
    } finally {
      setLoading(false);
    }
  }, [businessId, currentUser?.email, applyMessages]);

  /**
   * Send queued messages. With autoOnly, only items that failed while
   * provably offline go out on their own (those requests never
   * reached the server, so resending cannot duplicate them). Items
   * that failed ambiguously (e.g. a timeout) only go out when the
   * user taps Retry — see teamOutbox.ts.
   */
  const flushOutbox = useCallback(async (autoOnly: boolean) => {
    if (!businessId || !currentUser?.email || flushingRef.current) return;
    const items = loadOutbox(businessId);
    const due = autoOnly ? items.filter(i => i.status === 'offline') : items;
    if (due.length === 0) {
      setQueued(items);
      return;
    }
    flushingRef.current = true;
    try {
      const sent: TeamMessage[] = [];
      for (const item of due) {
        const saved = await sendQueuedMessage(businessId, currentUser.email, item);
        if (saved) sent.push(saved);
      }
      if (sent.length > 0) setMessages(prev => [...prev, ...sent]);
      setQueued(loadOutbox(businessId));
      if (sent.length > 0) loadMessages();
    } finally {
      flushingRef.current = false;
    }
  }, [businessId, currentUser?.email, loadMessages]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live first: a teammate's message refreshes this list the moment it
  // lands on the server. The slow poll below is only the safety net.
  useTeamLiveEvents(businessId, currentUser?.email, loadMessages);

  // Safety-net poll while the chat is open, plus a refresh the moment
  // the app comes back into view. Kept on purpose until the live path
  // is proven on a real phone build — do not remove it yet.
  // Coming back into view also retries anything queued while offline.
  useEffect(() => {
    if (!businessId) return;
    const timer = setInterval(() => {
      if (!document.hidden) loadMessages();
    }, SAFETY_NET_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) {
        flushOutbox(true);
        loadMessages();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [businessId, loadMessages, flushOutbox]);

  // When the device comes back online, send queued offline messages on their own.
  useEffect(() => {
    const onOnline = () => {
      flushOutbox(true);
      loadMessages();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushOutbox, loadMessages]);

  // Stay pinned to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, queued.length]);

  /** Queue a message that could not be sent. Returns false when the
   *  outbox is full — in that case the draft is kept, never cleared. */
  const queueUnsent = (text: string, status: 'offline' | 'failed'): boolean => {
    if (!businessId || !currentUser?.email) return false;
    const item = enqueueTeamMessage(
      businessId,
      {
        senderEmail: currentUser.email,
        senderName: currentUser.fullName || currentUser.email,
        senderAvatar: currentUser.avatar,
        text
      },
      status
    );
    if (!item) {
      setError('Too many unsent messages saved on this device (50). Send or remove one first — your text is still in the box below.');
      return false;
    }
    setQueued(loadOutbox(businessId));
    setDraft('');
    return true;
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !businessId || !currentUser?.email) return;
    setError(null);
    // Already offline: do not wait on a network call that cannot
    // succeed — save it straight to the outbox, shown as Still sending.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      queueUnsent(text, 'offline');
      return;
    }
    setSending(true);
    try {
      const sent = await teamService.sendTeamMessage(businessId, currentUser.email, {
        text,
        senderName: currentUser.fullName || currentUser.email,
        senderAvatar: currentUser.avatar
      });
      setDraft('');
      if (sent) setMessages(prev => [...prev, sent]);
      await haptic.light();
      // Refresh right after sending so the list matches the server.
      loadMessages();
    } catch (err: any) {
      if (isOfflineFailure(err)) {
        // The request never got an answer: safe to send on its own later.
        queueUnsent(text, 'offline');
      } else if (err?.status === 408) {
        // Timed out: the server may already have it, so this waits
        // for a manual Retry tap instead of sending on its own.
        queueUnsent(text, 'failed');
      } else {
        // The server answered and said no (for example, not a team
        // member): keep the draft and show the reason, as before.
        setError(err?.message || 'Could not send that message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const retryQueued = async (item: QueuedTeamMessage) => {
    if (!businessId || !currentUser?.email) return;
    const sent = await sendQueuedMessage(businessId, currentUser.email, item);
    setQueued(loadOutbox(businessId));
    if (sent) {
      setMessages(prev => [...prev, sent]);
      loadMessages();
    }
  };

  const removeQueued = (item: QueuedTeamMessage) => {
    if (!businessId) return;
    removeQueuedMessage(businessId, item.queueId);
    setQueued(loadOutbox(businessId));
  };

  if (!businessId) {
    return (
      <div className="p-6 text-center space-y-2">
        <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
        <p className="text-sm text-zinc-300 font-bold">No company set up yet</p>
        <p className="text-xs text-zinc-500">Finish setting up your company first, then you can chat with your team.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/80">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">Team Chat</div>
          <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            <span>{business?.name || 'Your company'} · {members.length} {members.length === 1 ? 'person' : 'people'}</span>
          </div>
        </div>
      </div>

      {/* Who is on the team */}
      {members.length > 0 && (
        <div className="shrink-0 flex gap-2 overflow-x-auto px-3 py-2 border-b border-zinc-800/60">
          {members.map(m => {
            const isMe = m.email.toLowerCase() === myEmail;
            return (
              <div
                key={m.email.toLowerCase()}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] whitespace-nowrap ${
                  isMe ? 'border-lime-500/40 bg-lime-500/10 text-lime-200' : 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
                }`}
              >
                <MemberAvatar member={m} name={m.name} email={m.email} size="sm" />
                <span className="font-semibold max-w-[90px] truncate">{m.name}</span>
                {isMe && <span className="text-lime-400 font-bold">(You)</span>}
                {m.role === 'owner' && <span className="text-amber-400 font-bold">Owner</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {loading && (
          <p className="text-center text-xs text-zinc-500 py-6">Loading team chat…</p>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm text-zinc-300 font-bold">No messages yet</p>
            <p className="text-xs text-zinc-500">Say hello to your team — everyone on this company account will see it.</p>
          </div>
        )}
        {messages.map(msg => {
          const mine = (msg.senderEmail || '').toLowerCase() === myEmail;
          const member = members.find(m => m.email.toLowerCase() === (msg.senderEmail || '').toLowerCase());
          return (
            <div key={msg.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
              <MemberAvatar member={member} name={msg.senderName} email={msg.senderEmail} />
              <div className={`max-w-[78%] space-y-0.5 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`text-[10px] font-semibold ${mine ? 'text-lime-300' : 'text-zinc-400'}`}>
                  {mine ? 'You' : msg.senderName}
                  <span className="text-zinc-500 font-normal"> · {formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-snug break-words whitespace-pre-wrap ${
                    mine
                      ? 'bg-lime-500 text-black rounded-tr-md'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-md'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        {/* Unsent messages saved on this device — never hidden, never
            silently dropped. They send on their own when back online
            (offline ones) or when the user taps Retry (timed-out ones). */}
        {queued.map(item => (
          <div key={item.queueId} className="flex gap-2 flex-row-reverse">
            <MemberAvatar member={null} name={item.senderName} email={item.senderEmail} />
            <div className="max-w-[78%] space-y-0.5 items-end flex flex-col">
              <div className="text-[10px] font-semibold text-lime-300">
                You
                <span className="text-zinc-500 font-normal"> · {formatTime(item.createdAt)}</span>
              </div>
              <div className="px-3 py-2 rounded-2xl rounded-tr-md text-sm leading-snug break-words whitespace-pre-wrap bg-lime-500/40 text-lime-100 border border-dashed border-lime-500/60 opacity-90">
                {item.text}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-amber-300">
                  {item.status === 'offline'
                    ? 'Still sending…'
                    : 'Still sending — tap to retry'}
                </span>
                <button
                  type="button"
                  onClick={() => retryQueued(item)}
                  className="text-[11px] font-bold text-lime-300 underline underline-offset-2 cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => removeQueued(item)}
                  className="text-[11px] text-zinc-400 underline underline-offset-2 cursor-pointer"
                  aria-label="Remove unsent message"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sync status — plain words, and "Saved" only when the server
          list actually loaded and nothing is still waiting to send. */}
      {!loading && (
        <div className="shrink-0 px-3 pt-2">
          {queued.length > 0 ? (
            <p className="text-[11px] text-amber-300">
              Still sending — {queued.length} {queued.length === 1 ? 'message is' : 'messages are'} waiting to send.
              {queued.some(i => i.status === 'offline')
                ? ' They will send on their own when you are back online.'
                : ' Tap Retry on the message to send it.'}
            </p>
          ) : syncState === 'saved' ? (
            <p className="text-[11px] text-zinc-500">✓ Saved — all team messages are sent.</p>
          ) : (
            <p className="text-[11px] text-zinc-500">Connection unclear — new messages could not be checked just now.</p>
          )}
        </div>
      )}

      {/* Send box */}
      {error && (
        <p className="shrink-0 px-3 pb-1 text-xs text-red-300">{error}</p>
      )}
      <form onSubmit={handleSend} className="shrink-0 flex gap-2 px-3 py-2.5 border-t border-zinc-800/80">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Message your team…"
          autoComplete="off"
          maxLength={2000}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-lime-500"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="px-4 py-2.5 rounded-2xl bg-lime-500 hover:bg-lime-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{sending ? 'Sending…' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
};
