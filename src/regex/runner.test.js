import { describe, it, expect } from "vitest";
import { createRegexRunner } from "./runner.js";
import { handleRegexMessage, startedMessage } from "./core.js";

// Fake timers: `fire()` runs every pending callback.
function fakeTimers() {
  const timers = new Map();
  let next = 0;
  return {
    setTimer: (fn, ms) => {
      timers.set(++next, { fn, ms });
      return next;
    },
    clearTimer: (id) => timers.delete(id),
    pending: () => [...timers.values()].map((t) => t.ms),
    fire: () => {
      const fns = [...timers.values()].map((t) => t.fn);
      timers.clear();
      fns.forEach((fn) => fn());
    },
  };
}

// Fake worker driven by the real protocol. `mode`: "ok" answers right away,
// "hang" acknowledges the start and never answers (catastrophic pattern),
// "silent" never even starts.
function fakeWorkers(initialMode = "ok") {
  const created = [];
  const factory = { created, mode: initialMode };
  const createWorker = () => {
    const w = {
      terminated: false,
      posted: [],
      onmessage: null,
      onerror: null,
      terminate() {
        this.terminated = true;
      },
      postMessage(data) {
        this.posted.push(data);
        if (w.mode === "silent") return;
        queueMicrotask(() => {
          if (w.terminated) return;
          w.onmessage?.({ data: startedMessage(data) });
          if (w.mode === "ok") w.onmessage?.({ data: handleRegexMessage(data) });
        });
      },
      mode: factory.mode,
    };
    created.push(w);
    return w;
  };
  factory.createWorker = createWorker;
  return factory;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createRegexRunner", () => {
  it("resolves with the worker's result and reuses the worker", async () => {
    const timers = fakeTimers();
    const { created, createWorker } = fakeWorkers("ok");
    const runner = createRegexRunner({ createWorker, ...timers });
    const r1 = await runner.run({ pattern: "a", flags: "g", text: "aa" });
    expect(r1).toMatchObject({ type: "result", status: "ok" });
    expect(r1.matches).toHaveLength(2);
    const r2 = await runner.run({ pattern: "(", flags: "", text: "" });
    expect(r2.status).toBe("error");
    expect(created).toHaveLength(1);
    expect(timers.pending()).toEqual([]);
  });

  it("switches from the startup timeout to the run timeout once started", async () => {
    const timers = fakeTimers();
    const { createWorker } = fakeWorkers("hang");
    const runner = createRegexRunner({ createWorker, timeoutMs: 500, startupTimeoutMs: 9000, ...timers });
    runner.run({ pattern: "a", text: "a" });
    expect(timers.pending()).toEqual([9000]);
    await flush();
    expect(timers.pending()).toEqual([500]);
  });

  it("terminates a hung worker on timeout and recreates it for the next run", async () => {
    const timers = fakeTimers();
    const factory = fakeWorkers("hang");
    const { created, createWorker } = factory;
    const runner = createRegexRunner({ createWorker, ...timers });
    const p = runner.run({ pattern: "(a+)+$", text: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab" });
    await flush();
    timers.fire();
    expect(await p).toMatchObject({ status: "timeout" });
    expect(created[0].terminated).toBe(true);

    // The next run gets a brand-new worker.
    factory.mode = "ok";
    const next = await runner.run({ pattern: "b", flags: "g", text: "ab" });
    expect(created).toHaveLength(2);
    expect(next).toMatchObject({ status: "ok" });
    expect(next.matches).toHaveLength(1);
  });

  it("cancels a pending run when a newer one starts", async () => {
    const timers = fakeTimers();
    const { created, createWorker } = fakeWorkers("silent");
    const runner = createRegexRunner({ createWorker, ...timers });
    const first = runner.run({ pattern: "a", text: "a" });
    const second = runner.run({ pattern: "a", text: "a" });
    expect(await first).toMatchObject({ id: 1, status: "cancelled" });
    expect(created[0].terminated).toBe(true);
    expect(created).toHaveLength(2);
    runner.dispose();
    expect(await second).toMatchObject({ id: 2, status: "cancelled" });
    expect(created[1].terminated).toBe(true);
  });

  it("ignores stale messages and reports worker errors", async () => {
    const timers = fakeTimers();
    const { created, createWorker } = fakeWorkers("silent");
    const runner = createRegexRunner({ createWorker, ...timers });
    const p = runner.run({ pattern: "a", text: "a" });
    created[0].onmessage({ data: { id: 999, type: "result", status: "ok" } });
    created[0].onerror({ message: "boom" });
    expect(await p).toMatchObject({ status: "error", error: "boom" });
    expect(created[0].terminated).toBe(true);
  });

  it("reports a worker that can't be created", async () => {
    const runner = createRegexRunner({
      createWorker: () => {
        throw new Error("Workers unavailable");
      },
      ...fakeTimers(),
    });
    expect(await runner.run({ pattern: "a", text: "a" })).toMatchObject({
      status: "error",
      error: "Workers unavailable",
    });
  });
});
