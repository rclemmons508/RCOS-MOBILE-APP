import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { execSync } from 'node:child_process';

/**
 * Build marker: a value that changes on every release build. The app
 * clears the saved session when the stored marker differs, so a new APK
 * always starts at the login screen — never already logged in as
 * anyone. The marker is automatic, not a manual bump: CI sets
 * GITHUB_SHA for every run, so every merge (every new build) gets a new
 * marker. Local builds fall back to the git HEAD commit; without git, a
 * stable 'dev-local' marker (local builds are not release builds).
 */
function buildId(): string {
  const fromCi = (process.env.GITHUB_SHA || '').trim();
  if (fromCi) return fromCi;
  try {
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (head) return head;
  } catch { /* not a git checkout */ }
  return 'dev-local';
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId()),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
