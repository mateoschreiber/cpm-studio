import type { Project } from "../core/types";
import elkWorkerURL from 'elkjs/lib/elk-worker.min.js?url';
export async function layoutProject(project: Project): Promise<Project> {
  // Node uses ELK's synchronous worker shim; browsers use an actual local worker.
  const nodeModule='elkjs/lib/elk.bundled.js';
  const module:typeof import('elkjs/lib/elk-api.js') = typeof Worker==='undefined' ? await import(/* @vite-ignore */ nodeModule) : await import('elkjs/lib/elk-api.js');
  const candidate=module.default as unknown;
  const ELK=(typeof candidate==='function'?candidate:(candidate as {default:typeof module.default}).default) as typeof module.default;
  const elk = typeof Worker==='undefined'?new ELK():new ELK({workerFactory:()=>new Worker(elkWorkerURL)});
  try {
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "65",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    },
    children: project.events.map((e) => ({ id: e.id, width: 60, height: 60 })),
    edges: project.activities
      .filter(
        (a) =>
          project.events.some((e) => e.id === a.source) &&
          project.events.some((e) => e.id === a.target),
      )
      .map((a) => ({ id: a.id, sources: [a.source], targets: [a.target] })),
  });
  const next = structuredClone(project);
  for (const node of graph.children ?? [])
    next.visual.nodes[node.id] = { x: node.x ?? 0, y: node.y ?? 0 };
  return next;
  } finally {if(typeof Worker!=='undefined')elk.terminateWorker();}
}
