import React, { useState, useEffect } from 'react';
import { PhoneCall, ChatMessage, User, VoicemailRecord, TelephonyConfig } from '../../types';
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
  Users,
  Radio,
  FileText,
  Mail,
  PhoneForwarded,
  Sliders,
  History,
  AlertTriangle,
  Settings,
  ShieldCheck,
  Send,
  ExternalLink,
  Play
} from 'lucide-react';
import { MessagesTab } from './MessagesTab';
import { LiveCallConsole } from '../phone/LiveCallConsole';
import { IncomingCallModal } from '../phone/IncomingCallModal';
import { VoicemailsView } from '../phone/VoicemailsView';
import { RealPhoneSetupModal } from '../phone/RealPhoneSetupModal';

interface PhoneSystemTabProps {
  calls: PhoneCall[];
  onSimulateCall: () => void;
  messages: ChatMessage[];
  currentUser: User | null;
  onSendMessage: (text: string) => void;
  onNavigateTab?: (tab: any) => void;
  onTriggerNotification?: (title: string, message: string) => void;
}

const PRESET_SCENARIOS = [
  {
    id: 'sc-1',
    label: '⚡ Emergency Chiller Breakdown',
    callerName: 'Apex Tower Facilities (Marcus Vance)',
    callerNumber: '+1 (555) 392-8811',
    topic: 'Critical Rooftop Chiller Failure',
    speech: 'Our main cooling tower chiller pump failed! Water temperature is climbing, please transfer me to Dispatch immediately!',
    expectedAction: 'Transfers to Dispatch & Field Operations'
  },
  {
    id: 'sc-2',
    label: '📑 Automation Retrofit Quote Request',
    callerName: 'BioHealth Labs (Dr. Angela Vance)',
    callerNumber: '+1 (555) 612-4490',
    topic: 'Cleanroom Sensor Automation Quote',
    speech: 'We need an official project quote to install smart environmental IoT sensors across 4 laboratories. Scope estimate is around $3,400.',
    expectedAction: 'Creates Quote Approval in Ledger'
  },
  {
    id: 'sc-3',
    label: '🎙️ Leave Voicemail for Billing',
    callerName: 'Sterling Logistics (David Sterling)',
    callerNumber: '+1 (555) 741-2290',
    topic: 'Invoice #RC-8810 Clarification',
    speech: 'I need to leave a message for Elena in billing regarding invoice 8810 payment schedule.',
    expectedAction: 'Transcribes & Saves Voicemail'
  },
  {
    id: 'sc-4',
    label: '✉️ Send Confirmation Email',
    callerName: 'Summit Plaza Operations',
    callerNumber: '+1 (555) 902-3310',
    topic: 'Quarterly Maintenance Schedule',
    speech: 'Can you please email me a formal confirmation of our scheduled electrical inspection for tomorrow morning?',
    expectedAction: 'Dispatches Outbound Email Task'
  }
];

const DEFAULT_VOICEMAILS: VoicemailRecord[] = [
  {
    id: 'vm-201',
    callerName: 'Robert Thorne (Metro Commercial)',
    callerNumber: '+1 (555) 201-9944',
    company: 'Metro Commercial Real Estate',
    timestamp: '25 mins ago',
    duration: '0m 42s',
    transcription: 'Hi RC Solutions team, this is Robert from Metro Commercial. We have three rooftop HVAC units at the Westside complex that are due for quarterly diagnostic sensor calibration. Could you provide a formal quote for the maintenance contract? Thank you.',
    summary: 'Inquired about quarterly sensor calibration and quote for 3 rooftop HVAC units.',
    urgency: 'high',
    department: 'Billing & Invoicing',
    reviewed: false
  },
  {
    id: 'vm-202',
    callerName: 'Evelyn Reed (Oakmont Labs)',
    callerNumber: '+1 (555) 883-1120',
    company: 'Oakmont Biologics',
    timestamp: '2 hours ago',
    duration: '0m 31s',
    transcription: 'Hello, calling for Dave Miller in Emergency Maintenance. The secondary backup generator switchgear showed an alert code E-42 during routine self-test. Please give us a callback when free.',
    summary: 'Generator switchgear alert E-42 report for Dave Miller.',
    urgency: 'urgent',
    department: 'Emergency Mechanical & Electrical',
    reviewed: true
  }
];

export const PhoneSystemTab: React.FC<PhoneSystemTabProps> = ({ 
  calls: propCalls, 
  onSimulateCall, 
  messages, 
  currentUser, 
  onSendMessage,
  onNavigateTab,
  onTriggerNotification
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'phone' | 'voicemails' | 'comms'>('phone');
  const [answeringMode, setAnsweringMode] = useState<'ai' | 'manual'>('ai');
  const [callsList, setCallsList] = useState<PhoneCall[]>(propCalls);
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>(DEFAULT_VOICEMAILS);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  // PBX & Real Phone System state
  const [telephonyConfig, setTelephonyConfig] = useState<TelephonyConfig | null>(null);
  const [isPbxModalOpen, setIsPbxModalOpen] = useState(false);

  // Active Live Call state
  const [activeLiveCall, setActiveLiveCall] = useState<PhoneCall | null>(null);

  // Incoming Ringing Call state
  const [incomingCall, setIncomingCall] = useState<{
    callerName: string;
    callerNumber: string;
    callerTopic: string;
    initialSpeech?: string;
  } | null>(null);

  // Manual simulator form fields
  const [customName, setCustomName] = useState('Metro Commercial Facilities');
  const [customPhone, setCustomPhone] = useState('+1 (555) 492-7721');
  const [customTopic, setCustomTopic] = useState('HVAC & Electrical Maintenance');
  const [customSpeech, setCustomSpeech] = useState('');

  // Fetch telephony configuration on mount
  useEffect(() => {
    fetch('/api/twilio/config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTelephonyConfig(data);
          if (data.answeringStrategy === 'human_first') {
            setAnsweringMode('manual');
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch voicemails & calls on mount + poll periodically for real PSTN calls
  useEffect(() => {
    const fetchRealData = () => {
      fetch('/api/phone/voicemails')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setVoicemails(data);
          }
        })
        .catch(() => {});

      fetch('/api/phone/calls')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setCallsList(prev => {
              // Combine and dedup
              const map = new Map<string, PhoneCall>();
              data.forEach(c => map.set(c.id, c));
              prev.forEach(c => {
                if (!map.has(c.id)) map.set(c.id, c);
              });
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});
    };

    fetchRealData();
    const interval = setInterval(fetchRealData, 6000);
    return () => clearInterval(interval);
  }, []);

  // Sync propCalls if updated from outside
  useEffect(() => {
    if (propCalls.length > callsList.length) {
      setCallsList(propCalls);
    }
  }, [propCalls]);

  const defaultUser: User = currentUser || {
    id: 'usr-guest',
    fullName: 'Operations Operator',
    email: 'ops@rcsolutions.com',
    role: 'Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    organization: 'RC Solutions',
    authenticated: true
  };

  // Save Telephony Configuration
  const handleSaveTelephonyConfig = async (updated: Partial<TelephonyConfig>) => {
    const res = await fetch('/api/twilio/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    const data = await res.json();
    if (data.config) {
      setTelephonyConfig(data.config);
      if (data.config.answeringStrategy === 'human_first') {
        setAnsweringMode('manual');
      } else {
        setAnsweringMode('ai');
      }
    }
  };

  // Trigger Inbound Call
  const handleTriggerIncomingCall = (
    name = customName, 
    phone = customPhone, 
    topic = customTopic, 
    speech = customSpeech
  ) => {
    setIncomingCall({
      callerName: name || 'Inbound Commercial Client',
      callerNumber: phone || '+1 (555) 019-4820',
      callerTopic: topic || 'Facility Service Inquiry',
      initialSpeech: speech
    });
  };

  // Answer as AI Receptionist
  const handleAnswerAsAI = () => {
    if (!incomingCall) return;
    const newCall: PhoneCall = {
      id: `call_${Date.now()}`,
      callerName: incomingCall.callerName,
      callerNumber: incomingCall.callerNumber,
      type: 'inbound',
      status: 'active',
      timestamp: 'Just now',
      duration: '0m 01s',
      answeredBy: 'ai_receptionist',
      summary: `Inbound inquiry regarding ${incomingCall.callerTopic}. Handled by Voice Receptionist Kore.`,
      transcript: [
        {
          speaker: 'RCOS AI',
          text: `Thank you for calling RC Solutions! My name is Kore, your voice concierge. How may I assist you or direct your call today?`,
          time: '00:01'
        },
        ...(incomingCall.initialSpeech ? [{
          speaker: 'Caller',
          text: incomingCall.initialSpeech,
          time: '00:04'
        }] : [])
      ]
    };

    setIncomingCall(null);
    setActiveLiveCall(newCall);
  };

  // Answer as Human Operator
  const handleAnswerAsHuman = () => {
    if (!incomingCall) return;
    const newCall: PhoneCall = {
      id: `call_${Date.now()}`,
      callerName: incomingCall.callerName,
      callerNumber: incomingCall.callerNumber,
      type: 'inbound',
      status: 'active',
      timestamp: 'Just now',
      duration: '0m 01s',
      answeredBy: 'human_operator',
      summary: `Inbound inquiry regarding ${incomingCall.callerTopic}. Answered directly by live human operator.`,
      transcript: [
        {
          speaker: 'Human Operator',
          text: `Hello, this is ${defaultUser.fullName} at RC Solutions. How can I assist you today?`,
          time: '00:01'
        },
        ...(incomingCall.initialSpeech ? [{
          speaker: 'Caller',
          text: incomingCall.initialSpeech,
          time: '00:04'
        }] : [])
      ]
    };

    setIncomingCall(null);
    setActiveLiveCall(newCall);
  };

  // End Call Callback
  const handleEndLiveCall = (finalCall: PhoneCall) => {
    setActiveLiveCall(null);
    setCallsList(prev => [finalCall, ...prev]);

    // Persist to server
    fetch('/api/phone/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalCall)
    }).catch(() => {});

    // Sync voicemails
    fetch('/api/phone/voicemails')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setVoicemails(data);
      })
      .catch(() => {});
  };

  const handleDeleteVoicemail = async (id: string) => {
    try {
      await fetch(`/api/phone/voicemails/${id}`, { method: 'DELETE' });
    } catch {}
    setVoicemails(prev => prev.filter(v => v.id !== id));
  };

  const handleToggleReviewed = (id: string) => {
    setVoicemails(prev => prev.map(v => v.id === id ? { ...v, reviewed: !v.reviewed } : v));
  };

  const unreviewedVoicemailCount = voicemails.filter(v => !v.reviewed).length;
  const carrierPhoneNumber = telephonyConfig?.phoneNumber || '+1 (800) 555-7267';
  const hasRealTwilio = telephonyConfig?.accountSidConfigured && telephonyConfig?.authTokenConfigured;

  return (
    <div className="flex flex-col w-full max-w-full overflow-hidden">
      {/* Sub-navigation Switcher */}
      <div className="px-3 sm:px-4 pt-1.5 pb-2 border-b border-zinc-800 shrink-0 bg-black">
        <div className="flex bg-zinc-950 border border-zinc-800/80 rounded-2xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'phone' 
                ? 'bg-lime-500 text-black shadow-md shadow-lime-500/20' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Voice Receptionist</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('voicemails')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeSubTab === 'voicemails' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voicemails</span>
            {unreviewedVoicemailCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreviewedVoicemailCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('comms')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

      {activeSubTab === 'phone' && (
        <div className="space-y-4 pb-12 px-3 sm:px-4 pt-3 max-w-full overflow-x-hidden">
          {/* Active Live Call Console (If In Call) */}
          {activeLiveCall ? (
            <LiveCallConsole
              activeCall={activeLiveCall}
              onEndCall={handleEndLiveCall}
              onUpdateCall={(updated) => setActiveLiveCall(updated)}
              onTriggerNotification={onTriggerNotification}
            />
          ) : (
            <>
              {/* Real Telecom PSTN Live Carrier Bar */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-lime-500/30 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping absolute inset-0" />
                    <div className="w-2.5 h-2.5 rounded-full bg-lime-400 relative" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white">
                        Carrier Line: <span className="text-lime-400">{carrierPhoneNumber}</span>
                      </span>
                      <span className={`text-[9px] px-2 py-0.2 rounded-full font-mono font-bold uppercase ${
                        hasRealTwilio 
                          ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40' 
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {hasRealTwilio ? 'Twilio PSTN Live' : 'Carrier Gateway Ready'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Routing: <strong className="text-zinc-200">{telephonyConfig?.answeringStrategy === 'human_first' ? 'Human First (15s Failover)' : 'AI Receptionist First (24/7)'}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPbxModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-lime-400" />
                    <span>Carrier PBX Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPbxModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-lime-500/20"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                    <span>Call Real Phone</span>
                  </button>
                </div>
              </div>

              {/* Header Status & Telemetry Banner */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        RC Solutions Receptionist
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-semibold font-mono">
                          PSTN & Web
                        </span>
                      </h2>
                      <p className="text-xs text-zinc-400">Real Voice AI Concierge (Kore) & Human Line</p>
                    </div>
                  </div>

                  {/* Mode Toggle: AI Auto-Answer vs Manual Ring */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        setAnsweringMode('ai');
                        if (telephonyConfig) {
                          handleSaveTelephonyConfig({ answeringStrategy: 'ai_first' });
                        }
                      }}
                      className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                        answeringMode === 'ai' 
                          ? 'bg-purple-600 text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-purple-200" />
                      <span>AI Concierge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnsweringMode('manual');
                        if (telephonyConfig) {
                          handleSaveTelephonyConfig({ answeringStrategy: 'human_first' });
                        }
                      }}
                      className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                        answeringMode === 'manual' 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-3 h-3 text-blue-200" />
                      <span>Human Only</span>
                    </button>
                  </div>
                </div>

                {/* Call Stats Bar */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-900 text-center font-mono">
                  <div className="p-1">
                    <div className="text-sm sm:text-base font-black text-white">{callsList.length}</div>
                    <div className="text-[9.5px] text-zinc-400">Total Calls</div>
                  </div>
                  <div className="p-1">
                    <div className="text-sm sm:text-base font-black text-lime-400">99.4%</div>
                    <div className="text-[9.5px] text-zinc-400">Transcription</div>
                  </div>
                  <div className="p-1">
                    <div className="text-sm sm:text-base font-black text-purple-400">5 Depts</div>
                    <div className="text-[9.5px] text-zinc-400">PSTN Transfers</div>
                  </div>
                  <div className="p-1">
                    <div className="text-sm sm:text-base font-black text-blue-400">&lt; 1.2s</div>
                    <div className="text-[9.5px] text-zinc-400">AI Pickup</div>
                  </div>
                </div>
              </div>

              {/* Quick Scenarios Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-lime-400" />
                    <span>Quick Interactive Scenarios</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">PSTN & Web Audio</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => handleTriggerIncomingCall(
                        scenario.callerName,
                        scenario.callerNumber,
                        scenario.topic,
                        scenario.speech
                      )}
                      className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-lime-500/50 hover:bg-zinc-900 transition-all text-left cursor-pointer flex flex-col gap-1 group active:scale-98"
                    >
                      <span className="text-xs font-bold text-white group-hover:text-lime-400 transition-colors">
                        {scenario.label}
                      </span>
                      <p className="text-[10.5px] text-zinc-400 truncate">
                        "{scenario.speech}"
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[9.5px] font-mono text-zinc-500">
                        <span>Action: <strong className="text-zinc-300">{scenario.expectedAction}</strong></span>
                        <span className="text-lime-400 font-bold group-hover:translate-x-0.5 transition-transform">Ring Console →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inbound Simulator / Real Phone Dial Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800/90 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>Direct Inbound Caller Test</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">Gemini 3.8 Flash Engine</span>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Caller Name / Company"
                      className="bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="Service Topic / Department"
                      className="bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <textarea
                    value={customSpeech}
                    onChange={(e) => setCustomSpeech(e.target.value)}
                    placeholder="What the caller says (e.g., 'Can you connect me with billing?' or 'I need a quote for $1,200 compressor repair')..."
                    className="w-full h-16 bg-black border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
                  />

                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <Volume2 className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span>Answers as {answeringMode === 'ai' ? 'AI Concierge Kore' : 'Live Operator'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPbxModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-zinc-800"
                      >
                        <PhoneIcon className="w-3.5 h-3.5 text-lime-400" />
                        <span>Dial Real Phone</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerIncomingCall()}
                        className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-lime-500/20 active:scale-95 shrink-0"
                      >
                        <PhoneIncoming className="w-3.5 h-3.5" />
                        <span>Ring Operator Console</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call History & Transcripts Log */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Call Log & Transcripts (Carrier & Web)</span>
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">{callsList.length} Archived</span>
                </div>

                <div className="space-y-2">
                  {callsList.map((call) => {
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">{call.callerName}</span>
                                {call.isRealPstnCall && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-lime-500/10 text-lime-400 border border-lime-500/30">
                                    PSTN Carrier
                                  </span>
                                )}
                                {call.answeredBy && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                    call.answeredBy === 'ai_receptionist'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {call.answeredBy === 'ai_receptionist' ? 'AI Concierge' : 'Human'}
                                  </span>
                                )}
                                {call.department && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-lime-400 font-mono font-semibold">
                                    🔀 {call.department}
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
                                Call Summary
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60 font-sans">
                                {call.summary || 'Inbound call logged into RCOS communications repository.'}
                              </p>
                            </div>

                            {/* Carrier Recording link if available */}
                            {call.recordingUrl && (
                              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs">
                                <span className="text-purple-300 font-mono text-[11px] flex items-center gap-1.5">
                                  <Play className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Carrier Audio Recording Available</span>
                                </span>
                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 font-mono"
                                >
                                  <span>Listen Recording</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {call.transcript && call.transcript.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                                  Full Conversation Transcript
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {call.transcript.map((line, idx) => (
                                    <div key={idx} className="text-[11px] flex items-start gap-2">
                                      <span className={`font-mono text-[10px] font-bold shrink-0 ${
                                        line.speaker.includes('AI') 
                                          ? 'text-purple-400' 
                                          : line.speaker.includes('Human')
                                          ? 'text-blue-400'
                                          : 'text-zinc-400'
                                      }`}>
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
                                  <strong className="text-white">Action Taken: </strong>
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
              </div>
            </>
          )}
        </div>
      )}

      {/* Voicemails & Transcribed Messages Sub-Tab */}
      {activeSubTab === 'voicemails' && (
        <VoicemailsView
          voicemails={voicemails}
          onDeleteVoicemail={handleDeleteVoicemail}
          onToggleReviewed={handleToggleReviewed}
        />
      )}

      {/* Team Radio Sub-Tab */}
      {activeSubTab === 'comms' && (
        <div className="h-[calc(100dvh-130px)] flex flex-col overflow-hidden relative">
          <MessagesTab
            messages={messages}
            currentUser={defaultUser}
            onSendMessage={onSendMessage}
          />
        </div>
      )}

      {/* Incoming Call Ringing Overlay */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerName={incomingCall.callerName}
          callerNumber={incomingCall.callerNumber}
          callerTopic={incomingCall.callerTopic}
          autoAnswerMode={answeringMode}
          onAnswerAI={handleAnswerAsAI}
          onAnswerHuman={handleAnswerAsHuman}
          onDecline={() => {
            const missedCall: PhoneCall = {
              id: `call_${Date.now()}`,
              callerName: incomingCall.callerName,
              callerNumber: incomingCall.callerNumber,
              type: 'missed',
              status: 'voicemail',
              timestamp: 'Just now',
              duration: '0m 00s',
              summary: `Missed call from ${incomingCall.callerName}. Caller declined or routed to voicemail.`
            };
            setCallsList(prev => [missedCall, ...prev]);
            setIncomingCall(null);
          }}
        />
      )}

      {/* Real Phone Setup & Carrier PBX Modal */}
      <RealPhoneSetupModal
        isOpen={isPbxModalOpen}
        onClose={() => setIsPbxModalOpen(false)}
        config={telephonyConfig}
        onSaveConfig={handleSaveTelephonyConfig}
        onTriggerNotification={onTriggerNotification}
      />
    </div>
  );
};
