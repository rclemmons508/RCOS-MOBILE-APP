import { createRequire } from 'node:module';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not catch rejected promises from async route handlers:
// an `await` that throws (or a sync throw after the first await) becomes an
// unhandled rejection, and Node 22 exits the process on those (audit #4).
//
// installAsyncErrorRouting() patches Express 4's internal Layer so that a
// handler returning a rejected promise is forwarded to next(err) — the same
// path a synchronous throw already takes. It is installed once, before any
// route is registered, and covers every app/router (including the Twilio and
// Gmail OAuth routers) without touching each handler. The final JSON error
// middleware in server.ts then answers 500 instead of the process dying.
//
// asyncHandler() is the explicit per-route wrapper for any code that wants
// it (e.g. if Express is upgraded and the Layer patch is dropped).

let installed = false;

export function installAsyncErrorRouting(): void {
  if (installed) return;
  const require = createRequire(import.meta.url);
  // Resolve the Layer from the SAME express copy server.ts imports.
  const expressMain = require.resolve('express');
  const layerPath = expressMain.replace(/index\.js$/, 'lib/router/layer.js');
  const Layer = require(layerPath);
  if (!Layer?.prototype?.handle_request) {
    console.error('[async-errors] Express Layer not found — async route errors are NOT routed to the error handler.');
    return;
  }
  Layer.prototype.handle_request = function handleRequestAsyncSafe(req: Request, res: Response, next: NextFunction) {
    const fn = this.handle;
    if (fn.length > 3) {
      // Error-handling middleware (4 args) is not a request handler.
      return next();
    }
    try {
      const out = fn(req, res, next);
      if (out && typeof (out as Promise<unknown>).then === 'function') {
        (out as Promise<unknown>).then(undefined, (err: unknown) => next(err ?? new Error('Async handler rejected')));
      }
    } catch (err) {
      next(err);
    }
  };
  installed = true;
}

export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    try {
      const out = (fn as any)(req, res, next);
      if (out && typeof out.then === 'function') out.then(undefined, next);
    } catch (err) {
      next(err);
    }
  };
}

// Process-level backstops: log instead of letting one stray rejection take
// the whole server down. An uncaught exception leaves the process in an
// unknown state, so it is logged loudly but the server keeps serving —
// Railway restarts it only if it actually dies.
let processHandlersInstalled = false;
export function installProcessErrorLoggers(): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;
  process.on('unhandledRejection', (reason) => {
    console.error('[process] Unhandled promise rejection (kept running):', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[process] Uncaught exception (kept running):', err);
  });
}
