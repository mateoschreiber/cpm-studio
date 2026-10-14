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
  startLabel?: { x: number; y: number };
  endLabel?: { x: number; y: number };
}
export type AppView = 'network' | 'resolved' | 'solution' | 'calendar' | 'gantt' | 'resources' | 'report';
export type NodeSize = 'small' | 'normal' | 'large';
export interface VisualModel { nodes: Record<string, {x:number;y:number}>; edges: Record<string, EdgeVisual> }
export interface Presentation {
  resolved?: VisualModel;
  activeView: AppView;
  nodeSize: NodeSize;
  theme: 'system' | 'light' | 'dark';
  motion: boolean;
  timeScale: number;
  rowOrder: string[];
  rowOffsets: Record<string, number>;
  draftRows?: TableRow[];
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
  version: 1 | 2;
  id?: string;
  presentation?: Presentation;
  name: string;
  events: Event[];
  activities: Activity[];
  visual: {
    nodes: Record<string, { x: number; y: number }>;
    edges: Record<string, EdgeVisual>;
  };
  preferences: Preferences;
}
/** Persisted current format, after explicit validation and migration. */
export type ProjectV2 = Project & {version:2;id:string;presentation:Presentation};
export const defaultPresentation = (): Presentation => ({activeView:'network',nodeSize:'normal',theme:'system',motion:true,timeScale:48,rowOrder:[],rowOffsets:{}});
export const nodeRadius = (project: Project) => ({small:23,normal:30,large:40})[project.presentation?.nodeSize ?? 'normal'];
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
