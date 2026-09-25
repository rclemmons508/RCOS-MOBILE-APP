import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Loader2, 
  ShieldAlert, 
  Cpu, 
  Kanban, 
  CircleDollarSign, 
  CalendarClock, 
  TrendingUp, 
  HeartHandshake, 
  Wrench, 
  Megaphone, 
  FileText, 
  BarChart3,
  Bot,
  User,
  ToggleLeft,
  ToggleRight,
  ArrowUpRight
} from 'lucide-react';
import { BusinessAccount, AIEmployee, ChatMessage } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

interface AiTeamViewProps {
  business: BusinessAccount;
  onUpdateBusiness: (updated: BusinessAccount) => void;
}

export const AiTeamView: React.FC<AiTeamViewProps> = ({
  business,
  onUpdateBusiness
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('executive_assistant');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = AI_EMPLOYEES.find(e => e.id === selectedEmployeeId) || AI_EMPLOYEES[0];
  const isActive = business.activeEmployees[selectedEmployee.id] !== false;

  // Fetch chat history for selected employee
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/business/${business.id}/chat?employeeId=${selectedEmployeeId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load chat:', err);
      }
    };
    fetchChat();
  }, [business.id, selectedEmployeeId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send chat message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      businessId: business.id,
      employeeId: selectedEmployeeId,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/business/${business.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          message: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, data.message]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle active employee
  const handleToggleEmployee = async (empId: string) => {
    const currentStatus = business.activeEmployees[empId] !== false;
    const updatedEmployees = { ...business.activeEmployees, [empId]: !currentStatus };
    const updatedBiz = { ...business, activeEmployees: updatedEmployees };

    try {
      const res = await fetch(`/api/business/${business.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeEmployees: updatedEmployees })
      });
      if (res.ok) {
        const saved = await res.json();
        onUpdateBusiness(saved);
      }
    } catch (err) {
      console.error('Failed to update employee toggle', err);
    }
  };

  const getEmployeeIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
      case 'Cpu': return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'Kanban': return <Kanban className="w-4 h-4 text-purple-400" />;
      case 'CircleDollarSign': return <CircleDollarSign className="w-4 h-4 text-amber-400" />;
      case 'Users': return <Users className="w-4 h-4 text-blue-400" />;
      case 'CalendarClock': return <CalendarClock className="w-4 h-4 text-emerald-400" />;
      case 'TrendingUp': return <TrendingUp className="w-4 h-4 text-[#00ff66]" />;
      case 'HeartHandshake': return <HeartHandshake className="w-4 h-4 text-pink-400" />;
      case 'Wrench': return <Wrench className="w-4 h-4 text-orange-400" />;
      case 'Megaphone': return <Megaphone className="w-4 h-4 text-yellow-400" />;
      case 'FileText': return <FileText className="w-4 h-4 text-slate-300" />;
      case 'BarChart3': return <BarChart3 className="w-4 h-4 text-indigo-400" />;
      default: return <Bot className="w-4 h-4 text-[#00ff66]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f2637] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>AI Employee Roster</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
              All 12 Included
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every account gets the full 12-person operational system. Toggle roles on/off or chat directly with any specialist.
          </p>
        </div>
      </div>

      {/* Main Split View: Left List of 12 Employees, Right Multi-Turn Chat & Persona */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 12 Employee Cards */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {AI_EMPLOYEES.map((emp) => {
            const isSelected = emp.id === selectedEmployeeId;
            const empActive = business.activeEmployees[emp.id] !== false;

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer text-left flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#131722] border-[#00ff66]/50 shadow-lg shadow-[#00ff66]/10'
                    : 'bg-[#0d1017] border-[#1f2638] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#171d2b] border border-[#273349] flex items-center justify-center shrink-0">
                    {getEmployeeIcon(emp.avatarIcon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs md:text-sm font-bold text-white truncate">{emp.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">({emp.department})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{emp.roleTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEmployee(emp.id);
                    }}
                    title={empActive ? 'Deactivate employee' : 'Activate employee'}
                    className="cursor-pointer"
                  >
                    {empActive ? (
                      <ToggleRight className="w-6 h-6 text-[#00ff66]" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Active Employee Details & Multi-Turn Gemini Chat Thread */}
        <div className="lg:col-span-7 flex flex-col bg-[#0e1118] border border-[#21293a] rounded-3xl overflow-hidden shadow-2xl h-[680px]">
          
          {/* Header */}
          <div className="p-4 border-b border-[#1f2638] bg-[#121622] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#181f2f] border border-[#273248] flex items-center justify-center">
                {getEmployeeIcon(selectedEmployee.avatarIcon)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{selectedEmployee.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    isActive 
                      ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isActive ? 'Active on Team' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{selectedEmployee.roleTitle} • Escalates to: {selectedEmployee.escalatesTo}</p>
              </div>
            </div>
          </div>

          {/* Persona Card / Operational Mission */}
          <div className="px-4 py-2.5 bg-[#090b0e] border-b border-[#181f2e] text-xs text-slate-300 flex items-center justify-between">
            <span>Mission: <em>{selectedEmployee.coreJob}</em></span>
            <span className="text-[10px] text-slate-500 font-mono">Gemini 3.8 Flash</span>
          </div>

          {/* Scrollable Conversation Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600" />
                <div className="text-xs font-medium text-slate-300">
                  Direct line to {selectedEmployee.name}
                </div>
                <p className="text-[11px] max-w-xs text-slate-500">
                  Ask a question, request a strategy draft, or instruct them to execute work for {business.name}.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-lg bg-[#141822] border border-[#232c3f] flex items-center justify-center shrink-0 mt-0.5">
                      {getEmployeeIcon(selectedEmployee.avatarIcon)}
                    </div>
                  )}

                  <div className={`max-w-[80%] rounded-2xl p-3 text-xs md:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#00ff66] text-[#090b0e] font-medium'
                      : 'bg-[#141822] text-slate-200 border border-[#21293a]'
                  }`}>
                    {msg.content}
                    <div className={`text-[9px] mt-1 text-right font-mono ${
                      msg.role === 'user' ? 'text-black/60' : 'text-slate-500'
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-[#1b2233] border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-white text-[10px] font-bold">
                      YOU
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-xs text-slate-400">
                <div className="w-7 h-7 rounded-lg bg-[#141822] border border-[#232c3f] flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00ff66]" />
                </div>
                <span className="italic">{selectedEmployee.name} is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-3 border-t border-[#1f2638] bg-[#121622]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                placeholder={`Message ${selectedEmployee.name}...`}
                className="flex-1 bg-[#161c2a] border border-[#273248] rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
