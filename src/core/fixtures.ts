import {
  emptyProject,
  defaultEdgeVisual,
  type Project,
  type TableRow,
} from "./types";
export const guideRows: TableRow[] = [
  { id: "A", name: "A", predecessors: [], duration: 8, resources: 5 },
  { id: "B", name: "B", predecessors: [], duration: 4, resources: 4 },
  { id: "C", name: "C", predecessors: ["A"], duration: 5, resources: 3 },
  { id: "D", name: "D", predecessors: ["A", "B"], duration: 3, resources: 2 },
  { id: "E", name: "E", predecessors: ["C", "D"], duration: 2, resources: 6 },
];
export function guideProject(): Project {
  const p = emptyProject();
  p.name = "Ejercicio guía · 5 actividades";
  p.events = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    label: String(i),
  }));
  const links = [
    ["A", "0", "1"],
    ["B", "0", "2"],
    ["f1", "1", "2"],
    ["C", "1", "3"],
    ["D", "2", "3"],
    ["E", "3", "4"],
  ];
  p.activities = links.map(([id, source, target]) => {
    const row = guideRows.find((a) => a.id === id);
    return {
      id,
      name: id,
      source,
      target,
      duration: row?.duration ?? 0,
      resources: row?.resources ?? 0,
      dummy: !row,
    };
  });
  p.visual.nodes = {
    "0": { x: 60, y: 190 },
    "1": { x: 290, y: 60 },
    "2": { x: 290, y: 320 },
    "3": { x: 550, y: 190 },
    "4": { x: 790, y: 190 },
  };
  p.visual.edges = Object.fromEntries(
    p.activities.map((a) => [a.id, defaultEdgeVisual()]),
  );
  return p;
}
export const fourteenRows: TableRow[] = [
  ["A", "", 3],
  ["B", "A", 2],
  ["C", "B,F", 4],
  ["D", "C,G", 1],
  ["E", "D,H,J", 3],
  ["F", "", 5],
  ["G", "A", 7],
  ["H", "B,F", 4],
  ["I", "C,G", 2],
  ["J", "", 3],
  ["K", "A", 5],
  ["L", "E,I,K", 7],
  ["M", "D,H,J", 8],
  ["N", "", 4],
].map(([id, pre, duration]) => ({
  id: String(id),
  name: String(id),
  predecessors: String(pre) ? String(pre).split(",") : [],
  duration: Number(duration),
  resources: 0,
}));
