export interface Event {
  id: string;
  label: string;
}
export interface Activity {
  id: string;
  name: string;
  source: string;
  target: string;
  duration: number;
  resources: number;
  dummy: boolean;
}
export interface EdgeVisual {
  kind: "straight" | "curve" | "segments";
  bend: number;
  labelX: number;
  labelY: number;
  color: string;
  width: number;
  points?: { x: number; y: number }[];
}
export interface Preferences {
  grid: boolean;
  snap: boolean;
  showLabels: boolean;
  showDates: boolean;
  highlight: boolean;
  criticalColor: string;
}
export interface Project {
  version: 1;
  name: string;
  events: Event[];
  activities: Activity[];
  visual: {
    nodes: Record<string, { x: number; y: number }>;
    edges: Record<string, EdgeVisual>;
  };
  preferences: Preferences;
}
export interface TableRow {
  id: string;
  name: string;
  predecessors: string[];
  duration: number;
  resources: number;
}
export interface Metrics {
  mt: number;
  ml: number;
  mi: number;
  critical: boolean;
  es: number;
  ef: number;
  ls: number;
  lf: number;
}
export interface CPMResult {
  duration: number;
  events: Record<string, { early: number; late: number }>;
  activities: Record<string, Metrics>;
  logical: Record<string, Metrics>;
}
/** Absolute tolerance for arithmetic round-off; durations otherwise retain full precision. */
export const EPSILON = 1e-9;
export function defaultEdgeVisual(): EdgeVisual {
  return {
    kind: "straight",
    bend: 0,
    labelX: 0,
    labelY: 0,
    color: "#64748b",
    width: 2,
  };
}
export function emptyProject(): Project {
  return {
    version: 1,
    name: "Proyecto sin título",
    events: [],
    activities: [],
    visual: { nodes: {}, edges: {} },
    preferences: {
      grid: true,
      snap: true,
      showLabels: true,
      showDates: true,
      highlight: true,
      criticalColor: "#ef4444",
    },
  };
}
