import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, ChatMessage, User, VoicemailRecord, BusinessAccount, Job, CustomerRequest } from '../../types';
import {
  Phone,
  PhoneCall as PhoneIcon,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  AudioWaveform,
  Mic,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MessageSquare,
  Users,
  Settings,
  ExternalLink,
  Play
} from 'lucide-react';
import { MessagesTab } from './MessagesTab';
import { LiveCallConsole } from '../phone/LiveCallConsole';
import { IncomingCallModal } from '../phone/IncomingCallModal';
import { VoicemailsView } from '../phone/VoicemailsView';
import { RealPhoneSetupModal } from '../phone/RealPhoneSetupModal';
import { VoiceCallButton } from '../phone/VoiceCallButton';
import { AiReceptionistDetail, receptionistStatus } from '../phone/AiReceptionistDetail';
import { sidebarCard } from '../ui/cards';
import { apiFetch } from '../../lib/api';
import { withBusinessId, filterToBusiness } from '../../lib/businessScope';
import { firestoreService } from '../../services/firestoreService';
import { safeHref } from '../../lib/safeOpen';

interface PhoneSystemTabProps {
  calls: PhoneCall[];
  onSimulateCall: () => void;
  messages: ChatMessage[];
  currentUser: User | null;
  businessId: string;
  /** Transfer departments this business offers — passed to the call console's transfer picker. */
  availableDepartments?: string[];
  onSendMessage: (text: string) => void;
  onNavigateTab?: (tab: any) => void;
  onTriggerNotification?: (title: string, message: string) => void;
  /** One Inbox deep-link: start on this sub-tab instead of the default. */
  initialSubTab?: 'phone' | 'voicemails' | 'comms';
  /** Server-recorded calls — the persistent record the receptionist
      detail screen's "Calls Today" counts from (same source as the
      Dashboard tiles and the WeeklyCard). */
  serverCalls?: PhoneCall[];
  /** Customer requests — the detail screen's "Leads Captured" counts
      requests created today. */
  customerRequests?: CustomerRequest[];
  /** Jobs — the detail screen's "Appts Booked" counts jobs booked today. */
  jobs?: Job[];
  /** Same server-reachability signal as the Dashboard's Online badge. */
  serverOnline?: boolean | null;
  /** Bumped by App when the Dashboard's AI Receptionist card is tapped,
      so the Calls tab opens straight on the receptionist detail screen. */
  openReceptionistSignal?: number;
  /** Opens Settings on a section (Knowledge Base lives in 'user', where
      Teach Your Team is). */
  onOpenSettingsSection?: (section: 'user' | 'agents') => void;
}

// No preset scenarios: the old Quick Scenarios box was demo content
// (fake names and 555 numbers shown as real callers). The inbound test
// lives on the AI Receptionist detail screen now, starting empty.

export const PhoneSystemTab: React.FC<PhoneSystemTabProps> = ({
  calls: propCalls,
  onSimulateCall,
  messages,
  currentUser,
  businessId,
  availableDepartments,
  onSendMessage,
  onNavigateTab,
  onTriggerNotification,
  initialSubTab,
  serverCalls = [],
  customerRequests = [],
  jobs = [],
  serverOnline = null,
  openReceptionistSignal = 0,
  onOpenSettingsSection,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'phone' | 'voicemails' | 'comms'>(initialSubTab ?? 'phone');
  const [answeringMode, setAnsweringMode] = useState<'ai' | 'manual'>('ai');
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [callsList, setCallsList] = useState<PhoneCall[]>(propCalls);
  // No seeded voicemails: the old defaults were fake demo messages shown
  // as real. The list starts empty and fills from the server only.
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  // Sidebar-design Calls screen: filter pills + the AI Receptionist
  // detail screen (Stage 4). The detail is an in-tab view like the
  // Stage 3 Customer Profile — the in-app back arrow is the way back.
  const [callFilter, setCallFilter] = useState<'all' | 'active' | 'missed'>('all');
  const [showReceptionist, setShowReceptionist] = useState(false);
  // Dashboard AI Receptionist card → open the detail screen on arrival
  // (same signal pattern as the quick-action create signals in App).
  const lastReceptionistSignalRef = useRef(0);
  useEffect(() => {
    if (openReceptionistSignal && openReceptionistSignal !== lastReceptionistSignalRef.current) {
      lastReceptionistSignalRef.current = openReceptionistSignal;
      setActiveSubTab('phone');
      setShowReceptionist(true);
    }
  }, [openReceptionistSignal]);

  // Real Phone System state (no carrier line connected — Twilio parked)
  const [carrierLive, setCarrierLive] = useState(false);
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

  // Manual simulator form fields — start empty. The old defaults were
  // a fake caller (a 555 number shown as a real business), and the
  // ring handler fell back to one when the fields were blank.
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [customSpeech, setCustomSpeech] = useState('');

  // Load the saved answering mode from the business record on mount.
  // (The old code read it from the parked Twilio telephony config, which
  // 503s — so the saved mode was never loaded.)
  useEffect(() => {
    apiFetch<{ telephonyProvider?: string }>('/api/firebase-config')
      .then(cfg => { if (cfg?.telephonyProvider === 'twilio') setCarrierLive(true); })
      .catch(() => {});
    const effectiveBusinessId = businessId || currentUser?.businessId;
    if (!effectiveBusinessId) return;
    apiFetch<BusinessAccount>(`/api/business/${effectiveBusinessId}`)
      .then(data => {
        if (data?.answeringMode === 'manual') {
          setAnsweringMode('manual');
        }
      })
      .catch(() => {});
  }, [businessId, currentUser?.businessId]);

  // Fetch voicemails & calls on mount + poll periodically for real PSTN calls
  // Scoped to this business (?businessId=), and records naming another
  // business are dropped client-side as well.
  const scopedBusinessId = businessId || currentUser?.businessId || '';
  useEffect(() => {
    const fetchRealData = () => {
      apiFetch<VoicemailRecord[]>(withBusinessId('/api/phone/voicemails', scopedBusinessId))
        .then(raw => {
          const data = Array.isArray(raw) ? filterToBusiness(raw, scopedBusinessId) : raw;
          if (Array.isArray(data) && data.length > 0) {
            setVoicemails(data);
          }
        })
        .catch(() => {});

      apiFetch<PhoneCall[]>(withBusinessId('/api/phone/calls', scopedBusinessId))
        .then(raw => {
          const data = Array.isArray(raw) ? filterToBusiness(raw, scopedBusinessId) : raw;
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
  }, [scopedBusinessId]);

  // Sync propCalls if updated from outside
  useEffect(() => {
    if (propCalls.length > callsList.length) {
      setCallsList(propCalls);
    }
  }, [propCalls]);

  const defaultUser: User = currentUser || {
    id: 'usr-guest',
    fullName: 'Operations Operator',
    email: 'rcsoulutions@gmail.com',
    role: 'Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    organization: 'RC Solutions',
    authenticated: true
  };

  // Save the answering mode to the business record — the real store for
  // this preference now (the parked Twilio telephony config never saved
  // it). Every tap saves and confirms; a failed save reverts the toggle
  // so the UI never claims a mode that isn't stored.
  const handleSetAnsweringMode = async (mode: 'ai' | 'manual') => {
    if (isSavingMode || mode === answeringMode) return;
    const effectiveBusinessId = businessId || currentUser?.businessId;
    if (!effectiveBusinessId) {
      onTriggerNotification?.('Could not save answering mode', 'No business is loaded, so the change was not saved.');
      return;
    }
    const previous = answeringMode;
    setAnsweringMode(mode);
    setIsSavingMode(true);
    try {
      const saved = await apiFetch<BusinessAccount>(`/api/business/${effectiveBusinessId}`, {
        method: 'PUT',
        body: JSON.stringify({ answeringMode: mode })
      });
      if (!saved) throw new Error('Empty response');
      setAnsweringMode(saved.answeringMode === 'manual' ? 'manual' : 'ai');
      // Mirror to Firestore so the mode survives a server-store wipe
      // (the startup re-sync restores the business from Firestore).
      firestoreService.saveBusiness(saved).catch(() => {});
      onTriggerNotification?.(
        'Answering mode saved',
        mode === 'ai'
          ? 'AI Receptionist answers calls automatically.'
          : 'Calls ring for a human to answer.'
      );
    } catch {
      setAnsweringMode(previous);
      onTriggerNotification?.('Could not save answering mode', 'Your change was not saved. Please try again.');
    } finally {
      setIsSavingMode(false);
    }
  };

  // Trigger Inbound Call — blank fields stay blank labels, never a
  // fake caller. Answering a call closes the receptionist detail screen
  // so the live call console (rendered in the phone view) is visible.
  const handleTriggerIncomingCall = (
    name = customName,
    phone = customPhone,
    topic = customTopic,
    speech = customSpeech
  ) => {
    setIncomingCall({
      callerName: name || 'Unknown Caller',
      callerNumber: phone || 'Unknown number',
      callerTopic: topic || 'General Inquiry',
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
    setShowReceptionist(false);
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
    setShowReceptionist(false);
    setActiveLiveCall(newCall);
  };

  // End Call Callback
  const handleEndLiveCall = (finalCall: PhoneCall) => {
    setActiveLiveCall(null);
    setCallsList(prev => [finalCall, ...prev]);

    // Persist to server
    apiFetch(withBusinessId('/api/phone/calls', scopedBusinessId), {
      method: 'POST',
      body: JSON.stringify(finalCall)
    }).catch(() => {});

    // Sync voicemails
    apiFetch<VoicemailRecord[]>(withBusinessId('/api/phone/voicemails', scopedBusinessId))
      .then(data => {
        if (Array.isArray(data)) setVoicemails(filterToBusiness(data, scopedBusinessId));
      })
      .catch(() => {});
  };

  const handleDeleteVoicemail = async (id: string) => {
    try {
      await apiFetch(withBusinessId(`/api/phone/voicemails/${encodeURIComponent(id)}`, scopedBusinessId), { method: 'DELETE' });
    } catch {}
    setVoicemails(prev => prev.filter(v => v.id !== id));
  };

  const handleToggleReviewed = (id: string) => {
    setVoicemails(prev => prev.map(v => v.id === id ? { ...v, reviewed: !v.reviewed } : v));
  };

  const unreviewedVoicemailCount = voicemails.filter(v => !v.reviewed).length;
  // No carrier line is connected (Twilio parked), so no carrier number is shown.

  // Receptionist detail stats — same honesty rules as the Dashboard
  // tiles and the WeeklyCard: a timestamp that does not parse simply
  // does not count. Calls today counts every server-recorded call from
  // today; leads captured counts customer requests created today;
  // appointments booked counts jobs booked today. No delta anywhere.
  const sameDay = (iso: string | undefined, now: Date) => {
    if (!iso) return false;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return false;
    return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  };
  const today = new Date();
  const callsToday = serverCalls.filter((c) => sameDay(c.timestamp, today)).length;
  const leadsCaptured = customerRequests.filter((r) => sameDay(r.createdAt, today)).length;
  const appointmentsBooked = jobs.filter((j) => sameDay(j.createdAt, today)).length;
  const receptionist = receptionistStatus(serverOnline, answeringMode);
  // Call-list filters — real counts from the list itself.
  const isMissedCall = (c: PhoneCall) => c.type === 'missed' || c.status === 'missed';
  const isActiveCall = (c: PhoneCall) => c.status === 'active' || c.status === 'ringing';
  const filteredCalls =
    callFilter === 'all'
      ? callsList
      : callFilter === 'missed'
      ? callsList.filter(isMissedCall)
      : callsList.filter(isActiveCall);
  // Plain type words for the row subtitle, as in the reference.
  const callLabel = (c: PhoneCall) => {
    if (isMissedCall(c)) return 'Missed Call';
    if (c.status === 'voicemail') return 'Voicemail';
    if (c.answeredBy === 'ai_receptionist') return 'AI Handled';
    if (c.type === 'outbound') return 'Outgoing Call';
    return 'Incoming Call';
  };

  return (
    <div className="flex flex-col w-full max-w-full overflow-hidden">
      {showReceptionist ? (
        <AiReceptionistDetail
          serverOnline={serverOnline}
          answeringMode={answeringMode}
          callsToday={callsToday}
          leadsCaptured={leadsCaptured}
          appointmentsBooked={appointmentsBooked}
          testName={customName}
          onTestNameChange={setCustomName}
          testPhone={customPhone}
          onTestPhoneChange={setCustomPhone}
          testTopic={customTopic}
          onTestTopicChange={setCustomTopic}
          testSpeech={customSpeech}
          onTestSpeechChange={setCustomSpeech}
          onRingTest={() => handleTriggerIncomingCall()}
          onDialRealPhone={() => setIsPbxModalOpen(true)}
          onClose={() => setShowReceptionist(false)}
          onOpenCallFlow={() => onNavigateTab?.('team')}
          onOpenKnowledgeBase={() => onOpenSettingsSection?.('user')}
          onOpenTranscripts={() => setShowReceptionist(false)}
        />
      ) : (
        <>
      {/* Sub-navigation Switcher */}
      <div className="px-3 sm:px-4 pt-1.5 pb-2 border-b border-zinc-800 shrink-0 bg-black">
        <div className="flex bg-zinc-950 border border-zinc-800/80 rounded-2xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'phone'
                ? 'bg-[#22ec72] text-black shadow-md shadow-[#22ec72]/20'
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
              availableDepartmentIds={availableDepartments}
            />
          ) : (
            <>
              {/* Header — as in the reference. */}
              <div className="px-1">
                <h2 className="text-xl font-extrabold text-white tracking-tight">Calls</h2>
                <p className="text-xs text-zinc-400 mt-0.5">AI-Powered Communication</p>
              </div>

              {/* Phone status bar — no carrier line is connected; calls run in-app. */}
              <div className={`p-3 ${sidebarCard} flex items-center justify-between gap-2 flex-wrap`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white">
                        No carrier line connected
                      </span>
                      <span className="text-[9px] px-2 py-0.2 rounded-full font-mono font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                        In-app calling only
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Routing: <strong className="text-zinc-200">{answeringMode === 'manual' ? 'Rings for a human to answer' : 'AI Receptionist answers automatically'}</strong>
                    </div>
                  </div>
                </div>

                {carrierLive && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPbxModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#22ec72]" />
                    <span>Carrier PBX Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPbxModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#22ec72]/20"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                    <span>Call Real Phone</span>
                  </button>
                </div>
                )}
              </div>

              {/* Free in-app voice call (WebRTC) — used while the Twilio carrier is parked */}
              <VoiceCallButton />

              {/* Answering mode — the real toggle, kept from the old
                  banner. The banner's stats are gone: three of the four
                  were invented ("99.4%", "5 Depts", "< 1.2s"); the real
                  total now lives on the All pill below. */}
              <div className={`p-3 ${sidebarCard} flex items-center justify-between gap-2`}>
                <span className="text-xs font-bold text-white">Answering mode</span>
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleSetAnsweringMode('ai')}
                    disabled={isSavingMode}
                    className={`px-2 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 min-h-[36px] ${
                      answeringMode === 'ai'
                        ? 'bg-[#22ec72] text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Concierge</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAnsweringMode('manual')}
                    disabled={isSavingMode}
                    className={`px-2 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 min-h-[36px] ${
                      answeringMode === 'manual'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    <span>Human Only</span>
                  </button>
                </div>
              </div>

              {/* Call log — filter pills with real counts, as in the reference. */}
              <div className="space-y-2.5">
                <div className="flex gap-1.5 px-1">
                  {(
                    [
                      { id: 'all', label: 'All', count: callsList.length },
                      { id: 'active', label: 'Active', count: callsList.filter(isActiveCall).length },
                      { id: 'missed', label: 'Missed', count: callsList.filter(isMissedCall).length },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setCallFilter(pill.id)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold border transition cursor-pointer min-h-[36px] ${
                        callFilter === pill.id
                          ? 'bg-[#22ec72]/15 text-[#22ec72] border-[#22ec72]/30'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  ))}
                </div>

                {filteredCalls.length === 0 ? (
                  <div className={`p-4 ${sidebarCard} text-center`}>
                    <p className="text-xs text-zinc-400">
                      {callFilter === 'missed'
                        ? 'No missed calls.'
                        : callFilter === 'active'
                        ? 'No calls in progress right now.'
                        : 'No calls yet — answered calls will show up here.'}
                    </p>
                  </div>
                ) : (
                <div className="space-y-2">
                  {filteredCalls.map((call) => {
                    const isExpanded = expandedCallId === call.id;
                    return (
                      <div
                        key={call.id}
                        className={`${sidebarCard} overflow-hidden transition-all hover:border-[#22ec72]/40`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                          className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                              isMissedCall(call)
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : call.answeredBy === 'ai_receptionist'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : call.type === 'outbound'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                            }`}>
                              {isMissedCall(call) ? (
                                <PhoneMissed className="w-4 h-4" />
                              ) : call.type === 'outbound' ? (
                                <PhoneOutgoing className="w-4 h-4" />
                              ) : (
                                <PhoneIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">{call.callerName}</span>
                                {call.isRealPstnCall && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30">
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
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-[#22ec72] font-mono font-semibold">
                                    🔀 {call.department}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                {callLabel(call)} • {call.callerNumber} • {call.duration}
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
                                  href={safeHref(call.recordingUrl)}
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
                              <div className="p-2.5 rounded-xl bg-[#22ec72]/10 border border-[#22ec72]/30 text-xs text-[#22ec72] flex items-center gap-2">
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
                )}
              </div>

              {/* AI Receptionist card — as in the reference. One tap
                  opens the detail screen. */}
              <button
                type="button"
                onClick={() => setShowReceptionist(true)}
                className={`w-full p-3.5 ${sidebarCard} hover:border-[#22ec72]/40 transition cursor-pointer text-left`}
              >
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-full border-2 border-[#22ec72] text-[#22ec72] shrink-0">
                    <AudioWaveform className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">AI Receptionist</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        receptionist.tone === 'active'
                          ? 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                          : receptionist.tone === 'offline'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}>
                        {receptionist.label}
                      </span>
                    </span>
                    <span className="block text-xs text-zinc-400 mt-0.5">
                      {receptionist.tone === 'active' ? 'Handling calls 24/7' : receptionist.subline}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </div>
              </button>
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
        </>
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

      {/* Phone Setup Modal (Vonage SMS + LiveKit voice) */}
      <RealPhoneSetupModal
        isOpen={isPbxModalOpen}
        onClose={() => setIsPbxModalOpen(false)}
        businessId={businessId || currentUser?.businessId || ''}
        onTriggerNotification={onTriggerNotification}
      />
    </div>
  );
};
