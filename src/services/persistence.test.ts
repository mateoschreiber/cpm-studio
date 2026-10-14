import { describe, expect, it, vi, afterEach } from "vitest";
import {
  parseProject,
  serializeProject,
  saveProject,
  loadProject,
  STORAGE_KEY,
} from "./persistence";
import type { CPMResult, Project } from "../core/types";
import { edgeGeometry } from "./geometry";
import { exportSVG } from "./export";
import { layoutProject } from "./layout";

const sample = (): Project => ({
  version: 1,
  name: "Ejemplo",
  events: [
    { id: "0", label: "0" },
    { id: "1", label: "1" },
  ],
  activities: [
    {
      id: "A",
      name: "A",
      source: "0",
      target: "1",
      duration: 2,
      resources: 0,
      dummy: false,
    },
  ],
  visual: {
    nodes: { "0": { x: 0, y: 0 }, "1": { x: 200, y: 0 } },
    edges: {
      A: {
        kind: "curve",
        bend: 20,
        labelX: 0,
        labelY: -12,
        color: "#123456",
        width: 2,
      },
    },
  },
  preferences: {
    grid: true,
    snap: true,
    showLabels: true,
    showDates: true,
    highlight: true,
    criticalColor: "#ff0000",
  },
});
afterEach(() => vi.unstubAllGlobals());
describe("persistencia", () => {
  it("conserva todos los datos sin modificar el proyecto", () => {
    const p = sample();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it("rechaza JSON inválido, versiones y campos incompletos", () => {
    expect(() => parseProject("{")).toThrow();
    for (const value of [
      {},
      { ...sample(), version: 2 },
      { ...sample(), preferences: {} },
    ])
      expect(() => parseProject(JSON.stringify(value))).toThrow();
  });
  it("rechaza ids duplicados, referencias rotas y valores no finitos", () => {
    const p = sample();
    p.events.push({ ...p.events[0] });
    expect(() => parseProject(JSON.stringify(p))).toThrow();
    const q = sample();
    q.activities[0].target = "missing";
    expect(() => parseProject(JSON.stringify(q))).toThrow();
    const r = sample();
    r.visual.nodes["0"].x = Infinity;
    expect(() => parseProject(JSON.stringify(r))).toThrow();
  });
  it("rechaza claves peligrosas y valores visuales inseguros", () => {
    expect(() =>
      parseProject(serializeProject(sample()).replace('"A":', '"__proto__":')),
    ).toThrow();
    const p = sample();
    p.visual.edges.A.color = "url(https://example.com)";
    expect(() => parseProject(JSON.stringify(p))).toThrow();
  });
  it("permite borradores cíclicos y sucesos aislados", () => {
    const p = sample();
    p.events.push({ id: "2", label: "2" });
    p.visual.nodes["2"] = { x: 400, y: 0 };
    p.activities.push({
      ...p.activities[0],
      id: "B",
      source: "1",
      target: "0",
    });
    p.visual.edges.B = { ...p.visual.edges.A };
    expect(parseProject(JSON.stringify(p))).toEqual(p);
  });
  it("informa fallos de almacenamiento y recuperación", () => {
    vi.stubGlobal("localStorage", {
      setItem() {
        throw new Error("quota");
      },
      getItem() {
        return "invalid";
      },
    });
    expect(saveProject(sample())).toMatch(/guardar/i);
    expect(loadProject().error).toBeTruthy();
  });
  it("guarda y recupera desde la clave versionada", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => map.set(k, v),
      getItem: (k: string) => map.get(k) ?? null,
    });
    expect(saveProject(sample())).toBeNull();
    expect(map.has(STORAGE_KEY)).toBe(true);
    expect(loadProject().project).toEqual(sample());
  });
});

describe("geometría y exportación", () => {
  it("recorta las flechas en el radio del suceso y desplaza etiquetas", () => {
    const v = {
      ...sample().visual.edges.A,
      kind: "straight" as const,
      labelX: 10,
      labelY: 12,
    };
    expect(edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, v)).toEqual({
      path: "M 30 0 L 170 0",
      label: { x: 110, y: 12 },
      control: { x: 100, y: 20 },
    });
    expect(
      edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, { ...v, kind: "curve" })
        .path,
    ).toContain(" Q ");
    expect(
      edgeGeometry(
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        {
          ...v,
          kind: "segments",
          points: [
            { x: 50, y: 80 },
            { x: 150, y: 80 },
          ],
        },
      ).path,
    ).toContain("L 50 80 L 150 80");
  });
  it("exporta datos escapados, ficticias y sin referencias remotas", () => {
    const p = sample();
    p.name = "<script>&";
    p.activities[0].name = "<img>";
    const svg = exportSVG(p);
    expect(svg).toContain("&lt;script&gt;&amp;");
    expect(svg).toContain("&lt;img&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg.replace("http://www.w3.org/2000/svg", "")).not.toMatch(
      /https?:\/\//g,
    );
    p.activities[0].dummy = true;
    expect(exportSVG(p)).toContain('stroke-dasharray="7 5"');
    expect(exportSVG(p)).toContain("f · 0");
  });
  it("coincide con numeración, fechas, márgenes y colores visibles del lienzo", () => {
    const p = sample();
    p.events[0].label = "NÚMERO_OCULTO";
    p.preferences.showLabels = false;
    const m = {
      es: 0,
      ef: 2,
      ls: 0,
      lf: 2,
      mt: 0,
      ml: 0,
      mi: 0,
      critical: true,
    };
    const result: CPMResult = {
      duration: 2,
      events: { "0": { early: 0, late: 0 }, "1": { early: 2, late: 2 } },
      activities: { A: m },
      logical: { A: m },
    };
    const svg = exportSVG(p, result);
    expect(svg).not.toContain("NÚMERO_OCULTO");
    expect(svg).toContain("•");
    expect(svg).toContain("A · 2");
    expect(svg).toContain("MT 0");
    expect(svg).toContain('<circle r="30" fill="white" stroke="#ff0000"');
    p.preferences.showDates = false;
    p.preferences.highlight = false;
    const plain = exportSVG(p, result);
    expect(plain).not.toContain("MT 0");
    expect(plain).not.toContain("#ff0000");
    p.preferences.showDates = true;
    expect(exportSVG(p)).toContain("—");
  });
  it("distribuye mediante ELK sin modificar lógica ni estilos originales", async () => {
    const p = sample(),
      before = structuredClone(p),
      next = await layoutProject(p);
    expect(p).toEqual(before);
    expect(next.events).toEqual(p.events);
    expect(next.activities).toEqual(p.activities);
    expect(next.visual.edges).toEqual(p.visual.edges);
    expect(next.visual.nodes["1"].x).toBeGreaterThan(next.visual.nodes["0"].x);
  });
});
