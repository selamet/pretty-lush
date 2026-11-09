// Main-thread client of the regex worker: one request in flight at a time,
// with a hard timeout. A pattern with catastrophic backtracking blocks the
// worker's thread forever, so on timeout (or when a newer request supersedes
// a pending one) the worker is terminated and a fresh one is created for the
// next run. `createWorker` is injected so this runs under Node tests.

// Time a single run may take once the worker has started it.
export const REGEX_TIMEOUT_MS = 500;
// Time allowed for a (new) worker to load and pick up the request.
export const REGEX_STARTUP_TIMEOUT_MS = 10_000;

/**
 * @param {object} opts
 * @param {() => Worker} opts.createWorker
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.startupTimeoutMs]
 * @param {Function} [opts.setTimer]   setTimeout stand-in (tests)
 * @param {Function} [opts.clearTimer] clearTimeout stand-in (tests)
 * @returns {{ run(request): Promise<object>, dispose(): void }}
 *   `run` resolves with the worker's result message, or with
 *   `{ status: "timeout" }`, `{ status: "cancelled" }` (superseded or
 *   disposed) or `{ status: "error", error }` (worker crashed). It never
 *   rejects.
 */
export function createRegexRunner({
  createWorker,
  timeoutMs = REGEX_TIMEOUT_MS,
  startupTimeoutMs = REGEX_STARTUP_TIMEOUT_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
}) {
  let worker = null;
  let pending = null; // { id, resolve, timer }
  let seq = 0;

  function terminate() {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  }

  function settle(result) {
    const p = pending;
    if (!p) return;
    pending = null;
    clearTimer(p.timer);
    p.resolve({ id: p.id, ...result });
  }

  function arm(ms) {
    const p = pending;
    clearTimer(p.timer);
    p.timer = setTimer(() => {
      if (pending !== p) return;
      terminate();
      settle({ status: "timeout" });
    }, ms);
  }

  function onMessage(e) {
    const data = e?.data;
    if (!pending || data?.id !== pending.id) return;
    if (data.type === "started") arm(timeoutMs);
    else settle(data);
  }

  function onError(e) {
    if (!pending) return;
    terminate();
    settle({ status: "error", error: e?.message || "Regex worker failed" });
  }

  function ensureWorker() {
    if (!worker) {
      worker = createWorker();
      worker.onmessage = onMessage;
      worker.onerror = onError;
    }
    return worker;
  }

  return {
    run(request) {
      if (pending) {
        // The previous run may be stuck: don't queue behind it.
        terminate();
        settle({ status: "cancelled" });
      }
      const id = ++seq;
      return new Promise((resolve) => {
        pending = { id, resolve, timer: null };
        arm(startupTimeoutMs);
        try {
          ensureWorker().postMessage({ ...request, id });
        } catch (e) {
          terminate();
          settle({ status: "error", error: e?.message || "Couldn’t start the regex worker" });
        }
      });
    },
    dispose() {
      settle({ status: "cancelled" });
      terminate();
    },
  };
}
