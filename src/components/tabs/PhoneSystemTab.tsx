import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, ChatMessage, User, VoicemailRecord, BusinessAccount, Job, CustomerRequest } from '../../types';
import {
  Phone,
  PhoneCall as PhoneIcon,
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
  Play,
  UserPlus
} from 'lucide-react';
import { MessagesTab } from './MessagesTab';
import { VoicemailsView } from '../phone/VoicemailsView';
import { RealPhoneSetupModal } from '../phone/RealPhoneSetupModal';
import { VoiceCallButton } from '../phone/VoiceCallButton';
import { OutboundDialer } from '../phone/OutboundDialer';
import { AiReceptionistDetail, receptionistStatus } from '../phone/AiReceptionistDetail';
import { sidebarCard } from '../ui/cards';
import { apiFetch } from '../../lib/api';
import { fetchLiveCalls, type LiveCall } from '../../lib/liveCalls';
import { type CallerPrefillSource } from '../../lib/callToClient';
import { LiveCallsCard } from '../phone/LiveCallsCard';
import { withBusinessId, filterToBusiness } from '../../lib/businessScope';
import { firestoreService } from '../../services/firestoreService';
import { safeHref } from '../../lib/safeOpen';

interface PhoneSystemTabProps {
  calls: PhoneCall[];
  messages: ChatMessage[];
  currentUser: User | null;
  businessId: string;
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
  /** Add a caller as a customer — opens the Add Client form pre-filled
      with what the call record carries (number, and for log entries the
      caller name and AI summary when the record has them). */
  onAddCallerAsClient?: (source: CallerPrefillSource) => void;
}

// No preset scenarios: the old Quick Scenarios box was demo content
// (fake names and 555 numbers shown as real callers). The inbound test
// lives on the AI Receptionist detail screen now, starting empty.

export const PhoneSystemTab: React.FC<PhoneSystemTabProps> = ({
  calls: propCalls,
  messages,
  currentUser,
  businessId,
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
  onAddCallerAsClient,
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

  // Real Phone System state (no carrier line connected — calls run in-app).
  const [isPbxModalOpen, setIsPbxModalOpen] = useState(false);

  // Live receptionist calls from the server (LiveKit webhook) — the
  // real inbound calls the agent is on right now. Starts empty; a
  // failed poll keeps the last good list, never invented calls.
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);

  // Load the saved answering mode from the business record on mount.
  useEffect(() => {
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

      // Live receptionist calls (same 6s poll as the call log above).
      fetchLiveCalls(scopedBusinessId)
        .then(data => {
          if (Array.isArray(data)) setLiveCalls(filterToBusiness(data, scopedBusinessId));
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

  // Save the answering mode to the business record — the real store for
  // this preference now. Every tap saves and confirms; a failed save reverts the toggle
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
  // No carrier line is connected, so no carrier number is shown.

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
            className={`min-h-[48px] flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`min-h-[48px] flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeSubTab === 'voicemails' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voicemails</span>
            {unreviewedVoicemailCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {unreviewedVoicemailCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('comms')}
            className={`min-h-[48px] flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
          {/* Header — as in the reference. */}
              <div className="px-1">
                <h2 className="text-xl font-extrabold text-white tracking-tight">Calls</h2>
                <p className="text-xs text-zinc-400 mt-0.5">AI-Powered Communication</p>
              </div>

              {/* Live receptionist calls — the real inbound calls the AI
                  is on right now, with Listen in. Empty state when none. */}
              <LiveCallsCard
                calls={liveCalls}
                businessId={scopedBusinessId}
                onAddCallerAsClient={
                  onAddCallerAsClient
                    ? (liveCall) => onAddCallerAsClient({ callerNumber: liveCall.callerNumber })
                    : undefined
                }
              />

              {/* Phone status bar — no carrier line is connected; calls run in-app. */}
              <div className={`p-3 ${sidebarCard} flex items-center justify-between gap-2 flex-wrap`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white">
                        No carrier line connected
                      </span>
                      <span className="text-xs px-2 py-0.2 rounded-full font-mono font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                        In-app calling only
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">
                      Routing: <strong className="text-zinc-200">{answeringMode === 'manual' ? 'Rings for a human to answer' : 'AI Receptionist answers automatically'}</strong>
                    </div>
                  </div>
                </div>

                {/* Phone setup — the real Vonage / LiveKit setup modal. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPbxModalOpen(true)}
                    className="min-h-[48px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#22ec72]" />
                    <span>Phone setup</span>
                  </button>
                </div>
              </div>

              {/* Dial out — real PSTN calls from the app keypad (LiveKit
                  SIP outbound trunk; shows its setup state when the
                  trunk is not configured yet). */}
              <OutboundDialer businessId={scopedBusinessId} />

              {/* Free in-app voice call (WebRTC) */}
              <VoiceCallButton />

              {/* Answering mode — the real toggle, kept from the old
                  banner. The banner's stats are gone: three of the four
                  were invented ("99.4%", "5 Depts", "< 1.2s"); the real
                  total now lives on the All pill below. */}
              <div className={`p-3 ${sidebarCard} flex items-center justify-between gap-2`}>
                <span className="text-xs font-bold text-white">Answering mode</span>
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs font-mono">
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
                          className="min-h-[48px] w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-zinc-900/50 transition-colors cursor-pointer"
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
                                  <span className="text-xs px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30">
                                    PSTN Carrier
                                  </span>
                                )}
                                {call.answeredBy && (
                                  <span className={`text-xs px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                    call.answeredBy === 'ai_receptionist'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {call.answeredBy === 'ai_receptionist' ? 'AI Concierge' : 'Human'}
                                  </span>
                                )}
                                {call.department && (
                                  <span className="text-xs px-1.5 py-0.2 rounded bg-zinc-800 text-[#22ec72] font-mono font-semibold">
                                    🔀 {call.department}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-400 font-mono truncate">
                                {callLabel(call)} • {call.callerNumber} • {call.duration}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-zinc-500 font-mono">{call.timestamp}</span>
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
                              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                                Call Summary
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60 font-sans">
                                {call.summary || 'Inbound call logged into RCOS communications repository.'}
                              </p>
                            </div>

                            {/* Carrier Recording link if available */}
                            {call.recordingUrl && (
                              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs">
                                <span className="text-purple-300 font-mono text-xs flex items-center gap-1.5">
                                  <Play className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Carrier Audio Recording Available</span>
                                </span>
                                <a
                                  href={safeHref(call.recordingUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 font-mono"
                                >
                                  <span>Listen Recording</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {call.transcript && call.transcript.length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                                  Full Conversation Transcript
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {call.transcript.map((line, idx) => (
                                    <div key={idx} className="text-xs flex items-start gap-2">
                                      <span className={`font-mono text-xs font-bold shrink-0 ${
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

                            {/* Add the caller as a customer — opens the Add
                                Client form pre-filled with this call's
                                number, caller name, and AI summary (when
                                the record has them). */}
                            {onAddCallerAsClient && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAddCallerAsClient({
                                    callerNumber: call.callerNumber,
                                    callerName: call.callerName,
                                    summary: call.summary,
                                    department: call.department,
                                  })
                                }
                                className="min-h-[48px] w-full px-3 py-2.5 rounded-xl bg-[#22ec72]/10 hover:bg-[#22ec72]/20 border border-[#22ec72]/40 text-[#22ec72] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <UserPlus className="w-4 h-4" />
                                <span>Add caller as customer</span>
                              </button>
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
                className={`min-h-[48px] w-full p-3.5 ${sidebarCard} hover:border-[#22ec72]/40 transition cursor-pointer text-left`}
              >
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-full border-2 border-[#22ec72] text-[#22ec72] shrink-0">
                    <AudioWaveform className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">AI Receptionist</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
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
            currentUser={currentUser}
            onSendMessage={onSendMessage}
          />
        </div>
      )}
        </>
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
