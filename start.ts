/**
 * Railway entry router: one start command for both services.
 *  - Default (no SERVICE_MODE): runs the main Express server (server.ts).
 *  - SERVICE_MODE=voice-agent: runs the LiveKit voice worker (server/voice-agent.ts).
 * Set SERVICE_MODE=voice-agent in the voice worker service's Variables.
 */
const mode = (process.env.SERVICE_MODE || 'server').toLowerCase();

if (mode === 'voice-agent') {
  const { startWorker } = await import('./server/voice-agent.ts');
  startWorker();
} else {
  await import('./server.ts');
}
