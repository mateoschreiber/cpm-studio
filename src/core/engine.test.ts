import { describe, expect, it } from "vitest";
import {
  solveCPM,
  validateGraph,
  criticalPaths,
  extractPrecedences,
  validateTable,
} from "./engine";
import { generateAOA } from "./generate";
import { guideProject, guideRows, fourteenRows } from "./fixtures";

function closurePairs(rows: typeof guideRows): string[] {
  const pairs = new Set<string>();
  for (const row of rows) {
    const seen = new Set<string>(),
      stack = [...row.predecessors];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      pairs.add(id + ">" + row.id);
      stack.push(...rows.find((r) => r.id === id)!.predecessors);
    }
  }
  return [...pairs].sort();
}

describe("CPM matemático", () => {
  it("resuelve todas las fechas y márgenes de la red guía exacta", () => {
    const p = guideProject(),
      r = solveCPM(p);
    expect(r.duration).toBe(15);
    expect(Object.values(r.events).map((e) => [e.early, e.late])).toEqual([
      [0, 0],
      [8, 8],
      [8, 10],
      [13, 13],
      [15, 15],
    ]);
    expect(
      p.activities.map((a) => [
        a.name,
        r.activities[a.id].mt,
        r.activities[a.id].ml,
        r.activities[a.id].mi,
      ]),
    ).toEqual([
      ["A", 0, 0, 0],
      ["B", 6, 4, 4],
      ["f1", 2, 0, 0],
      ["C", 0, 0, 0],
      ["D", 2, 2, 0],
      ["E", 0, 0, 0],
    ]);
    expect([...criticalPaths(p, r)]).toEqual([["A", "C", "E"]]);
    expect(r.logical.B).toMatchObject({ mt: 6, ml: 4, mi: 4 });
    expect(r.logical.D).toMatchObject({ mt: 2, ml: 2, mi: 0 });
  });
  it("resuelve las catorce actividades con expectativas independientes", () => {
    const p = generateAOA(fourteenRows),
      r = solveCPM(p);
    expect(r.duration).toBe(21);
    expect([...criticalPaths(p, r)]).toEqual([["A", "G", "D", "E", "L"]]);
    const expected: Record<string, number[]> = {
      A: [0, 3, 0, 3, 0, 0, 0],
      B: [3, 5, 4, 6, 1, 0, 0],
      C: [5, 9, 6, 10, 1, 1, 0],
      D: [10, 11, 10, 11, 0, 0, 0],
      E: [11, 14, 11, 14, 0, 0, 0],
      F: [0, 5, 1, 6, 1, 0, 0],
      G: [3, 10, 3, 10, 0, 0, 0],
      H: [5, 9, 7, 11, 2, 2, 1],
      I: [10, 12, 12, 14, 2, 2, 2],
      J: [0, 3, 8, 11, 8, 8, 8],
      K: [3, 8, 9, 14, 6, 6, 6],
      L: [14, 21, 14, 21, 0, 0, 0],
      M: [11, 19, 13, 21, 2, 2, 2],
      N: [0, 4, 17, 21, 17, 17, 17],
    };
    for (const [id, v] of Object.entries(expected)) {
      const a = r.logical[id];
      expect([a.es, a.ef, a.ls, a.lf, a.mt, a.ml, a.mi], id).toEqual(v);
      expect(r.activities[id].mt, id).toBe(a.mt);
    }
  });
  it("no utiliza datos visuales", () => {
    const p = guideProject(),
      before = solveCPM(p);
    p.visual.nodes["0"] = { x: 999, y: -23 };
    p.visual.edges.A.bend = 500;
    expect(solveCPM(p)).toEqual(before);
  });
  it("valida errores e impide resultados definitivos", () => {
    const p = guideProject();
    p.activities.push({
      ...p.activities[0],
      id: "cycle",
      source: "4",
      target: "0",
    });
    expect(validateGraph(p).join(" ")).toMatch(/ciclo/i);
    expect(() => solveCPM(p)).toThrow();
    expect(
      validateTable([
        { id: "A", name: "A", duration: -1, resources: 0, predecessors: ["X"] },
      ]).length,
    ).toBeGreaterThan(0);
    const q = guideProject();
    q.events.push({ id: "isolated", label: "aislado" });
    expect(validateGraph(q).join(" ")).toMatch(/aislado/i);
    const n = guideProject();
    n.activities[0].duration = NaN;
    expect(validateGraph(n).length).toBeGreaterThan(0);
  });
  it("admite ceros, decimales, múltiples fuentes y sumideros y rutas", () => {
    const rows = [
      { id: "A", name: "A", duration: 0.1, resources: 0, predecessors: [] },
      { id: "B", name: "B", duration: 0.1, resources: 0, predecessors: [] },
      {
        id: "C",
        name: "C",
        duration: 0,
        resources: 0,
        predecessors: ["A", "B"],
      },
    ];
    const p = generateAOA(rows),
      r = solveCPM(p);
    expect(r.duration).toBeCloseTo(0.1);
    expect([...criticalPaths(p, r)]).toEqual(
      expect.arrayContaining([
        ["A", "C"],
        ["B", "C"],
      ]),
    );
  });
  it("usa fronteras virtuales en redes manuales conectadas con varias fuentes y finales", () => {
    const p = guideProject();
    p.events = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      label: String(i),
    }));
    p.activities = [
      ["A", "0", "2", 2],
      ["B", "1", "2", 3],
      ["C", "2", "3", 4],
      ["D", "2", "4", 2],
    ].map(([id, source, target, duration]) => ({
      id: String(id),
      name: String(id),
      source: String(source),
      target: String(target),
      duration: Number(duration),
      resources: 0,
      dummy: false,
    }));
    const r = solveCPM(p);
    expect(r.duration).toBe(7);
    expect(r.events["0"]).toEqual({ early: 0, late: 1 });
    expect(r.events["4"]).toEqual({ early: 5, late: 7 });
    expect([...criticalPaths(p, r)]).toEqual([["B", "C"]]);
  });
  it("rechaza extremos ausentes, duplicados, ficticias incorrectas y recursos fraccionarios", () => {
    const p = guideProject();
    p.activities[0].target = "missing";
    p.activities[1].id = "A";
    p.activities[2].resources = 1;
    p.activities[3].resources = 0.5;
    const messages = validateGraph(p).join(" ");
    expect(messages).toMatch(/extremo inexistente/);
    expect(messages).toMatch(/duplicados/);
    expect(messages).toMatch(/Ficticia/);
    expect(messages).toMatch(/inválidos/);
    const rows = guideRows.map((r) => ({
      ...r,
      predecessors: [...r.predecessors],
    }));
    rows[0].predecessors = ["E"];
    expect(validateTable(rows).join(" ")).toMatch(/ciclo/);
  });
  it("preserva identidades y posiciones al regenerar", () => {
    const p = generateAOA(guideRows);
    p.visual.nodes[p.activities.find((a) => a.id === "A")!.source] = {
      x: 12,
      y: 42,
    };
    const q = generateAOA(guideRows, p);
    expect(q.visual.nodes).toEqual(p.visual.nodes);
    expect(q.activities.filter((a) => !a.dummy).map((a) => a.id)).toEqual(
      guideRows.map((a) => a.id),
    );
    const manual = guideProject();
    expect(generateAOA(guideRows, manual)).toEqual(manual);
    const changed = guideRows.map((r) => ({
      ...r,
      predecessors: r.id === "D" ? ["B"] : r.predecessors,
    }));
    const regenerated = generateAOA(changed, manual);
    expect(new Set(regenerated.events.map((event) => event.label)).size).toBe(
      regenerated.events.length,
    );
    for (const event of regenerated.events) {
      const old = manual.events.find((previous) => previous.id === event.id);
      if (old) expect(event.label).toBe(old.label);
    }
    expect(closurePairs(extractPrecedences(regenerated))).toEqual(
      closurePairs(changed),
    );
    expect(
      Object.keys(regenerated.visual.nodes).some(
        (id) => id in manual.visual.nodes,
      ),
    ).toBe(true);
  });
  it("preserva numeración única al modificar redes previamente generadas", () => {
    let seed = 31;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let trial = 0; trial < 40; trial++) {
      const rows = Array.from({ length: 8 }, (_, i) => ({
        id: `a${i}`,
        name: `a${i}`,
        duration: i % 4,
        resources: 0,
        predecessors: Array.from({ length: i }, (_, j) => `a${j}`).filter(
          () => random() < 0.3,
        ),
      }));
      const previous = generateAOA(rows);
      previous.events.forEach((event, index) => {
        event.label = String(index * 2);
      });
      const changed = rows.map((row, i) => ({
        ...row,
        predecessors: i === 7 ? ["a0"] : row.predecessors,
      }));
      const regenerated = generateAOA(changed, previous);
      expect(new Set(regenerated.events.map((event) => event.label)).size).toBe(
        regenerated.events.length,
      );
      expect(validateGraph(regenerated)).toEqual([]);
      expect(closurePairs(extractPrecedences(regenerated))).toEqual(
        closurePairs(changed),
      );
      for (const event of regenerated.events) {
        const old = previous.events.find((e) => e.id === event.id);
        if (old) expect(event.label).toBe(old.label);
      }
    }
  });
  it("admite identificadores que coinciden con propiedades de Object", () => {
    const rows = [
      {
        id: "__proto__",
        name: "Inicio",
        predecessors: [],
        duration: 2,
        resources: 0,
      },
      {
        id: "constructor",
        name: "Fin",
        predecessors: ["__proto__"],
        duration: 3,
        resources: 0,
      },
    ];
    const p = generateAOA(rows),
      r = solveCPM(p);
    expect(r.duration).toBe(5);
    expect(r.logical["__proto__"].mt).toBe(0);
    expect(r.activities["constructor"].mt).toBe(0);
  });
  it("deduplica rutas reales que tienen diferentes recorridos ficticios", () => {
    const p = guideProject();
    p.events = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      label: String(i),
    }));
    p.activities = [
      ["A", "0", "1", 1],
      ["f1", "1", "2", 0],
      ["f2", "1", "3", 0],
      ["f3", "2", "4", 0],
      ["f4", "3", "4", 0],
      ["B", "4", "5", 1],
    ].map(([id, source, target, duration]) => ({
      id: String(id),
      name: String(id),
      source: String(source),
      target: String(target),
      duration: Number(duration),
      resources: 0,
      dummy: String(id).startsWith("f"),
    }));
    expect([...criticalPaths(p, solveCPM(p))]).toEqual([["A", "B"]]);
  });
  it("preserva cierre transitivo y márgenes en 80 DAG pseudoaleatorios", () => {
    let seed = 71;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const closure = (rows: typeof guideRows) => {
      const out = new Set<string>();
      const visit = (id: string, child: string) => {
        for (const pre of rows.find((a) => a.id === id)!.predecessors) {
          const k = pre + ">" + child;
          if (!out.has(k)) {
            out.add(k);
            visit(pre, child);
          }
        }
      };
      rows.forEach((a) => visit(a.id, a.id));
      return [...out].sort();
    };
    for (let trial = 0; trial < 80; trial++) {
      const rows = Array.from(
        { length: 2 + Math.floor(random() * 8) },
        (_, i) => ({
          id: "a" + i,
          name: "a" + i,
          duration: Math.floor(random() * 6),
          resources: 0,
          predecessors: Array.from({ length: i }, (_, j) => "a" + j).filter(
            () => random() < 0.3,
          ),
        }),
      );
      const p = generateAOA(rows);
      expect(validateGraph(p)).toEqual([]);
      expect(closure(extractPrecedences(p))).toEqual(closure(rows));
      const r = solveCPM(p);
      for (const a of rows)
        expect(r.activities[a.id].mt).toBeCloseTo(r.logical[a.id].mt);
    }
  });
});
