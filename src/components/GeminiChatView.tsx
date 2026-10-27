import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  User,
  Zap,
  BrainCircuit,
  Cpu,
  Loader2,
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { BusinessAccount } from '../types';
import { AI_EMPLOYEES } from '../data/employees';
import { apiFetch } from '../lib/api';
import { employeeCustomizationService } from '../services/employeeCustomizationService';
import { resolveBehaviorProtocol } from '../utils/agentBehavior';
import { getEmployeeIcon, agentColorSet } from '../utils/employeeIcon';
import {
  detectChatAction,
  executeChatAction,
  type ChatActionDraft
} from '../services/chatActions';

type ActionCardStatus = 'pending' | 'confirmed' | 'cancelled' | 'done' | 'failed';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  roleId?: string;
  /** Present only on confirmation-card messages. Nothing runs until Confirm. */
  actionCard?: {
    draft: ChatActionDraft;
    status: ActionCardStatus;
    result?: string;
    recordId?: string;
  };
}

interface GeminiChatViewProps {
  business?: BusinessAccount | null;
  onClose?: () => void;
  /** Signed-in user, for team messages (server checks team membership). */
  senderEmail?: string;
  senderName?: string;
  /**
   * Refreshes the app's business data from the server (App.tsx handler).
   * When absent, the refresh button falls back to returning to the Dashboard.
   */
  onBusinessRefresh?: () => Promise<void>;
}

const DEFAULT_BIZ: BusinessAccount = {
  id: 'biz_rc_solutions',
  name: 'RC Solutions',
  industry: 'Commercial Operations & Automation',
  size: '10-50',
  services: ['HVAC Emergency', 'Automation SCADA', 'Electrical Systems', 'Multi-Agent Operations'],
  pricingApproach: 'value_based',
  brandTone: 'Professional, responsive, precise',
  painPoints: ['Manual dispatch delays', 'Off-hours emergency intake'],
  autonomyMode: 'autonomous',
  dollarThreshold: 1500,
  activeEmployees: {},
  onboardingCompleted: true,
  starterDrafts: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  business: propBusiness,
  onClose,
  senderEmail = '',
  senderName = '',
  onBusinessRefresh
}) => {
  const business = propBusiness || DEFAULT_BIZ;
  const threadKey = `rcos_chat_${business.id}`;

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    const saved = localStorage.getItem(threadKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `Hello! I'm Morgan Vance, your Executive Assistant for ${business.name}. I coordinate your operational team, enforce safety boundaries, and assist with any day-to-day task. How can I help direct operations today?`,
        timestamp: timeNow(),
        modelUsed: 'gemini-3.8-flash',
        roleId: 'executive_assistant'
      }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('executive_assistant');
  const [modelTier, setModelTier] = useState<'fast' | 'general' | 'complex'>('general');
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [appRefreshBusy, setAppRefreshBusy] = useState(false);
  const [cardValues, setCardValues] = useState<Record<string, Record<string, string>>>({});
  const [cardBusy, setCardBusy] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(threadKey, JSON.stringify(messages));
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, threadKey]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (text: string) => {
    setRefreshNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setRefreshNotice(null), 3000);
  };

  const activeEmployee = AI_EMPLOYEES.find(e => e.id === selectedRole) || AI_EMPLOYEES[0];
  const activeColors = agentColorSet(activeEmployee.id);

  const cardFieldValues = (msg: ChatMessageItem): Record<string, string> => {
    if (!msg.actionCard) return {};
    const stored = cardValues[msg.id] || {};
    const out: Record<string, string> = {};
    for (const f of msg.actionCard.draft.fields) out[f.key] = stored[f.key] ?? f.value;
    return out;
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessageItem = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: timeNow()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customText) setInput('');

    // Actions first: a supported request becomes a confirmation card, and
    // NOTHING is executed until the user taps Confirm on that card.
    const draft = detectChatAction(textToSend.trim());
    if (draft) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: `Here's exactly what I'll do. Check it, fix anything that's wrong, then tap Confirm — nothing happens until you do.`,
          timestamp: timeNow(),
          roleId: selectedRole,
          actionCard: { draft, status: 'pending' }
        }
      ]);
      return;
    }

    setLoading(true);
    try {
      // Send the active agent's own Behavior & Decision Protocol so the
      // server builds this agent's prompt with it (missing custom value
      // resolves to the standard protocol).
      const customized = employeeCustomizationService.getEmployees(business.id).find(e => e.id === selectedRole);
      const data = await apiFetch<any>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          roleId: selectedRole,
          modelTier,
          businessId: business.id,
          behaviorProtocol: resolveBehaviorProtocol(customized?.behaviorProtocol)
        })
      });

      if (data?.content) {
        const assistantMsg: ChatMessageItem = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: data.content,
          timestamp: timeNow(),
          modelUsed: data.modelUsed,
          roleId: data.roleId || selectedRole
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error('Empty response');
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Operational task processed. Sub-agents and field dispatch records remain synchronized.',
          timestamp: timeNow(),
          roleId: selectedRole
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCard = async (msg: ChatMessageItem) => {
    if (!msg.actionCard || msg.actionCard.status !== 'pending' || cardBusy[msg.id]) return;
    setCardBusy(prev => ({ ...prev, [msg.id]: true }));
    const draft = msg.actionCard.draft;
    setMessages(prev => prev.map(m =>
      m.id === msg.id && m.actionCard ? { ...m, actionCard: { ...m.actionCard, status: 'confirmed' as ActionCardStatus } } : m
    ));
    const result = await executeChatAction(business.id, draft, cardFieldValues(msg), {
      email: senderEmail,
      name: senderName
    });
    setMessages(prev => {
      const updated = prev.map(m =>
        m.id === msg.id && m.actionCard
          ? { ...m, actionCard: { ...m.actionCard, status: result.ok ? 'done' as ActionCardStatus : 'failed' as ActionCardStatus, result: result.summary, recordId: result.recordId } }
          : m
      );
      // The result message reports ONLY what the call actually returned.
      const where =
        draft.kind === 'customer_request' ? ' Find it under Customer Requests.'
        : draft.kind === 'team_message' ? ' Find it in Team Chat.'
        : draft.kind === 'job' ? ' Find it on the Jobs list.'
        : draft.kind === 'quote' ? ' Find it in Approvals.'
        : '';
      return [
        ...updated,
        {
          id: `msg_${Date.now() + 2}`,
          role: 'assistant' as const,
          content: result.ok
            ? `${result.summary}${result.recordId ? ` (Record: ${result.recordId})` : ''}${where}`
            : result.summary,
          timestamp: timeNow(),
          roleId: selectedRole
        }
      ];
    });
    setCardBusy(prev => ({ ...prev, [msg.id]: false }));
  };

  const handleCancelCard = (msg: ChatMessageItem) => {
    if (!msg.actionCard || msg.actionCard.status !== 'pending') return;
    setMessages(prev => prev.map(m =>
      m.id === msg.id && m.actionCard ? { ...m, actionCard: { ...m.actionCard, status: 'cancelled' as ActionCardStatus } } : m
    ));
  };

  const handleClearHistory = () => {
    localStorage.removeItem(threadKey);
    setMessages([
      {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Session refreshed. I'm ${activeEmployee.name} (${activeEmployee.roleTitle}). How can I assist with your ${business.name} operations?`,
        timestamp: timeNow(),
        roleId: selectedRole
      }
    ]);
  };

  /** Re-reads the saved thread and re-renders it. Never wipes history — that is what Clear is for. */
  const handleRefreshThread = () => {
    const saved = localStorage.getItem(threadKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      } catch (e) {
        // Keep the on-screen thread if the saved copy is unreadable.
      }
    }
    showNotice('Thread refreshed');
  };

  /** Re-fetches the business from the server via App, or falls back to the Dashboard. */
  const handleRefreshAppData = async () => {
    if (!onBusinessRefresh) {
      onClose?.();
      return;
    }
    setAppRefreshBusy(true);
    try {
      await onBusinessRefresh();
      showNotice('App data refreshed from the server');
    } catch {
      showNotice('App data refresh did not complete — showing what was already loaded');
    } finally {
      setAppRefreshBusy(false);
    }
  };

  const quickPrompts = [
    { label: 'Audit pricing', text: 'Audit our standard service pricing and check if margins are aligned.' },
    { label: 'Follow-up template', text: 'Draft a polite post-service follow-up requesting feedback.' },
    { label: 'Safety checklist', text: 'List mandatory safety pre-check requirements for technician dispatches.' },
    { label: 'Automate invoices', text: 'Recommend an automated workflow for invoices unpaid after 7 days.' },
    { label: 'Create a request', text: 'Create a customer request' },
    { label: 'Create a quote', text: 'Create a quote' },
    { label: 'Message the team', text: 'Send a team message' }
  ];

  // Render-time agent-change dividers: history never reads as one voice.
  let lastAssistantRole: string | null = null;

  return (
    <div className="space-y-3.5 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden text-left">

      {/* Row 1 — WHO you're talking to: banner + full agent picker */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${activeColors.avatar}`}>
            {getEmployeeIcon(activeEmployee.avatarIcon, 'w-6 h-6')}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white text-base truncate">{activeEmployee.name}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-900 text-zinc-200 border border-zinc-700 shrink-0">
                {activeEmployee.roleTitle}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">{activeEmployee.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs font-bold text-zinc-400 mr-1 shrink-0">Talk to:</span>
          {AI_EMPLOYEES.map((emp) => {
            const colors = agentColorSet(emp.id);
            const selected = emp.id === selectedRole;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelectedRole(emp.id)}
                title={`${emp.name} — ${emp.roleTitle}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs whitespace-nowrap transition cursor-pointer shrink-0 ${
                  selected
                    ? 'bg-lime-500 text-black font-bold border-lime-500'
                    : `bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-zinc-600`
                }`}
              >
                <span className={selected ? 'text-black' : colors.label}>
                  {getEmployeeIcon(emp.avatarIcon, 'w-3.5 h-3.5')}
                </span>
                {emp.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2 — THREAD controls: model tier, refresh, clear, close */}
      <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center gap-1.5 shadow-xl">
        <div className="flex items-center bg-black border border-zinc-800 rounded-xl p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setModelTier('fast')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              modelTier === 'fast' ? 'bg-lime-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Fast operational responses"
          >
            <Zap className="w-3 h-3" />
            <span>Fast</span>
          </button>
          <button
            type="button"
            onClick={() => setModelTier('general')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              modelTier === 'general' ? 'bg-lime-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
            title="General operational management"
          >
            <Cpu className="w-3 h-3" />
            <span>General</span>
          </button>
          <button
            type="button"
            onClick={() => setModelTier('complex')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              modelTier === 'complex' ? 'bg-lime-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Complex strategic analysis"
          >
            <BrainCircuit className="w-3 h-3" />
            <span>Complex</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleRefreshThread}
          className="px-2.5 py-1.5 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          title="Re-read the saved thread (never deletes anything)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh thread</span>
        </button>

        <button
          type="button"
          onClick={handleRefreshAppData}
          disabled={appRefreshBusy}
          className="px-2.5 py-1.5 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 hover:text-white transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
          title={onBusinessRefresh ? 'Re-fetch this business from the server' : 'Return to the Dashboard for fresh data'}
        >
          {appRefreshBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>Refresh app data</span>
        </button>

        <button
          type="button"
          onClick={handleClearHistory}
          className="p-1.5 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          title="Clear chat history (deletes this thread)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Return to Dashboard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {refreshNotice && (
          <span className="text-xs font-bold text-lime-400 flex items-center gap-1 ml-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {refreshNotice}
          </span>
        )}
      </div>

      {/* Scrollable Message Thread */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-3xl p-3.5 sm:p-4 shadow-xl h-[48dvh] sm:h-[420px] overflow-y-auto flex flex-col space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const msgEmployee = AI_EMPLOYEES.find(e => e.id === msg.roleId) || activeEmployee;
          const msgColors = agentColorSet(msgEmployee.id);

          let divider: React.ReactElement | null = null;
          if (!isUser) {
            if (lastAssistantRole !== null && lastAssistantRole !== msgEmployee.id) {
              divider = (
                <div key={`${msg.id}-divider`} className="flex items-center gap-2 py-1">
                  <span className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs font-bold text-zinc-400">Now speaking with {msgEmployee.name}</span>
                  <span className="flex-1 h-px bg-zinc-800" />
                </div>
              );
            }
            lastAssistantRole = msgEmployee.id;
          }

          return (
            <React.Fragment key={msg.id}>
              {divider}
              <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isUser ? 'bg-zinc-800 text-white border-zinc-700' : msgColors.avatar
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : getEmployeeIcon(msgEmployee.avatarIcon, 'w-4 h-4')}
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 space-y-1 ${
                    isUser
                      ? 'bg-lime-500 text-black font-semibold rounded-tr-none'
                      : 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-none'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-3 text-xs ${isUser ? 'text-black/70' : 'text-zinc-400'}`}>
                    <span className={`font-bold ${isUser ? '' : msgColors.label}`}>
                      {isUser ? 'You' : `${msgEmployee.name} — ${msgEmployee.roleTitle}`}
                    </span>
                    <span className="text-[11px]">{msg.timestamp}</span>
                  </div>

                  <div className={`text-sm leading-relaxed whitespace-pre-wrap font-sans ${isUser ? 'text-black' : 'text-zinc-200'}`}>
                    {msg.content}
                  </div>

                  {!isUser && msg.modelUsed && (
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1 pt-0.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Engine: {msg.modelUsed}</span>
                    </div>
                  )}
                </div>
              </div>

              {msg.actionCard && (
                <div className="rounded-2xl border border-lime-500/40 bg-zinc-900 p-3 space-y-2 ml-11">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-sm">{msg.actionCard.draft.title}</span>
                    <span className="text-xs font-bold text-zinc-400">{msg.actionCard.status === 'pending' ? 'Waiting for your confirm' : msg.actionCard.status}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{msg.actionCard.draft.description}</p>
                  {msg.actionCard.draft.fields.map((f) => {
                    const vals = cardFieldValues(msg);
                    return (
                      <label key={f.key} className="block">
                        <span className="text-xs font-bold text-zinc-300">{f.label}</span>
                        {f.multiline ? (
                          <textarea
                            value={vals[f.key] || ''}
                            disabled={msg.actionCard!.status !== 'pending'}
                            onChange={(e) => setCardValues(prev => ({ ...prev, [msg.id]: { ...vals, [f.key]: e.target.value } }))}
                            rows={2}
                            className="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-lime-500 disabled:opacity-60"
                          />
                        ) : (
                          <input
                            type="text"
                            value={vals[f.key] || ''}
                            disabled={msg.actionCard!.status !== 'pending'}
                            onChange={(e) => setCardValues(prev => ({ ...prev, [msg.id]: { ...vals, [f.key]: e.target.value } }))}
                            className="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-lime-500 disabled:opacity-60"
                          />
                        )}
                      </label>
                    );
                  })}
                  {msg.actionCard.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmCard(msg)}
                        disabled={!!cardBusy[msg.id]}
                        className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                      >
                        {cardBusy[msg.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirm — do it
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelCard(msg)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                  {msg.actionCard.result && (
                    <p className={`text-xs font-bold ${msg.actionCard.status === 'done' ? 'text-lime-400' : 'text-red-400'}`}>
                      {msg.actionCard.result}
                      {msg.actionCard.recordId ? ` (Record: ${msg.actionCard.recordId})` : ''}
                    </p>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${activeColors.avatar}`}>
              {getEmployeeIcon(activeEmployee.avatarIcon, 'w-4 h-4')}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-none p-3 flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-400" />
              <span>{activeEmployee.name} is formulating operational response...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-xs font-bold text-zinc-500 mr-0.5 shrink-0">Prompt:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p.text)}
            className="px-2.5 py-1 rounded-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white whitespace-nowrap transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-2 shadow-xl">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Ask ${activeEmployee.name} to do something, or ask a question...`}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={!input.trim() || loading}
          onClick={() => handleSend()}
          className="px-4 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-md shadow-lime-500/20 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

    </div>
  );
};
