import React, { useState, useEffect } from 'react';
import { VoicemailRecord } from '../../types';
import { 
  Mic, 
  Volume2, 
  VolumeX, 
  Mail, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Building2, 
  Sparkles,
  AlertTriangle,
  Play,
  Square
} from 'lucide-react';
import { playBase64Wav, speakWithBrowserSynthesis, stopAllSpeech } from '../../utils/phoneAudio';
import { DirectEmailModal } from './DirectEmailModal';
import { DirectQuoteModal } from './DirectQuoteModal';

interface VoicemailsViewProps {
  voicemails: VoicemailRecord[];
  onDeleteVoicemail: (id: string) => void;
  onToggleReviewed: (id: string) => void;
  onAddVoicemail?: (vm: VoicemailRecord) => void;
}

export const VoicemailsView: React.FC<VoicemailsViewProps> = ({
  voicemails,
  onDeleteVoicemail,
  onToggleReviewed,
  onAddVoicemail
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeEmailCaller, setActiveEmailCaller] = useState<VoicemailRecord | null>(null);
  const [activeQuoteCaller, setActiveQuoteCaller] = useState<VoicemailRecord | null>(null);

  const handlePlayVoicemail = async (vm: VoicemailRecord) => {
    if (playingId === vm.id) {
      stopAllSpeech();
      setPlayingId(null);
      return;
    }

    stopAllSpeech();
    setPlayingId(vm.id);

    // If carrier MP3 recording URL exists, play real telecom recording
    if (vm.audioUrl) {
      try {
        const audio = new Audio(vm.audioUrl);
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => setPlayingId(null);
        await audio.play();
        return;
      } catch (err) {
        console.warn('Carrier audio failed, falling back to TTS', err);
      }
    }

    // If pre-stored base64 audio exists, play it
    if (vm.audioBase64) {
      await playBase64Wav(vm.audioBase64);
      setPlayingId(null);
      return;
    }

    // Otherwise generate TTS voice dynamically via Gemini TTS
    setIsLoadingAudio(true);
    try {
      const res = await fetch('/api/phone/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Message from ${vm.callerName}: "${vm.transcription}"`,
          voiceName: 'Kore'
        })
      });
      const data = await res.json();
      if (data.audioBase64) {
        setIsLoadingAudio(false);
        const audio = await playBase64Wav(data.audioBase64);
        if (audio) {
          audio.onended = () => setPlayingId(null);
        } else {
          setPlayingId(null);
        }
        return;
      }
    } catch {
      // Fallback to browser synthesis
    } finally {
      setIsLoadingAudio(false);
    }

    // Browser Speech Synthesis fallback
    speakWithBrowserSynthesis(`Message from ${vm.callerName}. ${vm.transcription}`, () => {
      setPlayingId(null);
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            URGENT
          </span>
        );
      case 'high':
        return (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            HIGH PRIORITY
          </span>
        );
      case 'medium':
        return (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            STANDARD
          </span>
        );
      default:
        return (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 p-3 sm:p-4 max-w-full overflow-hidden">
      {/* Header Banner */}
      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Voicemail & Transcriptions
              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {voicemails.length} Records
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">AI transcribed caller messages and actionable requests</p>
          </div>
        </div>
      </div>

      {voicemails.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <Mic className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-sm font-bold text-zinc-300">No Voicemails Recorded Yet</div>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            When callers leave a message or request a note, the Voice Receptionist transcribes and logs them here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {voicemails.map((vm) => {
            const isPlaying = playingId === vm.id;
            return (
              <div
                key={vm.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  vm.reviewed 
                    ? 'bg-zinc-950/70 border-zinc-800/60 opacity-80' 
                    : 'bg-zinc-950 border-purple-500/30 shadow-lg shadow-purple-500/5'
                }`}
              >
                {/* Top Info Row */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-900">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">{vm.callerName}</span>
                      {getUrgencyBadge(vm.urgency)}
                      {vm.audioUrl && (
                        <span className="text-[9px] px-2 py-0.2 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono font-bold">
                          PSTN Recording
                        </span>
                      )}
                      {vm.department && (
                        <span className="text-[9px] px-2 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          {vm.department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-zinc-500" />
                        {vm.callerNumber}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {vm.duration || '0m 45s'}
                      </span>
                      <span>•</span>
                      <span className="text-zinc-500">{vm.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleReviewed(vm.id)}
                      title={vm.reviewed ? 'Mark Unread' : 'Mark Reviewed'}
                      className={`p-1.5 rounded-lg border transition cursor-pointer text-xs ${
                        vm.reviewed 
                          ? 'bg-zinc-900 text-lime-400 border-lime-500/30' 
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteVoicemail(vm.id)}
                      title="Delete Voicemail"
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Transcription Body */}
                <div className="my-3 p-3 rounded-xl bg-black/60 border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-purple-400 font-mono font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Live Audio Transcription:</span>
                    </span>
                    <span className="text-zinc-500">Gemini STT Engine</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans italic">
                    "{vm.transcription}"
                  </p>
                </div>

                {/* Action Buttons Tray */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handlePlayVoicemail(vm)}
                    disabled={isLoadingAudio && playingId === vm.id}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isPlaying 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' 
                        : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop Audio</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{isLoadingAudio && playingId === vm.id ? 'Loading Voice...' : 'Listen to Voice'}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveEmailCaller(vm)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email Follow-up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQuoteCaller(vm)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Quote Approval</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct Email Modal */}
      {activeEmailCaller && (
        <DirectEmailModal
          isOpen={!!activeEmailCaller}
          onClose={() => setActiveEmailCaller(null)}
          callerName={activeEmailCaller.callerName}
          defaultSubject={`Follow-up regarding your voicemail: ${activeEmailCaller.callerName}`}
          defaultBody={`Hello ${activeEmailCaller.callerName},\n\nWe received and reviewed your voicemail regarding: "${activeEmailCaller.transcription}".\n\nOur team is actively coordinating your request. Please let us know if you need anything else.\n\nBest regards,\nRC Solutions Operations Team`}
        />
      )}

      {/* Direct Quote Modal */}
      {activeQuoteCaller && (
        <DirectQuoteModal
          isOpen={!!activeQuoteCaller}
          onClose={() => setActiveQuoteCaller(null)}
          callerName={activeQuoteCaller.callerName}
          defaultServiceName="Mechanical & Automation Service Scope"
          defaultDetails={`Voicemail request from ${activeQuoteCaller.callerName}: "${activeQuoteCaller.transcription}"`}
        />
      )}
    </div>
  );
};
