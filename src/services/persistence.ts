import type { Project, ProjectV2 } from "../core/types";

export const STORAGE_KEY = "cpm-studio.project.v1";
const dangerous = new Set(["__proto__", "constructor", "prototype"]);
const fail = (): never => {
  throw new Error("Archivo de proyecto inválido o incompatible.");
};
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const identifier = (x: unknown): x is string =>
  typeof x === "string" && x.length > 0 && !dangerous.has(x);
const point = (x: unknown) => record(x) && finite(x.x) && finite(x.y);
const color = (x: unknown) =>
  typeof x === "string" &&
  /^#[0-9a-f]{3,8}$/i.test(x) &&
  [4, 5, 7, 9].includes(x.length);

/** Schema checks are separate from CPM validation: an unfinished graph may be saved. */
export function parseProject(text: string): Project {
  const raw: unknown = JSON.parse(text, (key, value) => {
    if (dangerous.has(key)) fail();
    return value;
  });
  if (
    !record(raw) ||
    (raw.version !== 1 && raw.version !== 2) ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.events) ||
    !Array.isArray(raw.activities) ||
    !record(raw.visual) ||
    !record(raw.visual.nodes) ||
    !record(raw.visual.edges) ||
    !record(raw.preferences)
  )
    throw new Error("Archivo de proyecto inválido o incompatible.");
  const p = raw as {
    events: unknown[];
    activities: unknown[];
    visual: { nodes: Record<string, unknown>; edges: Record<string, unknown> };
    preferences: Record<string, unknown>;
  };
  const nodes = new Set<string>(),
    edges = new Set<string>();
  for (const e of p.events) {
    if (
      !record(e) ||
      !identifier(e.id) ||
      typeof e.label !== "string" ||
      nodes.has(e.id)
    )
      throw new Error("Suceso inválido o duplicado.");
    nodes.add(e.id);
  }
  for (const a of p.activities) {
    if (
      !record(a) ||
      !identifier(a.id) ||
      edges.has(a.id) ||
      typeof a.name !== "string" ||
      !identifier(a.source) ||
      !identifier(a.target) ||
      !nodes.has(a.source) ||
      !nodes.has(a.target) ||
      !finite(a.duration) ||
      a.duration < 0 ||
      !finite(a.resources) ||
      a.resources < 0 ||
      !Number.isInteger(a.resources) ||
      typeof a.dummy !== "boolean" ||
      (a.dummy && (a.duration !== 0 || a.resources !== 0))
    )
      throw new Error("Actividad inválida o duplicada.");
    edges.add(a.id);
  }
  for (const [id, pos] of Object.entries(p.visual.nodes)) {
    if (!nodes.has(id) || !point(pos)) fail();
  }
  for (const id of nodes) if (!Object.hasOwn(p.visual.nodes, id)) fail();
  for (const [id, v] of Object.entries(p.visual.edges)) {
    if (
      !edges.has(id) ||
      !record(v) ||
      !["straight", "curve", "segments"].includes(String(v.kind)) ||
      !finite(v.bend) ||
      !finite(v.labelX) ||
      !finite(v.labelY) ||
      !color(v.color) ||
      !finite(v.width) ||
      v.width <= 0 ||
      v.width > 30 ||
      (v.points !== undefined &&
        (!Array.isArray(v.points) || !v.points.every(point))) ||
      (v.startLabel !== undefined && !point(v.startLabel)) ||
      (v.endLabel !== undefined && !point(v.endLabel))
    )
      fail();
  }
  for (const id of edges) if (!Object.hasOwn(p.visual.edges, id)) fail();
  for (const key of ["grid", "snap", "showLabels", "showDates", "highlight"])
    if (typeof p.preferences[key] !== "boolean") fail();
  if (!color(p.preferences.criticalColor)) fail();
  if (raw.id !== undefined && !identifier(raw.id)) fail();
  if (raw.version === 2 && (!identifier(raw.id) || !record(raw.presentation))) fail();
  if (raw.presentation !== undefined) {
    const v = raw.presentation;
    if (!record(v)) return fail();
    if (!["network", "resolved", "solution", "calendar", "gantt", "resources", "report"].includes(String(v.activeView)) ||
      !["small", "normal", "large"].includes(String(v.nodeSize)) ||
      !["system", "light", "dark"].includes(String(v.theme)) ||
      typeof v.motion !== "boolean" || !finite(v.timeScale) || v.timeScale <= 0 ||
      !Array.isArray(v.rowOrder) || !v.rowOrder.every(identifier) ||
      !record(v.rowOffsets) || !Object.values(v.rowOffsets).every(finite)) fail();
    if (v.resolved !== undefined) {
      // Reuse the same visual validation for the independent academic layout.
      parseProject(JSON.stringify({ ...raw, version: 1, presentation: undefined, visual: v.resolved }));
    }
    if (v.draftRows !== undefined) {
      if (!Array.isArray(v.draftRows)) return fail();
      for (const row of v.draftRows) {
        if (!record(row) || !identifier(row.id) || typeof row.name !== "string" ||
          !Array.isArray(row.predecessors) || !row.predecessors.every(identifier) ||
          !finite(row.duration) || row.duration < 0 || !finite(row.resources) ||
          row.resources < 0 || !Number.isInteger(row.resources)) fail();
      }
    }
  }
  return p as unknown as Project;
}

/** Explicit, non-mutating migration. Import validation itself never writes storage. */
export function migrateProject(project: Project): ProjectV2 {
  const copy = structuredClone(project);
  return {
    ...copy,
    version: 2,
    id: copy.id ?? crypto.randomUUID(),
    presentation: {
      activeView: "network", nodeSize: "normal", theme: "system", motion: true,
      timeScale: 48, rowOrder: [], rowOffsets: {}, ...copy.presentation,
    },
  };
}
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}
export function saveProject(project: Project): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project));
    return null;
  } catch {
    return "No se pudo guardar automáticamente. Descarga el JSON para conservar el proyecto.";
  }
}
export function loadProject(): { project: Project | null; error?: string } {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return { project: text ? parseProject(text) : null };
  } catch {
    return {
      project: null,
      error:
        "No se pudo recuperar el proyecto guardado. El archivo local permanece sin modificar.",
    };
  }
}
export function downloadFile(
  name: string,
  data: Blob | string,
  mime = "application/json",
): void {
  const url = URL.createObjectURL(
    typeof data === "string" ? new Blob([data], { type: mime }) : data,
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
