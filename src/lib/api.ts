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

/**
 * Production HTTP client with timeout, auth token injection, and structured error handling.
 */
export async function apiFetch<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Firebase Auth token if authenticated
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    }
  } catch {
    // Non-blocking token retrieval error
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

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
      return {} as T;
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your network connection.', 408, 'Timeout');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err?.message || 'Network request failed', 0, 'NetworkError');
  }
}
