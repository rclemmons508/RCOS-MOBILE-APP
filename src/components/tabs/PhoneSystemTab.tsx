import React, { useState } from 'react';
import { PhoneCall, ChatMessage, User } from '../../types';
import { 
  Phone, 
  PhoneCall as PhoneIcon, 
  PhoneIncoming, 
  Mic, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare,
  Users
} from 'lucide-react';
import { MessagesTab } from './MessagesTab';

interface PhoneSystemTabProps {
  calls: PhoneCall[];
  onSimulateCall: () => void;
  messages: ChatMessage[];
  currentUser: User | null;
  onSendMessage: (text: string) => void;
}

export const PhoneSystemTab: React.FC<PhoneSystemTabProps> = ({ 
  calls, 
  onSimulateCall, 
  messages, 
  currentUser, 
  onSendMessage 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'phone' | 'comms'>('phone');
  const [expandedCallId, setExpandedCallId] = useState<string | null>('call-101');
  const [simulatedSpeech, setSimulatedSpeech] = useState('');
  const [callerName, setCallerName] = useState('Metro Commercial Facilities');
  const [topic, setTopic] = useState('HVAC & Security Maintenance');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleRunLiveSimulation = async () => {
    if (!simulatedSpeech.trim() && !topic) return;
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const response = await fetch('/api/phone/simulate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeech: simulatedSpeech || 'We have a critical electrical breaker tripping in our main warehouse.',
          callerName,
          callerTopic: topic
        })
      });
      const data = await response.json();
      setSimulationResult(data);
    } catch {
      setSimulationResult({
        aiResponse: 'Thank you for calling RC Solutions. I have logged your urgent service request and dispatched a certified field specialist.',
        suggestedAction: 'Dispatched Emergency Tech',
        sentiment: 'urgent'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const defaultUser: User = currentUser || {
    id: 'usr-guest',
    fullName: 'Operations Operator',
    email: 'ops@rcsolutions.com',
    role: 'Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    organization: 'RC Solutions',
    authenticated: true
  };

  return (
    <div className="flex flex-col w-full max-w-full overflow-hidden">
      {/* Sub-navigation Switcher */}
      <div className="px-3 sm:px-4 pt-1.5 pb-2 border-b border-zinc-800 shrink-0 bg-black">
        <div className="flex bg-zinc-950 border border-zinc-800/80 rounded-2xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('phone')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'phone' 
                ? 'bg-lime-500 text-black shadow-md shadow-lime-500/20' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Voice AI Inbound</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('comms')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'comms' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Team Radio</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'phone' ? (
        <div className="space-y-4 pb-12 px-3 sm:px-4 pt-3 max-w-full overflow-x-hidden">
          {/* Header Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    RCOS Voice AI Phone System
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-semibold font-mono">
                      24/7 Active
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">RC Solutions Automated Inbound IVR & Dispatch</p>
                </div>
              </div>
            </div>

            {/* Call Telemetry Row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900 text-center font-mono">
              <div className="p-1">
                <div className="text-base sm:text-lg font-black text-white">{calls.length}</div>
                <div className="text-[10px] text-zinc-400">Calls Handled</div>
              </div>
              <div className="p-1">
                <div className="text-base sm:text-lg font-black text-lime-400">99.4%</div>
                <div className="text-[10px] text-zinc-400">IVR Accuracy</div>
              </div>
              <div className="p-1">
                <div className="text-base sm:text-lg font-black text-blue-400">&lt; 1.2s</div>
                <div className="text-[10px] text-zinc-400">Avg Answer</div>
              </div>
            </div>
          </div>

          {/* Interactive Voice AI Call Simulator */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-blue-500/30 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Mic className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>Simulate Inbound Business Call</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Gemini Voice AI Engine</span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="Caller Name / Company"
                  className="bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Service Inquiry / Emergency Topic"
                  className="bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <textarea
                value={simulatedSpeech}
                onChange={(e) => setSimulatedSpeech(e.target.value)}
                placeholder="Type what the caller says (e.g., 'Our server room AC stopped and temperature is rising rapidly!')..."
                className="w-full h-16 bg-black border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">Automated Voice Synthesis & Ticket Routing</span>
                </div>
                <button
                  type="button"
                  onClick={handleRunLiveSimulation}
                  disabled={isSimulating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shrink-0"
                >
                  {isSimulating ? (
                    <span>Processing Call...</span>
                  ) : (
                    <>
                      <PhoneIncoming className="w-3.5 h-3.5" />
                      <span>Simulate Call</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulation Response Output Card */}
            {simulationResult && (
              <div className="p-3 rounded-2xl bg-black border border-lime-500/40 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-lime-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>RCOS Voice Assistant:</span>
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-mono font-bold">
                    {simulationResult.sentiment || 'Urgent'}
                  </span>
                </div>
                <p className="text-xs text-zinc-200 italic bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 leading-relaxed font-sans">
                  "{simulationResult.aiResponse}"
                </p>
                <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-900">
                  <span>Action: <strong className="text-white">{simulationResult.suggestedAction}</strong></span>
                  <span className="text-lime-400 font-semibold font-mono">✓ Dispatched</span>
                </div>
              </div>
            )}
          </div>

          {/* Inbound Call Transcripts Log */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider px-1">
              Call Log & Live Transcripts
            </h3>
            {calls.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <PhoneIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-300">No calls in log yet</div>
                <p className="text-xs text-zinc-500">Run a simulated call above or connect your business VoIP trunk.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {calls.map((call) => {
                const isExpanded = expandedCallId === call.id;
                return (
                  <div
                    key={call.id}
                    className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden transition-all hover:border-zinc-700"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                      className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-zinc-900 text-blue-400 border border-zinc-800 shrink-0">
                          <PhoneIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{call.callerName}</span>
                            {call.sentiment === 'urgent' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/30 font-bold uppercase font-mono shrink-0">
                                URGENT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono truncate">
                            {call.callerNumber} • {call.duration}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono">{call.timestamp}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Transcript Details */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-zinc-900 bg-black/60 space-y-3">
                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                            AI Call Summary
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60 font-sans">
                            {call.summary}
                          </p>
                        </div>

                        {call.transcript && (
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                              Full Audio Transcript
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {call.transcript.map((line, idx) => (
                                <div key={idx} className="text-[11px] flex items-start gap-2">
                                  <span className={`font-mono text-[10px] font-bold shrink-0 ${line.speaker.includes('AI') ? 'text-lime-400' : 'text-blue-400'}`}>
                                    [{line.speaker}]:
                                  </span>
                                  <span className="text-zinc-300">{line.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {call.actionRequired && (
                          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-xs text-lime-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <div>
                              <strong className="text-white">RCOS Action Triggered: </strong>
                              <span>{call.actionRequired}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100dvh-130px)] flex flex-col overflow-hidden relative">
          <MessagesTab
            messages={messages}
            currentUser={defaultUser}
            onSendMessage={onSendMessage}
          />
        </div>
      )}
    </div>
  );
};
