/**
 * RCOS AI Receptionist — WebRTC voice agent worker.
 *
 * Run separately from the Express server:
 *   npx tsx server/voice-agent.ts
 * (On Railway: deploy as a second service with the same environment variables.)
 *
 * What it does: joins the LiveKit room created by POST /api/voice/token,
 * greets the caller, listens, thinks with Gemini (Live API), speaks back.
 * The room metadata carries a persona ('receptionist' | 'sales' | 'operations' |
 * 'marketing' | 'support'); the receptionist uses the route_to_representative
 * tool to record which department should handle the caller's issue, while the
 * four team agents are conversation-only (no tools).
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

type VoicePersona = 'receptionist' | 'sales' | 'operations' | 'marketing' | 'support';

const PERSONAS: Record<VoicePersona, { instructions: string; greeting: string; useRoutingTool: boolean }> = {
  receptionist: {
    instructions: INSTRUCTIONS,
    greeting: 'Greet the caller as the RC Solutions receptionist and ask how you can help.',
    useRoutingTool: true,
  },
  sales: {
    instructions: `You are the Sales agent for RC Solutions, a service business, talking
with the business owner on a voice call. Help with quotes, pricing questions,
and following up with leads. You can draft a quote for the owner to review, but
never invent prices — if you do not know a price, say you will check and come
back with it. Keep replies short and speak naturally — this is a phone call,
not an email. Never invent prices, arrival times, or promises.`,
    greeting: 'Greet the caller as the RC Solutions sales agent and ask what you are working on.',
    useRoutingTool: false,
  },
  operations: {
    instructions: `You are the Operations agent for RC Solutions, a service business,
talking with the business owner on a voice call. Talk through today's jobs,
scheduling, dispatching, and job status. Help the owner plan the day and sort
out scheduling problems. Keep replies short and speak naturally — this is a
phone call, not an email. Never invent arrival times, job details, or promises
— if you do not know, say you will check.`,
    greeting: 'Greet the caller as the RC Solutions operations agent and ask what you need to sort out.',
    useRoutingTool: false,
  },
  marketing: {
    instructions: `You are the Marketing agent for RC Solutions, a service business,
talking with the business owner on a voice call. Help with promotions, review
requests, customer outreach ideas, and social media posts. Anything you draft
is for the owner to review before it goes out. Keep replies short and speak
naturally — this is a phone call, not an email. Never invent offers, discounts,
or promises.`,
    greeting: 'Greet the caller as the RC Solutions marketing agent and ask what you want to promote.',
    useRoutingTool: false,
  },
  support: {
    instructions: `You are the Support agent for RC Solutions, a service business,
talking with the business owner on a voice call. Help with customer issues,
complaints, troubleshooting, and follow-ups. Stay calm and helpful, and work
through the problem one step at a time. Escalate right away when something
sounds like a safety issue — tell the owner plainly what happens next. Keep
replies short and speak naturally — this is a phone call, not an email. Never
invent fixes, arrival times, or promises — if you do not know, say you will
check.`,
    greeting: 'Greet the caller as the RC Solutions support agent and ask how you can help.',
    useRoutingTool: false,
  },
};

/** Persona comes from the room metadata set by POST /api/voice/token; anything unknown falls back to receptionist. */
function personaFromMetadata(roomMetadata: unknown, jobMetadata: unknown): VoicePersona {
  for (const raw of [roomMetadata, jobMetadata]) {
    try {
      const parsed = JSON.parse(typeof raw === 'string' ? raw : '{}') as { persona?: unknown };
      if (
        parsed.persona === 'sales' ||
        parsed.persona === 'operations' ||
        parsed.persona === 'marketing' ||
        parsed.persona === 'support'
      ) {
        return parsed.persona;
      }
    } catch { /* not JSON — try the next source */ }
  }
  return 'receptionist';
}

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
        // Never let a slow log call stall the conversation: give up after 8s.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
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
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
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
    // Wait until the caller has actually joined before saying anything.
    // Greeting immediately can play to an empty room, so the caller hears silence.
    await ctx.waitForParticipant();

    const persona = personaFromMetadata(
      (ctx.room as unknown as { metadata?: unknown }).metadata,
      (ctx as unknown as { job?: { metadata?: unknown } }).job?.metadata
    );
    const config = PERSONAS[persona];

    const model = new realtime.RealtimeModel({
      apiKey: process.env.GEMINI_API_KEY,
      voice: 'Kore',
      instructions: config.instructions,
    });

    const agent = new Agent({
      instructions: config.instructions,
      ...(config.useRoutingTool ? { tools: { route_to_representative: routeToRepresentative } } : {}),
    });

    const session = new AgentSession({ llm: model });
    await session.start({ agent, room: ctx.room });
    await session.generateReply({
      instructions: config.greeting,
    });
  },
});

// Receives the routed call's business id + persona via the room metadata set in /api/voice/token.
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
