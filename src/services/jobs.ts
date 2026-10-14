import type { Project, TableRow } from "../core/types";

export type ComputeRequest =
  | { id: number; kind: "generate"; rows: TableRow[]; previous?: Project }
  | { id: number; kind: "layout"; project: Project };
export type ComputeResponse =
  | { id: number; project: Project; error?: never }
  | { id: number; error: string; project?: never };

interface ActiveJob {
  worker: Worker;
  reject: (reason: Error) => void;
}
let active: ActiveJob | undefined;
let sequence = 0;

/** A terminated worker cannot commit a late result or keep ELK consuming CPU. */
export function cancelJobs(): void {
  const job = active;
  if (!job) return;
  active = undefined;
  job.worker.terminate();
  job.reject(new DOMException("Operación cancelada", "AbortError"));
}

function run(request: ComputeRequest): Promise<Project> {
  cancelJobs();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/compute.worker.ts", import.meta.url), { type: "module" });
    const job: ActiveJob = { worker, reject };
    active = job;
    const finish = () => {
      worker.terminate();
      if (active === job) active = undefined;
    };
    worker.onmessage = (event: MessageEvent<ComputeResponse>) => {
      if (active !== job || event.data.id !== request.id) return;
      finish();
      if (event.data.error !== undefined) reject(new Error(event.data.error));
      else if (event.data.project) resolve(event.data.project);
      else reject(new Error("El cálculo no devolvió un proyecto válido"));
    };
    worker.onerror = (event) => {
      if (active !== job) return;
      finish();
      reject(new Error(event.message || "No se pudo ejecutar el cálculo en segundo plano"));
    };
    worker.onmessageerror = () => {
      if (active !== job) return;
      finish();
      reject(new Error("No se pudo leer el resultado del cálculo"));
    };
    try {
      worker.postMessage(request);
    } catch (error) {
      finish();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function generateInWorker(rows: TableRow[], previous?: Project): Promise<Project> {
  return run({ id: ++sequence, kind: "generate", rows, previous });
}
export function layoutInWorker(project: Project): Promise<Project> {
  return run({ id: ++sequence, kind: "layout", project });
}
