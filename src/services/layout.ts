import type { Project } from "../core/types";
export async function layoutProject(project: Project): Promise<Project> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
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
}
