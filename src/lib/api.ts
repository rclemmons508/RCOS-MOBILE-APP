import { buildApiUrl } from '../config/api';
import { auth } from './firebase';

export interface ApiOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: any;

  constructor(message: string, status: number, statusText: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/** Email of the app's active local session (authService's store), lowercased; '' when none. */
function activeSessionEmail(): string {
  try {
    const raw = localStorage.getItem('rcos_active_session');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.email === 'string' ? parsed.email.trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * Production HTTP client with timeout, auth token injection, and structured error handling.
 */
export async function apiFetch<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const timeoutMs = options.timeoutMs || 15000;
  const { timeoutMs: _timeoutMs, signal: callerSignal, ...fetchOptions } = options;
  // One controller aborts the request on EITHER the timeout or the
  // caller's own signal (unmount, superseded search), so callers can cancel.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }
  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  };

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Firebase Auth token if authenticated — but never a token for a
  // different person than the app's active session (e.g. a stale Firebase
  // user left over from a previous operator).
  try {
    const currentUser = auth.currentUser;
    const sessionEmail = activeSessionEmail();
    const tokenMatchesSession =
      !sessionEmail || (currentUser?.email || '').toLowerCase() === sessionEmail;
    if (currentUser && tokenMatchesSession) {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    }
  } catch {
    // Non-blocking token retrieval error
  }

  try {
    if (controller.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });

    cleanup();

    if (!res.ok) {
      let errorBody: any = null;
      try {
        errorBody = await res.json();
      } catch {
        // Response was not JSON
      }
      const message = errorBody?.error || errorBody?.message || `Request failed with status ${res.status}`;
      throw new ApiError(message, res.status, res.statusText, errorBody);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return await res.json();
  } catch (err: any) {
    cleanup();
    if (err?.name === 'AbortError') {
      if (!timedOut && callerSignal?.aborted) {
        // Cancelled by the caller: not a network problem, nothing to show.
        throw new ApiError('Request cancelled.', 0, 'Aborted');
      }
      throw new ApiError('Request timed out. Please check your network connection.', 408, 'Timeout');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err?.message || 'Network request failed', 0, 'NetworkError');
  }
}
