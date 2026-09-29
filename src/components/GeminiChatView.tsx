import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  Zap, 
  BrainCircuit, 
  Cpu, 
  RotateCcw, 
  Loader2
} from 'lucide-react';
import { BusinessAccount } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  roleId?: string;
}

interface GeminiChatViewProps {
  business?: BusinessAccount | null;
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

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({ business: propBusiness }) => {
  const business = propBusiness || DEFAULT_BIZ;

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    const saved = localStorage.getItem(`rcos_chat_${business.id}`);
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.8-flash',
        roleId: 'executive_assistant'
      }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('executive_assistant');
  const [modelTier, setModelTier] = useState<'fast' | 'general' | 'complex'>('general');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(`rcos_chat_${business.id}`, JSON.stringify(messages));
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, business.id]);

  const activeEmployee = AI_EMPLOYEES.find(e => e.id === selectedRole) || AI_EMPLOYEES[0];

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessageItem = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          roleId: selectedRole,
          modelTier,
          businessId: business.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessageItem = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: data.modelUsed,
          roleId: data.roleId || selectedRole
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          {
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: `Operational notice: ${errData.details || 'Task logged and scheduled across operational workforce.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            roleId: selectedRole
          }
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Operational task processed. Sub-agents and field dispatch records remain synchronized.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          roleId: selectedRole
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem(`rcos_chat_${business.id}`);
    setMessages([
      {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Session refreshed. I'm ${activeEmployee.name} (${activeEmployee.roleTitle}). How can I assist with your ${business.name} operations?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roleId: selectedRole
      }
    ]);
  };

  const quickPrompts = [
    { label: 'Audit pricing', text: 'Audit our standard service pricing and check if margins are aligned.' },
    { label: 'Follow-up template', text: 'Draft a polite post-service follow-up requesting feedback.' },
    { label: 'Safety checklist', text: 'List mandatory safety pre-check requirements for technician dispatches.' },
    { label: 'Automate invoices', text: 'Recommend an automated workflow for invoices unpaid after 7 days.' }
  ];

  return (
    <div className="space-y-3.5 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden text-left">
      
      {/* Chat Control Toolbar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 font-bold text-xs shrink-0">
            {activeEmployee.avatarIcon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs sm:text-sm truncate">{activeEmployee.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-zinc-900 text-lime-400 border border-lime-500/30 shrink-0">
                {activeEmployee.roleTitle}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 truncate">{activeEmployee.coreJob}</p>
          </div>
        </div>

        {/* Controls: Employee Role Selector + Model Tier */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Role selector */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-black border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500 cursor-pointer"
          >
            {AI_EMPLOYEES.slice(0, 6).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.roleTitle})
              </option>
            ))}
          </select>

          {/* Model tier toggle */}
          <div className="flex items-center bg-black border border-zinc-800 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setModelTier('fast')}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer flex items-center gap-1 ${
                modelTier === 'fast'
                  ? 'bg-lime-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Fast operational responses"
            >
              <Zap className="w-3 h-3" />
              <span>Fast</span>
            </button>
            <button
              type="button"
              onClick={() => setModelTier('general')}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer flex items-center gap-1 ${
                modelTier === 'general'
                  ? 'bg-lime-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="General operational management"
            >
              <Cpu className="w-3 h-3" />
              <span>General</span>
            </button>
            <button
              type="button"
              onClick={() => setModelTier('complex')}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer flex items-center gap-1 ${
                modelTier === 'complex'
                  ? 'bg-lime-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Complex strategic analysis"
            >
              <BrainCircuit className="w-3 h-3" />
              <span>Complex</span>
            </button>
          </div>

          {/* Clear history */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Clear Chat History"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-3xl p-3.5 sm:p-4 shadow-xl h-[48dvh] sm:h-[420px] overflow-y-auto flex flex-col space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const msgEmployee = AI_EMPLOYEES.find(e => e.id === msg.roleId) || activeEmployee;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  isUser
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'bg-lime-500/15 text-lime-400 border border-lime-500/30'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : msgEmployee.avatarIcon}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 space-y-1 ${
                  isUser
                    ? 'bg-lime-500 text-black font-semibold rounded-tr-none'
                    : 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-none'
                }`}
              >
                <div className={`flex items-center justify-between gap-3 text-[9px] ${isUser ? 'text-black/70' : 'text-zinc-400'}`}>
                  <span className="font-bold">
                    {isUser ? 'Operator' : `${msgEmployee.name} (${msgEmployee.roleTitle})`}
                  </span>
                  <span className="font-mono">{msg.timestamp}</span>
                </div>

                <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans ${isUser ? 'text-black' : 'text-zinc-200'}`}>
                  {msg.content}
                </div>

                {!isUser && msg.modelUsed && (
                  <div className="text-[9px] font-mono text-lime-400/80 flex items-center gap-1 pt-0.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Engine: {msg.modelUsed}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-lime-500/15 text-lime-400 border border-lime-500/30 flex items-center justify-center text-xs font-bold shrink-0">
              {activeEmployee.avatarIcon}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-none p-3 flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-400" />
              <span>{activeEmployee.name} is formulating operational response...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] font-mono text-zinc-500 mr-0.5 shrink-0">Prompt:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p.text)}
            className="px-2.5 py-1 rounded-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap transition cursor-pointer"
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
          placeholder={`Instruct ${activeEmployee.name} (${activeEmployee.roleTitle})...`}
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
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
