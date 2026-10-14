import {
  defaultEdgeVisual,
  emptyProject,
  type Project,
  type TableRow,
} from "./types";
import {
  extractPrecedences,
  topological,
  validateGraph,
  validateTable,
} from "./engine";

/** Transitive real-activity precedence is the invariant for every reduction. */
function closure(rows: TableRow[]): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pairs: string[] = [];
  for (const row of rows) {
    const seen = new Set<string>(),
      stack = [...row.predecessors];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(byId.get(id)?.predecessors ?? []));
    }
    for (const id of seen) pairs.push(JSON.stringify([id, row.id]));
  }
  return pairs.sort().join("|");
}
function equivalent(p: Project, expected: string): boolean {
  const reached = new Set<string>(),
    queue = [p.events[0].id];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (reached.has(id)) continue;
    reached.add(id);
    for (const a of p.activities) {
      if (a.source === id) queue.push(a.target);
      if (a.target === id) queue.push(a.source);
    }
  }
  return (
    reached.size === p.events.length &&
    topological(
      p.events.map((e) => e.id),
      p.activities.map((a) => [a.source, a.target]),
    ).length === p.events.length &&
    closure(extractPrecedences(p)) === expected
  );
}
export function generateAOA(rows: TableRow[], previous?: Project): Project {
  const errors = validateTable(rows);
  if (errors.length) throw new Error(errors.join("\n"));
  if (previous && !validateGraph(previous).length) {
    const oldRows = extractPrecedences(previous);
    if (
      oldRows.length === rows.length &&
      oldRows.every((a) => rows.some((b) => b.id === a.id)) &&
      closure(oldRows) === closure(rows)
    ) {
      const copy = structuredClone(previous),
        byId = new Map(rows.map((r) => [r.id, r]));
      copy.activities = copy.activities.map((a) => {
        const r = byId.get(a.id);
        return !a.dummy && r
          ? { ...a, name: r.name, duration: r.duration, resources: r.resources }
          : a;
      });
      return copy;
    }
  }
  let p = emptyProject();
  p.name = previous?.name ?? "Red generada";
  if (previous) p.preferences = { ...previous.preferences };
  const usedEvents = new Set<string>(),
    usedEdges = new Set(rows.map((r) => r.id));
  const unique = (base: string, used: Set<string>) => {
    let id = base;
    while (used.has(id)) id += "~";
    used.add(id);
    return id;
  };
  const start = unique("event:inicio", usedEvents),
    end = unique("event:fin", usedEvents);
  p.events.push({ id: start, label: "0" }, { id: end, label: "Fin" });
  const endpoints = new Map<string, { source: string; target: string }>();
  for (const row of rows) {
    const source = unique(`event:${row.id}:inicio`, usedEvents),
      target = unique(`event:${row.id}:fin`, usedEvents);
    endpoints.set(row.id, { source, target });
    p.events.push({ id: source, label: "" }, { id: target, label: "" });
    p.activities.push({
      id: row.id,
      name: row.name,
      source,
      target,
      duration: row.duration,
      resources: row.resources,
      dummy: false,
    });
  }
  const dummy = (source: string, target: string) => {
    const id = unique(`dummy:${JSON.stringify([source, target])}`, usedEdges);
    p.activities.push({
      id,
      name: "f",
      source,
      target,
      duration: 0,
      resources: 0,
      dummy: true,
    });
  };
  for (const row of rows) {
    const e = endpoints.get(row.id)!;
    if (!row.predecessors.length) dummy(start, e.source);
    for (const pre of row.predecessors)
      dummy(endpoints.get(pre)!.target, e.source);
    if (!rows.some((other) => other.predecessors.includes(row.id)))
      dummy(e.target, end);
  }
  const expected = closure(rows);
  // Remove redundant dummy arcs first, then safely identify their endpoints.
  for (const old of [...p.activities].filter((a) => a.dummy)) {
    const a = p.activities.find((e) => e.id === old.id);
    if (!a) continue;
    let candidate = {
      ...p,
      activities: p.activities.filter((e) => e.id !== a.id),
    };
    // Do not leave isolated boundary nodes during redundant-arc removal.
    const touched = new Set(
      candidate.activities.flatMap((e) => [e.source, e.target]),
    );
    if (touched.size === p.events.length && equivalent(candidate, expected)) {
      p = candidate;
      continue;
    }
    // Stable survivor preference helps keep earlier event IDs across regeneration.
    const keep = a.source,
      remove = a.target;
    candidate = {
      ...p,
      events: p.events.filter((e) => e.id !== remove),
      activities: p.activities
        .filter((e) => e.id !== a.id)
        .map((e) => ({
          ...e,
          source: e.source === remove ? keep : e.source,
          target: e.target === remove ? keep : e.target,
        })),
    };
    if (equivalent(candidate, expected)) p = candidate;
  }
  // Match surviving endpoints of real activities to their existing event IDs.
  if (previous) {
    const used = new Set<string>(),
      mapping = new Map<string, string>();
    for (const e of p.events) {
      const candidates = new Map<string, number>();
      for (const a of p.activities.filter((a) => !a.dummy)) {
        const old = previous.activities.find((b) => b.id === a.id && !b.dummy);
        if (!old) continue;
        for (const side of ["source", "target"] as const)
          if (a[side] === e.id)
            candidates.set(old[side], (candidates.get(old[side]) ?? 0) + 1);
      }
      const match = [...candidates]
        .sort((a, b) => b[1] - a[1])
        .find(([id]) => !used.has(id));
      if (match) {
        mapping.set(e.id, match[0]);
        used.add(match[0]);
      }
    }
    for (const e of p.events)
      if (!mapping.has(e.id)) mapping.set(e.id, unique(e.id, used));
    p.events = p.events.map((e) => ({ ...e, id: mapping.get(e.id)! }));
    p.activities = p.activities.map((a) => ({
      ...a,
      source: mapping.get(a.source)!,
      target: mapping.get(a.target)!,
    }));
  }
  const order = topological(
    p.events.map((e) => e.id),
    p.activities.map((a) => [a.source, a.target]),
  );
  // Reserve surviving manual labels before numbering any new events. An ordinal
  // in topological order can otherwise collide with a preserved manual number.
  const labels = new Map<string, string>();
  const usedLabels = new Set<string>();
  for (const id of order) {
    const old = previous?.events.find((event) => event.id === id);
    if (old?.label.trim() && !usedLabels.has(old.label)) {
      labels.set(id, old.label);
      usedLabels.add(old.label);
    }
  }
  let nextLabel = 0;
  p.events = order.map((id) => {
    let label = labels.get(id);
    if (label === undefined) {
      while (usedLabels.has(String(nextLabel))) nextLabel++;
      label = String(nextLabel++);
      usedLabels.add(label);
    }
    return { id, label };
  });
  const level = new Map<string, number>();
  for (const id of order) {
    const incoming = p.activities.filter((a) => a.target === id);
    level.set(
      id,
      incoming.length
        ? Math.max(...incoming.map((a) => (level.get(a.source) ?? 0) + 1))
        : 0,
    );
  }
  const usedLevel = new Map<number, number>();
  p.visual.nodes = Object.fromEntries(
    order.map((id) => {
      const n = level.get(id)!,
        lane = usedLevel.get(n) ?? 0;
      usedLevel.set(n, lane + 1);
      return [
        id,
        previous?.visual.nodes[id]
          ? { ...previous.visual.nodes[id] }
          : { x: 60 + n * 210, y: 80 + lane * 150 },
      ];
    }),
  );
  p.visual.edges = Object.fromEntries(
    p.activities.map((a) => [
      a.id,
      previous?.visual.edges[a.id]
        ? structuredClone(previous.visual.edges[a.id])
        : defaultEdgeVisual(),
    ]),
  );
  return p;
}
