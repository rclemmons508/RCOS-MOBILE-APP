import { GoogleGenAI } from '@google/genai';

// Initialize SDK safely
const rawApiKey = (process.env.GEMINI_API_KEY || '').trim();
export const hasValidApiKey = rawApiKey.length > 5 && !rawApiKey.includes('MY_GEMINI_API_KEY');

export const ai = new GoogleGenAI({
  apiKey: hasValidApiKey ? rawApiKey : 'placeholder-key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export const PRIMARY_MODEL = 'gemini-3.8-flash';
export const FAST_MODEL = 'gemini-3.1-flash-lite';
export const PRO_MODEL = 'gemini-3.1-pro-preview';
export const TTS_MODEL = 'gemini-3.8-flash-lite-tts';

// Exhaustive candidate model chain following SKILL.md valid models
export const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

// Gemini call timeouts (audit: improvements). Every model attempt is
// aborted after GEMINI_TIMEOUT_MS (default 25s), and one
// executeGeminiWithFallback call stops trying further models once
// GEMINI_TOTAL_BUDGET_MS (default 45s) has elapsed, then runs the caller's
// fallback — a hung upstream can no longer pin a request (and a slot of
// the event loop's sockets) for minutes across the 3-model chain.
function envMs(name: string, fallback: number): number {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) && n >= 1000 ? n : fallback;
}
export const GEMINI_TIMEOUT_MS = envMs('GEMINI_TIMEOUT_MS', 25_000);
const GEMINI_TOTAL_BUDGET_MS = envMs('GEMINI_TOTAL_BUDGET_MS', 45_000);

export async function generateSpeechAudio(
  text: string, 
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' = 'Kore'
): Promise<{ audioBase64: string | null; mimeType: string }> {
  if (!hasValidApiKey) {
    return { audioBase64: null, mimeType: 'audio/wav' };
  }
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 1000),
              speechMetadata: {
                style: 'Professional, warm, helpful customer service receptionist',
              },
            },
          ],
        },
      ],
      config: {
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return { audioBase64: base64Audio, mimeType: 'audio/wav' };
    }
  } catch (err: any) {
    console.warn('[Gemini TTS] TTS generation failed:', err?.message || err);
  }
  return { audioBase64: null, mimeType: 'audio/wav' };
}

export async function executeGeminiWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
  fallbackFn: () => string;
  /** Per-attempt timeout override (ms), e.g. for large document analysis. */
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string; source: 'llm' | 'fallback' }> {
  // If API key is missing, run the caller's keyword fallback. It is labelled
  // honestly as a fallback — never as a neural-engine result.
  if (!hasValidApiKey) {
    return { text: params.fallbackFn(), modelUsed: 'keyword-fallback', source: 'fallback' };
  }

  const modelsToTry = params.preferredModel 
    ? [params.preferredModel, ...CANDIDATE_MODELS.filter(m => m !== params.preferredModel)]
    : CANDIDATE_MODELS;

  const perAttempt = params.timeoutMs && params.timeoutMs >= 1000 ? params.timeoutMs : GEMINI_TIMEOUT_MS;
  const budget = Math.max(GEMINI_TOTAL_BUDGET_MS, perAttempt);
  const started = Date.now();
  for (const model of modelsToTry) {
    const remaining = budget - (Date.now() - started);
    if (remaining < 1000) {
      console.warn('[Gemini Engine] Time budget used up; using fallback.');
      break;
    }
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...(params.config || {}), abortSignal: AbortSignal.timeout(Math.min(perAttempt, remaining)) },
      });

      if (response?.text) {
        return { text: response.text, modelUsed: model, source: 'llm' };
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Suppress spammy log outputs for transient quota or demand limits
      if (!msg.includes('503') && !msg.includes('quota') && !msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Gemini Engine] Model ${model} returned error: ${msg.slice(0, 100)}`);
      }
      // Continue to next model in candidate chain
    }
  }

  // All LLM models failed: run the caller's keyword fallback and label it
  // honestly as a fallback — never as a neural-engine result.
  return { text: params.fallbackFn(), modelUsed: 'keyword-fallback', source: 'fallback' };
}
