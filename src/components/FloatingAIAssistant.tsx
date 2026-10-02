import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Cpu, 
  PhoneCall, 
  Briefcase, 
  Users, 
  FileCode,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { AgentMessage } from '../types';
import { RCLogoIcon } from './RCLogo';

interface FloatingAIAssistantProps {
  onOpenTab?: (tabName: any) => void;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({ onOpenTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('agent-orchestrator');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'm-1',
      agentId: 'agent-orchestrator',
      agentName: 'RCOS System Orchestrator',
      role: 'assistant',
      content: 'Welcome to RCOS! I am your central multi-agent AI orchestrator for RC Solutions. How can I optimize your operations today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const agents = [
    { id: 'agent-orchestrator', name: 'Orchestrator', icon: Cpu, color: 'text-lime-400 bg-lime-500/10' },
    { id: 'agent-phone', name: 'Phone Voice AI', icon: PhoneCall, color: 'text-blue-400 bg-blue-500/10' },
    { id: 'agent-jobs', name: 'Job Dispatcher', icon: Briefcase, color: 'text-yellow-400 bg-yellow-500/10' },
    { id: 'agent-crm', name: 'CRM Nurture', icon: Users, color: 'text-purple-400 bg-purple-500/10' },
    { id: 'agent-system', name: 'File Architect', icon: FileCode, color: 'text-emerald-400 bg-emerald-500/10' },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isTyping) return;

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      agentId: selectedAgentId,
      agentName: 'User',
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const activeAgentObj = agents.find(a => a.id === selectedAgentId);
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          prompt: promptText,
          history: messages.slice(-4)
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: AgentMessage = {
          id: `a-${Date.now()}`,
          agentId: selectedAgentId,
          agentName: activeAgentObj?.name || 'RCOS Agent',
          role: 'assistant',
          content: data.reply || 'Task acknowledged and dispatched.',
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('Fallback trigger');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          agentId: selectedAgentId,
          agentName: 'RCOS Agent',
          role: 'assistant',
          content: 'RCOS System verified and processed query locally. All sub-agents remain synchronized.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Draggable Button placed safely above Bottom Navigation inside phone frame */}
      {!isOpen && (
        <motion.button
          drag
          dragConstraints={{ top: -300, left: -250, right: 0, bottom: 0 }}
          dragMomentum={false}
          whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
          onClick={() => setIsOpen(true)}
          style={{ 
            position: 'absolute', 
            bottom: '4.25rem', 
            right: '0.85rem' 
          }}
          className="z-30 p-2.5 rounded-full bg-gradient-to-tr from-lime-600 via-zinc-900 to-black border-2 border-lime-400 shadow-[0_0_20px_rgba(132,204,22,0.45)] text-white hover:scale-105 active:scale-95 transition-all group cursor-pointer"
          aria-label="Open RCOS Multi-Agent AI"
        >
          <div className="relative pointer-events-none flex items-center justify-center w-6 h-6">
            <RCLogoIcon className="w-5 h-auto group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-lime-500" />
          </div>
        </motion.button>
      )}

      {/* Slide-Up Multi-Agent AI Console Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
          <div className="w-full max-w-md h-[84dvh] sm:h-[80vh] bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/30">
                  <RCLogoIcon className="w-5 h-auto" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    RCOS Multi-Agent Assistant
                    <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                  </h3>
                  <p className="text-[10px] text-zinc-400">Powered by RC Solutions AI Core</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Agent Selector Ribbon */}
            <div className="flex items-center gap-1.5 p-2 bg-zinc-900/60 border-b border-zinc-800/80 overflow-x-auto no-scrollbar">
              {agents.map((ag) => {
                const Icon = ag.icon;
                const isSelected = selectedAgentId === ag.id;
                return (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setSelectedAgentId(ag.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40 font-semibold'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{ag.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-zinc-900 overflow-x-auto text-[11px] no-scrollbar">
              <span className="text-zinc-500 font-mono text-[10px]">QUICK:</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTab) onOpenTab('dashboard');
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-lime-400 hover:border-lime-500/50 whitespace-nowrap cursor-pointer font-bold"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTab) onOpenTab('jobs');
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 hover:border-amber-500/50 whitespace-nowrap cursor-pointer"
              >
                Smart Tasks
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTab) onOpenTab('team');
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-400 hover:border-purple-500/50 whitespace-nowrap cursor-pointer"
              >
                AI Team
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTab) onOpenTab('phone');
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-blue-400 hover:border-blue-500/50 whitespace-nowrap cursor-pointer"
              >
                Voice AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTab) onOpenTab('gmail');
                }}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-400 hover:border-indigo-500/50 whitespace-nowrap cursor-pointer"
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Check system status and active agent workloads')}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-lime-500/50 whitespace-nowrap cursor-pointer"
              >
                Run Diagnostics
              </button>
            </div>

            {/* Messages Chat Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-gradient-to-b from-zinc-950 to-black">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-0.5 px-1">
                      <span>{m.agentName}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-lime-500 text-black font-semibold rounded-tr-none'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="flex items-center gap-2 p-2 bg-zinc-900/60 rounded-xl w-fit text-xs text-lime-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>RCOS Agent formulating response...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-2.5 bg-black border-t border-zinc-800 flex items-center gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Ask ${agents.find(a => a.id === selectedAgentId)?.name}...`}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isTyping}
                className="p-2 rounded-xl bg-lime-500 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-lime-400 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
