import { generateAOA } from "../core/generate";
import type { ComputeRequest, ComputeResponse } from "../services/jobs";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ComputeRequest>) => void) | null;
  postMessage: (response: ComputeResponse) => void;
};
scope.onmessage = async ({ data }) => {
  if (!data || !Number.isSafeInteger(data.id)) return;
  try {
    let project;
    if (data.kind === "generate") {
      project = generateAOA(data.rows, data.previous);
      if (!data.previous?.events.length) {
        const { layoutProject } = await import("../services/layout");
        project = await layoutProject(project);
      }
    } else if (data.kind === "layout") {
      const { layoutProject } = await import("../services/layout");
      project = await layoutProject(data.project);
    } else {
      throw new Error("Operación de cálculo desconocida");
    }
    scope.postMessage({ id: data.id, project });
  } catch (error) {
    scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
