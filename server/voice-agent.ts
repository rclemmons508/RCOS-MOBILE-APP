/**
 * RCOS AI Receptionist — WebRTC voice agent worker.
 *
 * Run separately from the Express server:
 *   npx tsx server/voice-agent.ts
 * (On Railway: deploy as a second service with the same environment variables.)
 *
 * What it does: joins the LiveKit room created by POST /api/voice/token,
 * greets the caller, listens, thinks with Gemini (Live API), speaks back,
 * and uses the route_to_representative tool to record which department
 * should handle the caller's issue.
 *
 * Needs in the environment:
 *   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (LiveKit Cloud — free tier works)
 *   GEMINI_API_KEY (same key the Express server already uses)
 *   APP_URL (so the routing tool can log to your own API)
 */
import 'dotenv/config';
import { defineAgent, cli, WorkerOptions, Agent, AgentSession, tool } from '@livekit/agents';
import { realtime } from '@livekit/agents-plugin-google';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const AGENT_NAME = 'rcos-receptionist';

const INSTRUCTIONS = `You are the friendly AI receptionist for RC Solutions, a service business.
Your job on this call:
1. Greet the caller warmly and ask how you can help.
2. Listen carefully and ask one clarifying question if the issue is unclear.
3. Route the call using this priority order — safety first, then technical, then the rest:
   1. SAFETY (emergency): gas smell, flooding, sparking wires, no heat in freezing
      weather, or anyone in danger. Say so plainly and route to emergency immediately.
   2. Technical: equipment problems needing a specialist diagnosis.
   3. Complex project: multi-step work needing a project manager.
   4. Operational: scheduling, dispatch, job status updates.
   5. Client-facing: questions, complaints, follow-ups.
   6. Administrative: billing questions go to billing; anything else goes to support.
4. Escalate right away when: the caller sounds frustrated, you are missing information
   and cannot proceed, or anything looks like a safety issue. Never leave an urgent
   caller hanging — tell them plainly what happens next.
5. Use the route_to_representative tool to record the routing, then tell the caller
   who will help them and what happens next.
Keep replies short and speak naturally — this is a phone call, not an email.
Never invent prices, arrival times, or promises. If you do not know, say you will
have the right person call them back.`;

const routeToRepresentative = tool({
  description:
    'Record which department should handle the caller and why. Call this once you know the caller\'s issue.',
  parameters: z.object({
    department: z
      .enum(['sales', 'support', 'dispatch', 'billing', 'emergency'])
      .describe('Which department owns this issue'),
    summary: z.string().describe('One or two sentences describing the caller\'s issue'),
    urgency: z.enum(['routine', 'urgent', 'emergency']).describe('How urgent this is'),
    callerName: z.string().optional().describe('Caller name if they gave one'),
  }),
  execute: async ({ department, summary, urgency, callerName }) => {
    // Log the routing decision to the RCOS API so it shows up in the dashboard.
    try {
      const appUrl = process.env.APP_URL;
      if (appUrl) {
        await fetch(`${appUrl}/api/voice/routing-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.VOICE_AGENT_SECRET ? { 'x-voice-secret': process.env.VOICE_AGENT_SECRET } : {}),
          },
          body: JSON.stringify({
            department,
            summary,
            urgency,
            callerName: callerName || 'Unknown caller',
            at: new Date().toISOString(),
            source: 'webrtc-receptionist',
          }),
        });
      }
    } catch (e) {
      console.warn('[voice-agent] routing log failed:', (e as Error)?.message);
    }
    return `Recorded: route to ${department} (${urgency}). Summary: ${summary}`;
  },
});

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    const model = new realtime.RealtimeModel({
      apiKey: process.env.GEMINI_API_KEY,
      voice: 'Kore',
      instructions: INSTRUCTIONS,
    });

    const agent = new Agent({
      instructions: INSTRUCTIONS,
      tools: { route_to_representative: routeToRepresentative },
    });

    const session = new AgentSession({ llm: model });
    await session.start({ agent, room: ctx.room });
    await session.generateReply({
      instructions: 'Greet the caller as the RC Solutions receptionist and ask how you can help.',
    });
  },
});

// Receives the routed call's business id via the room metadata set in /api/voice/token.
export function startWorker() {
  // cli.runApp() parses process.argv for a subcommand (start/dev/connect).
  // When launched via start.ts (`tsx start.ts`) there is no subcommand, so the
  // CLI only prints its help text and exits — the worker never runs. Default
  // to 'start' so Railway actually launches the production worker.
  if (process.argv.length < 3) {
    process.argv.push('start');
  }
  console.log('[voice-agent] starting LiveKit worker (agent: rcos-receptionist)...');
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startWorker();
}
