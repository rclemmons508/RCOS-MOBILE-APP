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
 * 'marketing' | 'support' | 'executive' | 'technician' | 'finance'); the
 * receptionist uses the route_to_representative
 * tool to HAND the call to the right department agent (a real mid-call handoff
 * via the SDK's handoff mechanism). The department agent carries the SAME
 * routing-tool instance as the receptionist, so the SDK can reuse the live
 * Gemini session across the handoff instead of tearing it down and opening a
 * new one; the tool's once-per-call guard still means a transferred call
 * cannot route again. The handoff also carries the conversation history, so
 * the department agent is not amnesiac.
 *
 * Needs in the environment:
 *   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (LiveKit Cloud — free tier works)
 *   GEMINI_API_KEY (same key the Express server already uses)
 *   APP_URL (so the routing tool can log to your own API)
 */
import 'dotenv/config';
import { defineAgent, cli, WorkerOptions, Agent, AgentSession, AgentSessionEventTypes, tool, handoff } from '@livekit/agents';
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
5. When you know the caller's issue, call the route_to_representative tool ONCE
   to transfer the call to the right department. Do NOT say you are transferring
   the caller yourself — the department agent will greet them. After calling
   the tool, say nothing more; the transfer happens automatically. If the
   department agent does not greet the caller, tell them plainly the transfer
   is taking longer than expected, offer to take a message, and never leave
   them on hold in silence.
Keep replies short and speak naturally — this is a phone call, not an email.
Never invent prices, arrival times, or promises. If you do not know, say you will
have the right person call them back.`;

type VoicePersona = 'receptionist' | 'sales' | 'operations' | 'marketing' | 'support' | 'executive' | 'technician' | 'finance';

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
  executive: {
    instructions: `You are the Executive Assistant for RC Solutions, a service business,
talking with the business owner on a voice call. Help with escalations, safety
issues, and owner-level decisions — what needs the owner's call, what can
wait, and what to do next. If something sounds like a safety issue, say so
plainly and escalate right away. Keep replies short and speak naturally —
this is a phone call, not an email. Never invent facts, decisions, or promises
— if you do not know, say you will check.`,
    greeting: 'Greet the caller as the RC Solutions executive assistant and ask what needs your attention.',
    useRoutingTool: false,
  },
  technician: {
    instructions: `You are the Field Technician agent for RC Solutions, a service business,
talking with the business owner on a voice call. Help with Job Pack checklists
— what to check, test, and record on the job — and walk through the safety
steps before work starts. If something sounds unsafe, stop and say so plainly
before anything else. Keep replies short and speak naturally — this is a
phone call, not an email. Never invent job details, readings, or safety
clearances — if you do not know, say you will check.`,
    greeting: 'Greet the caller as the RC Solutions field technician and ask what job you are working on.',
    useRoutingTool: false,
  },
  finance: {
    instructions: `You are the Finance agent for RC Solutions, a service business,
talking with the business owner on a voice call. Help with invoices, balances,
and payments — what is owed, what has been paid, and what to follow up on.
Never invent prices, balances, or payments — if you do not know a number,
say you will check and come back with it. Keep replies short and speak
naturally — this is a phone call, not an email.`,
    greeting: 'Greet the caller as the RC Solutions finance agent and ask what you want to check.',
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
        parsed.persona === 'support' ||
        parsed.persona === 'executive' ||
        parsed.persona === 'technician' ||
        parsed.persona === 'finance'
      ) {
        return parsed.persona;
      }
    } catch { /* not JSON — try the next source */ }
  }
  return 'receptionist';
}

/** Where each routing department lands. Billing and emergency both go to Support: there is no billing persona, and Support's instructions include safety escalation. */
const DEPARTMENT_TO_PERSONA: Record<'sales' | 'support' | 'dispatch' | 'billing' | 'emergency', VoicePersona> = {
  sales: 'sales',
  support: 'support',
  dispatch: 'operations',
  billing: 'support',
  emergency: 'support',
};

/** One-time greeting the department agent speaks the moment it takes over the call. */
function handoffGreeting(
  department: 'sales' | 'support' | 'dispatch' | 'billing' | 'emergency',
  summary: string,
): string {
  const issue = `The caller was just telling the receptionist: ${summary}. Pick up from there — do not make them repeat everything.`;
  switch (department) {
    case 'sales':
      return `Connecting you to Sales now. Hi, this is the Sales agent at RC Solutions. ${issue}`;
    case 'dispatch':
      return `Connecting you to Dispatch now. Hi, this is the Operations agent at RC Solutions. ${issue}`;
    case 'billing':
      return `Connecting you to Support now — they handle billing. Hi, this is the Support agent at RC Solutions. ${issue}`;
    case 'emergency':
      return `Connecting you to Support now — help is being escalated right away. This is the Support agent at RC Solutions. The caller has an emergency: ${summary}. Stay calm, take charge, and tell them plainly what happens next.`;
    case 'support':
    default:
      return `Connecting you to Support now. Hi, this is the Support agent at RC Solutions. ${issue}`;
  }
}

/**
 * An agent that greets the caller the moment it takes over a transferred call.
 * The base Agent's onEnter is a no-op, so without this the department agent
 * would sit silent after a handoff.
 *
 * The department agent is built with the SAME routing-tool instance as the
 * receptionist, passed as a NAMED tool in an ARRAY ([routeTool]): the LiveKit
 * SDK only reuses the live realtime session across a handoff when the two
 * agents' tools are equal by object identity (the Google plugin cannot update
 * tools mid-session), so a different/no toolset would tear the Gemini
 * websocket down and open a brand-new one on every transfer. The object-map
 * form ({ name: tool }) does NOT work here — the SDK spread-copies anonymous
 * tools on every registration, so the two agents would never compare equal.
 * It also gets a copy of the conversation history (minus the receptionist's
 * instructions), so it picks up where the receptionist left off instead of
 * starting amnesiac.
 */
/**
 * Race a promise against a timeout. A realtime generateReply can stall
 * forever (model wedged, websocket hiccup) — without this, a stalled
 * handoff greeting leaves the caller on hold with silence indefinitely
 * (Oct 16, 2026: Ryan waited 5+ minutes). The timeout rejects so the
 * caller always gets a fallback or at least a loud log line.
 */
// generateReply returns a SpeechHandle (thenable, not a full Promise),
// so this accepts PromiseLike.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

class DepartmentAgent extends Agent {
  private handoffGreeting: string;
  constructor(
    instructions: string,
    greeting: string,
    options?: {
      tools?: ConstructorParameters<typeof Agent>[0]['tools'];
      chatCtx?: ConstructorParameters<typeof Agent>[0]['chatCtx'];
    },
  ) {
    super({
      instructions,
      ...(options?.tools ? { tools: options.tools } : {}),
      ...(options?.chatCtx ? { chatCtx: options.chatCtx } : {}),
    });
    this.handoffGreeting = greeting;
  }
  async onEnter() {
    try {
      await withTimeout(this.session.generateReply({ instructions: this.handoffGreeting }), 15000, 'handoff greeting');
      console.log('[voice-agent] handoff succeeded — department agent greeting delivered.');
    } catch (e) {
      // Log, don't rethrow: the session is still alive and the caller can
      // speak; killing the transition here would drop the call.
      console.error('[voice-agent] handoff greeting failed/timed out:', e);
      // One short retry: the caller must hear SOMETHING after a transfer,
      // never silence. If this also fails, the session stays alive and the
      // caller can still speak — and the log line above names the failure.
      try {
        await withTimeout(
          this.session.generateReply({ instructions: 'Say: "You are now connected. How can I help?"' }),
          10000,
          'handoff fallback greeting',
        );
        console.log('[voice-agent] handoff fallback greeting delivered.');
      } catch (e2) {
        console.error('[voice-agent] handoff fallback greeting also failed — caller may hear silence:', e2);
      }
    }
  }
}

/**
 * Fire-and-forget: logs a routing decision to the RCOS API so it shows up in
 * the dashboard. This used to be awaited (up to 8s) BEFORE the handoff,
 * stalling the transfer on a slow log call — it now runs in the background
 * while the handoff proceeds, and a failed log never blocks the call.
 */
function logRoutingDecision(input: {
  department: string;
  summary: string;
  urgency: string;
  callerName?: string;
}): void {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return;
  }
  // Never let a slow log call stall the conversation: give up after 8s.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  fetch(`${appUrl}/api/voice/routing-log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.VOICE_AGENT_SECRET ? { 'x-voice-secret': process.env.VOICE_AGENT_SECRET } : {}),
    },
    body: JSON.stringify({
      department: input.department,
      summary: input.summary,
      urgency: input.urgency,
      callerName: input.callerName || 'Unknown caller',
      at: new Date().toISOString(),
      source: 'webrtc-receptionist',
    }),
    signal: controller.signal,
  })
    .catch((e) => {
      console.warn('[voice-agent] routing log failed:', (e as Error)?.message);
    })
    .finally(() => {
      clearTimeout(timeout);
    });
}

/**
 * Builds the receptionist's transfer tool. One instance per call, so the
 * once-per-call guard below never leaks across calls in the same worker process.
 * The tool logs the routing decision to the RCOS API in the background (the
 * dashboard record is unchanged); it then returns an SDK handoff, which swaps
 * the live session to the department agent — the same agent does NOT keep talking.
 */
function createRouteToRepresentativeTool() {
  let hasTransferred = false;
  // The exact tool instance handed to the receptionist AND to the department
  // agent: the SDK compares tools by identity, so sharing this instance is
  // what lets it reuse the live Gemini session across the handoff. It must
  // be a NAMED tool passed as an ARRAY ([routeTool]) — the object-map form
  // spread-copies anonymous tools per registration and breaks identity.
  const routeTool = tool({
    name: 'route_to_representative',
    description:
      'Transfer the call to the department that should handle the caller\'s issue. Call this once you know the caller\'s issue — the call is handed to the department agent immediately.',
    parameters: z.object({
      department: z
        .enum(['sales', 'support', 'dispatch', 'billing', 'emergency'])
        .describe('Which department owns this issue'),
      summary: z.string().describe('One or two sentences describing the caller\'s issue'),
      urgency: z.enum(['routine', 'urgent', 'emergency']).describe('How urgent this is'),
      callerName: z.string().optional().describe('Caller name if they gave one'),
    }),
    execute: async ({ department, summary, urgency, callerName }, { ctx }) => {
      // At most one transfer per call. The department agent carries this same
      // tool, so this guard is what stops a transferred call routing again.
      if (hasTransferred) {
        return 'Already transferred — stay with the current agent.';
      }
      // Log the routing decision in the background — never awaited, so a slow
      // log call cannot stall the transfer.
      logRoutingDecision({ department, summary, urgency, callerName });
      const persona = DEPARTMENT_TO_PERSONA[department];
      const base = PERSONAS[persona];
      const context =
        `\n\nCall context: you just took over this call from the receptionist. ` +
        `The caller's issue: ${summary}. Urgency: ${urgency}. ` +
        `Do not ask the caller to repeat everything — pick up where the receptionist left off.` +
        (department === 'emergency'
          ? ' This is an emergency escalation — act now, stay calm, and tell the caller plainly what happens next.'
          : '');
      // Carry the conversation history across the handoff (without the
      // receptionist's instructions, which belong to the old agent). If the
      // history cannot be copied, the summary + greeting below still carry
      // the transfer — a history failure must never drop the call.
      let chatCtx: ConstructorParameters<typeof Agent>[0]['chatCtx'];
      try {
        const history = ctx?.session?.history;
        chatCtx = history
          ? history.copy({ excludeInstructions: true, excludeHandoff: true, excludeConfigUpdate: true })
          : undefined;
      } catch (e) {
        console.warn('[voice-agent] could not copy chat history for handoff, continuing with summary only:', (e as Error)?.message);
        chatCtx = undefined;
      }
      console.log(`[voice-agent] handoff starting — department=${department} urgency=${urgency} persona=${persona}`);
      const agent = new DepartmentAgent(
        `${base.instructions}${context}`,
        handoffGreeting(department, summary),
        { tools: [routeTool], chatCtx },
      );
      hasTransferred = true;
      // No `returns` value: the new agent's onEnter greeting is the only speech
      // after the transfer (no tool-output reply from the receptionist).
      // Handoff success is logged by DepartmentAgent.onEnter; handoff failure
      // surfaces via the session 'error' / 'close' listeners in entry.
      return handoff({ agent });
    },
  });
  return routeTool;
}

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
      // Array form: preserves the tool's object identity, which is what the
      // SDK's handoff session-reuse check compares (see DepartmentAgent).
      ...(config.useRoutingTool ? { tools: [createRouteToRepresentativeTool()] } : {}),
    });

    const session = new AgentSession({ llm: model });
    // A realtime-model failure used to end the job silently (the SDK's
    // _onError path) with nothing in the logs. Surface it, plus session
    // closes, so a dropped call always leaves a trace.
    session.on(AgentSessionEventTypes.Error, (ev) => {
      console.error('[voice-agent] session error:', ev.error);
    });
    session.on(AgentSessionEventTypes.Close, (ev) => {
      console.log('[voice-agent] session closed:', ev.reason, ev.error ?? '');
    });
    try {
      await session.start({ agent, room: ctx.room });
    } catch (e) {
      console.error('[voice-agent] session.start failed:', e);
      throw e;
    }
    try {
      await session.generateReply({
        instructions: config.greeting,
      });
    } catch (e) {
      // Log, don't throw: the session is still alive and the caller can speak;
      // a failed greeting must not drop the call.
      console.error('[voice-agent] greeting failed:', e);
    }
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
