import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export const PRIMARY_MODEL = 'gemini-2.5-flash';
export const FAST_MODEL = 'gemini-2.5-flash';
export const PRO_MODEL = 'gemini-3.8-flash';

export const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview'
];

export async function executeGeminiWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
  fallbackFn: () => string;
}): Promise<{ text: string; modelUsed: string }> {
  const modelsToTry = params.preferredModel 
    ? [params.preferredModel, ...CANDIDATE_MODELS.filter(m => m !== params.preferredModel)]
    : CANDIDATE_MODELS;

  let lastErr: any = null;

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
      lastErr = err;
      const msg = err?.message || '';
      console.warn(`[Gemini Engine] Model ${model} unavailable: ${msg.slice(0, 120)}`);
      // Continue to next model in candidate chain
    }
  }

  console.warn('[Gemini Engine] Upstream model demand spike or quota reached. Executing RCOS resilient fallback.');
  return { text: params.fallbackFn(), modelUsed: 'rcos-neural-engine' };
}
