import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, CallTranscriptEntry, DepartmentTransfer } from '../../types';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  User, 
  PhoneForwarded, 
  Mail, 
  FileText, 
  CheckCircle2, 
  Send,
  Radio,
  ArrowRightLeft
} from 'lucide-react';
import { playChime, playBase64Wav, speakWithBrowserSynthesis, stopAllSpeech } from '../../utils/phoneAudio';
import { DepartmentTransferModal } from './DepartmentTransferModal';
import { DirectEmailModal } from './DirectEmailModal';
import { DirectQuoteModal } from './DirectQuoteModal';

interface LiveCallConsoleProps {
  activeCall: PhoneCall;
  onEndCall: (finalCall: PhoneCall) => void;
  onUpdateCall: (updatedCall: PhoneCall) => void;
  onTriggerNotification?: (title: string, message: string) => void;
}

export const LiveCallConsole: React.FC<LiveCallConsoleProps> = ({
  activeCall,
  onEndCall,
  onUpdateCall,
  onTriggerNotification
}) => {
  const [answeredBy, setAnsweredBy] = useState<'ai_receptionist' | 'human_operator'>(
    activeCall.answeredBy || 'ai_receptionist'
  );
  const [transcript, setTranscript] = useState<CallTranscriptEntry[]>(
    activeCall.transcript || [
      {
        speaker: 'RCOS AI',
        text: 'Thank you for calling RC Solutions! My name is Kore, your digital concierge. How may I direct your call or assist you today?',
        time: '00:02'
      }
    ]
  );
  const [callerInput, setCallerInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(12);
  const [activeDepartment, setActiveDepartment] = useState<string | undefined>(activeCall.department);
  const [callStatus, setCallStatus] = useState<string>(activeCall.status || 'active');

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // Email/Quote prep data
  const [emailDetails, setEmailDetails] = useState<any>(null);
  const [quoteDetails, setQuoteDetails] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  // Call timer increment
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Initial greeting audio if AI Receptionist starts
  useEffect(() => {
    if (answeredBy === 'ai_receptionist' && transcript.length === 1 && !isMuted) {
      handleSynthesizeAndSpeak(transcript[0].text);
    }
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Real TTS speech synthesis
  const handleSynthesizeAndSpeak = async (text: string) => {
    if (isMuted) return;
    setIsSpeaking(true);
    try {
      const res = await fetch('/api/phone/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: 'Kore' })
      });
      const data = await res.json();
      if (data.audioBase64) {
        const audio = await playBase64Wav(data.audioBase64);
        if (audio) {
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          return;
        }
      }
    } catch {
      // Fallback
    }
    speakWithBrowserSynthesis(text, () => setIsSpeaking(false));
  };

  // Speech Recognition (Microphone)
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use text input below.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => setIsListening(true);
      rec.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        setCallerInput(transcriptText);
        setIsListening(false);
        // Automatically submit spoken audio
        handleSendCallerTurn(transcriptText);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn('Speech rec error', e);
      setIsListening(false);
    }
  };

  // Submit a turn from the caller
  const handleSendCallerTurn = async (inputText?: string) => {
    const textToSend = (inputText !== undefined ? inputText : callerInput).trim();
    if (!textToSend || isProcessing) return;

    setCallerInput('');
    const callerTime = formatTimer(callDurationSeconds);

    const newTranscript: CallTranscriptEntry[] = [
      ...transcript,
      {
        speaker: 'Caller',
        text: textToSend,
        time: callerTime
      }
    ];
    setTranscript(newTranscript);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/phone/receptionist-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeech: textToSend,
          callerName: activeCall.callerName,
          callerNumber: activeCall.callerNumber,
          conversationHistory: newTranscript,
          answeredBy,
          withAudio: !isMuted
        })
      });

      const data = await res.json();
      const aiTime = formatTimer(callDurationSeconds + 1);

      const aiTurn: CallTranscriptEntry = {
        speaker: answeredBy === 'ai_receptionist' ? 'RCOS AI' : 'Human Operator',
        text: data.aiResponse || 'Understood, thank you.',
        time: aiTime,
        audioBase64: data.audioBase64
      };

      const updatedTranscript = [...newTranscript, aiTurn];
      setTranscript(updatedTranscript);

      // Handle triggered actions
      if (data.actionTriggered) {
        const act = data.actionTriggered;
        if (act.type === 'transfer_call') {
          playChime('transfer');
          setActiveDepartment(act.targetDepartment);
          setCallStatus(`Transferred to ${act.targetDepartment}`);
          if (onTriggerNotification) {
            onTriggerNotification(
              'Call Transferred',
              `Caller transferred to ${act.targetDepartment} (Ext ${act.extension || '101'})`
            );
          }
        } else if (act.type === 'request_quote_approval') {
          if (onTriggerNotification) {
            onTriggerNotification(
              'Quote Approval Created',
              `Quote of $${act.estimatedAmount} requested for ${activeCall.callerName}. Added to Approvals.`
            );
          }
        } else if (act.type === 'send_email') {
          if (onTriggerNotification) {
            onTriggerNotification(
              'Email Dispatched',
              `Confirmation email sent to ${act.recipient || 'caller'}`
            );
          }
        } else if (act.type === 'take_message') {
          playChime('message');
          setCallStatus('Voicemail Logged');
          if (onTriggerNotification) {
            onTriggerNotification(
              'Voicemail Logged',
              `New transcribed message recorded from ${activeCall.callerName}`
            );
          }
        }
      }

      // Play audio if available and answered by AI
      if (data.audioBase64 && !isMuted && answeredBy === 'ai_receptionist') {
        setIsSpeaking(true);
        const audio = await playBase64Wav(data.audioBase64);
        if (audio) {
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
        } else {
          setIsSpeaking(false);
        }
      } else if (!data.audioBase64 && !isMuted && answeredBy === 'ai_receptionist') {
        handleSynthesizeAndSpeak(aiTurn.text);
      }
    } catch (e) {
      console.warn('Call turn failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // One-Tap Switch: Take Over Call / Hand Off to AI
  const handleToggleAnsweringMode = () => {
    stopAllSpeech();
    const newMode = answeredBy === 'ai_receptionist' ? 'human_operator' : 'ai_receptionist';
    setAnsweredBy(newMode);
    playChime('pickup');

    const switchNotice: CallTranscriptEntry = {
      speaker: 'System',
      text: newMode === 'human_operator' 
        ? '👤 Human Operator took over the active call.' 
        : '🤖 Call handed off to AI Voice Concierge (Kore).',
      time: formatTimer(callDurationSeconds)
    };
    setTranscript(prev => [...prev, switchNotice]);

    if (newMode === 'ai_receptionist') {
      const promptText = "Hello again, I am Kore, the AI Concierge. I have your file open—how can I help you proceed?";
      handleSynthesizeAndSpeak(promptText);
    }
  };

  // Department Transfer execution
  const handleExecuteTransfer = (dept: DepartmentTransfer) => {
    playChime('transfer');
    setActiveDepartment(dept.name);
    setCallStatus(`Transferred to ${dept.name}`);

    const transferEntry: CallTranscriptEntry = {
      speaker: 'System',
      text: `🔀 Call transferred to ${dept.name} (Ext ${dept.extension}, ${dept.leadName}). Transferring audio feed...`,
      time: formatTimer(callDurationSeconds)
    };
    setTranscript(prev => [...prev, transferEntry]);

    const announcement = `Please stay on the line while I connect you with ${dept.leadName} at ${dept.name}, Extension ${dept.extension}.`;
    handleSynthesizeAndSpeak(announcement);

    if (onTriggerNotification) {
      onTriggerNotification(
        'Call Transferred',
        `Routed to ${dept.name} (${dept.leadName} - Ext ${dept.extension})`
      );
    }
  };

  // Hang Up Call
  const handleHangUp = () => {
    stopAllSpeech();
    playChime('hangup');
    const finalCallRecord: PhoneCall = {
      ...activeCall,
      status: activeDepartment ? 'transferred' : 'completed',
      duration: formatTimer(callDurationSeconds),
      transcript,
      answeredBy,
      department: activeDepartment,
      summary: `Call completed (${formatTimer(callDurationSeconds)}). Answered by ${answeredBy === 'ai_receptionist' ? 'AI Concierge Kore' : 'Human Operator'}. Final status: ${callStatus}.`
    };
    onEndCall(finalCallRecord);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white p-3 sm:p-4 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
      {/* Top Call Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-900 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-lime-500 animate-ping absolute inset-0" />
            <div className="w-3 h-3 rounded-full bg-lime-500 relative" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">{activeCall.callerName}</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono bg-zinc-900 text-lime-400 border border-zinc-800 font-bold">
                {formatTimer(callDurationSeconds)}
              </span>
            </div>
            <div className="text-[10.5px] text-zinc-400 font-mono">
              {activeCall.callerNumber} {activeDepartment ? `• 🔀 ${activeDepartment}` : ''}
            </div>
          </div>
        </div>

        {/* Mode Switcher Toggle: Human vs AI */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleAnsweringMode}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              answeredBy === 'ai_receptionist'
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                : 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
            }`}
          >
            {answeredBy === 'ai_receptionist' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">AI Kore:</span>
                <span className="text-[11px] underline">Take Over Call</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Human:</span>
                <span className="text-[11px] underline">Hand Off to AI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isMuted 
                ? 'bg-zinc-900 text-zinc-500 border-zinc-800' 
                : 'bg-zinc-900 text-lime-400 border-lime-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Waveform & Voice State Visualizer */}
      <div className="py-2 px-3 bg-zinc-950/80 rounded-2xl border border-zinc-900 my-2 flex items-center justify-between shrink-0 font-mono">
        <div className="flex items-center gap-2">
          {answeredBy === 'ai_receptionist' ? (
            <span className="flex items-center gap-1 text-[11px] text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Voice AI Receptionist Active</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-blue-400">
              <User className="w-3.5 h-3.5" />
              <span>Operator Audio Channel Active</span>
            </span>
          )}
        </div>

        {/* Animated Audio Waveform Bars */}
        <div className="flex items-center gap-1 h-4">
          {[1, 2, 3, 4, 5, 6].map((bar) => (
            <div
              key={bar}
              className={`w-1 rounded-full transition-all duration-150 ${
                isSpeaking 
                  ? 'bg-lime-400 animate-pulse' 
                  : isProcessing 
                  ? 'bg-purple-500 animate-bounce' 
                  : 'bg-zinc-700 h-1.5'
              }`}
              style={{
                height: isSpeaking ? `${Math.floor(6 + Math.random() * 12)}px` : undefined
              }}
            />
          ))}
        </div>
      </div>

      {/* Live Conversation Transcript Feed */}
      <div className="flex-1 min-h-[140px] max-h-[360px] overflow-y-auto space-y-2.5 pr-1 py-1 font-sans">
        {transcript.map((entry, idx) => {
          const isAI = entry.speaker.includes('AI') || entry.speaker.includes('RCOS');
          const isCaller = entry.speaker.includes('Caller');
          const isSystem = entry.speaker.includes('System');

          if (isSystem) {
            return (
              <div key={idx} className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 font-mono text-center flex items-center justify-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-lime-400 shrink-0" />
                <span>{entry.text}</span>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className={`flex flex-col ${isCaller ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-zinc-400 font-mono px-1">
                <span>{entry.speaker}</span>
                <span>•</span>
                <span>{entry.time}</span>
              </div>
              <div
                className={`p-3 rounded-2xl max-w-[88%] text-xs leading-relaxed ${
                  isCaller
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : isAI
                    ? 'bg-zinc-900 text-zinc-100 border border-purple-500/30 rounded-tl-none'
                    : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none'
                }`}
              >
                <p>{entry.text}</p>
                {isAI && (
                  <button
                    type="button"
                    onClick={() => handleSynthesizeAndSpeak(entry.text)}
                    className="mt-1 text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Replay Voice</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {isProcessing && (
          <div className="flex items-center gap-2 p-2 text-xs text-purple-400 font-mono italic">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-400" />
            <span>Kore is formulating spoken response & routing actions...</span>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Quick Action Buttons Tray */}
      <div className="grid grid-cols-4 gap-1.5 pt-2 pb-2 border-t border-zinc-900 shrink-0">
        <button
          type="button"
          onClick={() => setIsTransferModalOpen(true)}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-bold text-lime-400 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
        >
          <PhoneForwarded className="w-4 h-4" />
          <span>Transfer</span>
        </button>

        <button
          type="button"
          onClick={() => setIsEmailModalOpen(true)}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-bold text-blue-400 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
        >
          <Mail className="w-4 h-4" />
          <span>Email Task</span>
        </button>

        <button
          type="button"
          onClick={() => setIsQuoteModalOpen(true)}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-bold text-amber-400 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Quote Req</span>
        </button>

        <button
          type="button"
          onClick={handleHangUp}
          className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-[11px] font-bold text-red-400 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
        >
          <PhoneOff className="w-4 h-4" />
          <span>End Call</span>
        </button>
      </div>

      {/* Caller Input Controls (Mic + Text) */}
      <div className="pt-2 border-t border-zinc-900 shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          title={isListening ? 'Stop Mic' : 'Speak into Microphone'}
          className={`p-2.5 rounded-2xl border transition cursor-pointer shrink-0 ${
            isListening 
              ? 'bg-red-500 text-white border-red-600 animate-pulse' 
              : 'bg-zinc-900 hover:bg-zinc-800 text-blue-400 border-zinc-800'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={callerInput}
          onChange={(e) => setCallerInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendCallerTurn();
          }}
          placeholder={
            answeredBy === 'ai_receptionist'
              ? 'Speak as caller (or type e.g., "Transfer to Billing")...'
              : 'Speak as operator to caller...'
          }
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-sans"
        />

        <button
          type="button"
          onClick={() => handleSendCallerTurn()}
          disabled={!callerInput.trim() || isProcessing}
          className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition cursor-pointer shrink-0 shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Transfer Department Modal */}
      <DepartmentTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSelectDepartment={handleExecuteTransfer}
        currentDepartment={activeDepartment}
      />

      {/* Direct Email Modal */}
      <DirectEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        callerName={activeCall.callerName}
        onEmailSent={(email) => {
          const sentLog: CallTranscriptEntry = {
            speaker: 'System',
            text: `📧 Sent confirmation email to "${email.recipient}" with subject "${email.subject}".`,
            time: formatTimer(callDurationSeconds)
          };
          setTranscript(prev => [...prev, sentLog]);
        }}
      />

      {/* Direct Quote Modal */}
      <DirectQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        callerName={activeCall.callerName}
        onQuoteCreated={(quote) => {
          const quoteLog: CallTranscriptEntry = {
            speaker: 'System',
            text: `📑 Submitted Quote Approval Request for $${quote.amount} ("${quote.serviceName}"). Pending supervisor review in Approvals tab.`,
            time: formatTimer(callDurationSeconds)
          };
          setTranscript(prev => [...prev, quoteLog]);
        }}
      />
    </div>
  );
};
