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
}): Promise<{ text: string; modelUsed: string }> {
  // If API key is missing, immediately use the resilient offline engine
  if (!hasValidApiKey) {
    return { text: params.fallbackFn(), modelUsed: 'rcos-neural-engine' };
  }

  const modelsToTry = params.preferredModel 
    ? [params.preferredModel, ...CANDIDATE_MODELS.filter(m => m !== params.preferredModel)]
    : CANDIDATE_MODELS;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      if (response?.text) {
        return { text: response.text, modelUsed: model };
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

  // Gracefully fallback without crashing
  return { text: params.fallbackFn(), modelUsed: 'rcos-neural-engine' };
}
