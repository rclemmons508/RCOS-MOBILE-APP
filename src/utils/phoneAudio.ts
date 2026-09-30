// Real-time Phone System Web Audio Synthesizer & Voice Player

let activeAudioCtx: AudioContext | null = null;
let activeRingtoneInterval: any = null;

function getAudioContext(): AudioContext {
  if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    activeAudioCtx = new AudioContextClass();
  }
  if (activeAudioCtx.state === 'suspended') {
    activeAudioCtx.resume().catch(() => {});
  }
  return activeAudioCtx;
}

/**
 * Realistic Dual-Tone Multi-Frequency (DTMF) standard North American ringback (440Hz + 480Hz)
 */
export function playRingtone(): () => void {
  stopRingtone();
  try {
    const ctx = getAudioContext();

    const ringCycle = () => {
      if (!ctx || ctx.state === 'closed') return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.setValueAtTime(480, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 1.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);
    };

    ringCycle();
    activeRingtoneInterval = setInterval(ringCycle, 4000);
  } catch (e) {
    console.warn('[PhoneAudio] Ringtone failed:', e);
  }

  return stopRingtone;
}

export function stopRingtone() {
  if (activeRingtoneInterval) {
    clearInterval(activeRingtoneInterval);
    activeRingtoneInterval = null;
  }
}

/**
 * Pleasant telephone system chimes for transfer, pick up, hang up, and voicemails
 */
export function playChime(type: 'pickup' | 'hangup' | 'transfer' | 'message') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === 'pickup') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'hangup') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'transfer') {
      // Tri-tone transfer announcement bell
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    } else if (type === 'message') {
      // Voicemail recording beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.setValueAtTime(0.15, now + 0.4);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (e) {
    console.warn('[PhoneAudio] Chime failed:', e);
  }
}

/**
 * Plays base64 WAV audio from Gemini TTS
 */
export async function playBase64Wav(base64Wav: string): Promise<HTMLAudioElement | null> {
  try {
    const audioUrl = `data:audio/wav;base64,${base64Wav}`;
    const audio = new Audio(audioUrl);
    await audio.play();
    return audio;
  } catch (err) {
    console.warn('[PhoneAudio] Playing base64 audio failed:', err);
    return null;
  }
}

/**
 * Web SpeechSynthesis speech fallback if audio buffer unavailable
 */
export function speakWithBrowserSynthesis(text: string, onEnd?: () => void): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Victoria')));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[PhoneAudio] Browser synthesis failed:', err);
    return false;
  }
}

export function stopAllSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
