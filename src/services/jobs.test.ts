import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../core/types";
import { cancelJobs, generateInWorker, layoutInWorker, type ComputeRequest, type ComputeResponse } from "./jobs";

class FakeWorker {
  static instances: FakeWorker[] = [];
  request?: ComputeRequest;
  terminated = false;
  onmessage?: (event: { data: ComputeResponse }) => void;
  onerror?: (event: { message: string }) => void;
  onmessageerror?: () => void;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(request: ComputeRequest) { this.request = request; }
  terminate() { this.terminated = true; }
  reply(response: ComputeResponse) { this.onmessage?.({ data: response }); }
}
beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => { cancelJobs(); vi.unstubAllGlobals(); });

describe("browser compute job lifecycle", () => {
  it("terminates a completed worker and returns its project", async () => {
    const project = emptyProject();
    const result = generateInWorker([], project);
    const worker = FakeWorker.instances[0];
    expect(worker.request?.kind).toBe("generate");
    worker.reply({ id: worker.request!.id, project });
    await expect(result).resolves.toEqual(project);
    expect(worker.terminated).toBe(true);
  });
  it("superseding a job cancels it and ignores stale request identifiers", async () => {
    const project = emptyProject();
    const first = generateInWorker([]);
    const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
    const old = FakeWorker.instances[0];
    const second = layoutInWorker(project);
    await cancelled;
    expect(old.terminated).toBe(true);
    old.reply({ id: old.request!.id, project });
    const current = FakeWorker.instances[1];
    current.reply({ id: old.request!.id, error: "stale" });
    expect(current.terminated).toBe(false);
    current.reply({ id: current.request!.id, project });
    await expect(second).resolves.toEqual(project);
  });
  it("reports worker errors and releases the worker", async () => {
    const result = layoutInWorker(emptyProject());
    const worker = FakeWorker.instances[0];
    worker.onerror?.({ message: "falló ELK" });
    await expect(result).rejects.toThrow("falló ELK");
    expect(worker.terminated).toBe(true);
  });
  it("explicit cancellation aborts the running operation", async () => {
    const result = layoutInWorker(emptyProject());
    const cancelled = expect(result).rejects.toMatchObject({ name: "AbortError" });
    cancelJobs();
    await cancelled;
    expect(FakeWorker.instances[0].terminated).toBe(true);
    cancelJobs();
  });
  it("surfaces mathematical validation failures from the worker", async () => {
    const result = generateInWorker([]);
    const worker = FakeWorker.instances[0];
    worker.reply({ id: worker.request!.id, error: "La red contiene un ciclo" });
    await expect(result).rejects.toThrow("La red contiene un ciclo");
    expect(worker.terminated).toBe(true);
  });
});
