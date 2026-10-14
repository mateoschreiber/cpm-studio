import {
  EPSILON,
  type Project,
  type TableRow,
  type CPMResult,
  type Metrics,
} from "./types";

export function topological(
  ids: string[],
  pairs: [string, string][],
): string[] {
  const incoming = new Map(ids.map((id) => [id, 0]));
  const next = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [a, b] of pairs) {
    if (!next.has(a) || !incoming.has(b)) continue;
    next.get(a)!.push(b);
    incoming.set(b, incoming.get(b)! + 1);
  }
  const queue = ids.filter((id) => incoming.get(id) === 0);
  for (let i = 0; i < queue.length; i++)
    for (const b of next.get(queue[i])!) {
      incoming.set(b, incoming.get(b)! - 1);
      if (incoming.get(b) === 0) queue.push(b);
    }
  return queue;
}
function uniqueErrors(ids: string[], label: string): string[] {
  return new Set(ids).size === ids.length
    ? []
    : [`Identificadores de ${label} duplicados.`];
}
function validNumbers(duration: number, resources: number): boolean {
  return (
    Number.isFinite(duration) &&
    duration >= 0 &&
    Number.isInteger(resources) &&
    resources >= 0
  );
}
export function validateGraph(p: Project): string[] {
  const errors = [
    ...uniqueErrors(
      p.events.map((e) => e.id),
      "sucesos",
    ),
    ...uniqueErrors(
      p.activities.map((a) => a.id),
      "actividades",
    ),
  ];
  if (!p.events.length || !p.activities.length)
    errors.push("La red está incompleta: agregue sucesos y actividades.");
  const ids = p.events.map((e) => e.id),
    known = new Set(ids);
  for (const e of p.events)
    if (!e.id.trim() || !e.label.trim())
      errors.push("Cada suceso necesita identificador y número.");
  for (const a of p.activities) {
    if (!a.id.trim() || !a.name.trim())
      errors.push("Cada actividad necesita identificador y nombre.");
    if (!known.has(a.source) || !known.has(a.target))
      errors.push(`Actividad ${a.name}: extremo inexistente.`);
    if (!validNumbers(a.duration, a.resources))
      errors.push(`Actividad ${a.name}: duración o recursos inválidos.`);
    if (a.dummy && (a.duration !== 0 || a.resources !== 0))
      errors.push(`Ficticia ${a.name}: duración y recursos deben ser cero.`);
  }
  const real = p.activities.filter((a) => !a.dummy);
  errors.push(
    ...uniqueErrors(
      real.map((a) => a.name.trim()),
      "nombres de actividades",
    ),
  );
  if (
    topological(
      ids,
      p.activities.map((a) => [a.source, a.target]),
    ).length !== ids.length
  )
    errors.push("La red contiene un ciclo.");
  if (ids.length) {
    const visited = new Set<string>(),
      queue = [ids[0]];
    const neighbors = new Map(ids.map((id) => [id, [] as string[]]));
    for (const a of p.activities)
      if (known.has(a.source) && known.has(a.target)) {
        neighbors.get(a.source)!.push(a.target);
        neighbors.get(a.target)!.push(a.source);
      }
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...neighbors.get(id)!);
    }
    if (visited.size !== ids.length)
      errors.push(
        "La red contiene elementos aislados o componentes desconectados.",
      );
  }
  return [...new Set(errors)];
}
export function validateTable(rows: TableRow[]): string[] {
  const errors = [
    ...uniqueErrors(
      rows.map((a) => a.id),
      "actividades",
    ),
    ...uniqueErrors(
      rows.map((a) => a.name.trim()),
      "nombres",
    ),
  ];
  if (!rows.length) errors.push("Ingrese al menos una actividad.");
  const known = new Set(rows.map((a) => a.id));
  for (const a of rows) {
    if (!a.id.trim() || !a.name.trim())
      errors.push("Cada actividad necesita un nombre.");
    if (!validNumbers(a.duration, a.resources))
      errors.push(`${a.name}: duración o recursos inválidos.`);
    for (const pre of a.predecessors)
      if (!known.has(pre))
        errors.push(`${a.name}: predecesora inexistente ${pre}.`);
  }
  if (
    topological(
      rows.map((a) => a.id),
      rows.flatMap((a) =>
        a.predecessors.map((pre) => [pre, a.id] as [string, string]),
      ),
    ).length !== rows.length
  )
    errors.push("Las precedencias contienen un ciclo.");
  return [...new Set(errors)];
}
/** The first real activities encountered backwards through dummy-only paths. */
export function extractPrecedences(p: Project): TableRow[] {
  const incoming = new Map(p.events.map((e) => [e.id, [] as Project['activities']]));
  for (const a of p.activities) incoming.get(a.target)?.push(a);
  return p.activities
    .filter((a) => !a.dummy)
    .map((a) => {
      const predecessors = new Set<string>(),
        seen = new Set<string>(),
        stack = [a.source];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of incoming.get(id) || []) {
          if (edge.dummy) stack.push(edge.source);
          else predecessors.add(edge.id);
        }
      }
      return {
        id: a.id,
        name: a.name,
        duration: a.duration,
        resources: a.resources,
        predecessors: [...predecessors].sort(),
      };
    });
}
const clean = (n: number) => (Math.abs(n) < EPSILON ? 0 : n);
function metrics(
  es: number,
  ef: number,
  ls: number,
  lf: number,
  ml: number,
  mi: number,
): Metrics {
  const mt = clean(ls - es);
  return {
    es,
    ef,
    ls,
    lf,
    mt,
    ml: clean(ml),
    mi: clean(Math.max(0, mi)),
    critical: Math.abs(mt) < EPSILON,
  };
}
export function solveCPM(p: Project): CPMResult {
  const errors = validateGraph(p);
  if (errors.length) throw new Error(errors.join("\n"));
  const order = topological(
    p.events.map((e) => e.id),
    p.activities.map((a) => [a.source, a.target]),
  );
  const outgoing = new Map(p.events.map((e) => [e.id, [] as Project['activities']]));
  for (const a of p.activities) outgoing.get(a.source)!.push(a);
  const events: CPMResult["events"] = Object.fromEntries(
    order.map((id) => [id, { early: 0, late: Infinity }]),
  );
  for (const id of order)
    for (const a of outgoing.get(id)!)
      events[a.target].early = Math.max(
        events[a.target].early,
        events[id].early + a.duration,
      );
  const duration = Math.max(...order.map((id) => events[id].early));
  for (const id of [...order].reverse()) {
    const edges = outgoing.get(id)!;
    events[id].late = edges.length
      ? Math.min(...edges.map((a) => events[a.target].late - a.duration))
      : duration;
  }
  const activities: CPMResult["activities"] = Object.create(null);
  for (const a of p.activities) {
    const i = events[a.source],
      j = events[a.target];
    activities[a.id] = metrics(
      i.early,
      i.early + a.duration,
      j.late - a.duration,
      j.late,
      j.early - i.early - a.duration,
      j.early - i.late - a.duration,
    );
  }
  const rows = extractPrecedences(p),
    byId = new Map(rows.map((a) => [a.id, a])),
    logical: CPMResult["logical"] = Object.create(null);
  const sorted = topological(
    rows.map((a) => a.id),
    rows.flatMap((a) =>
      a.predecessors.map((pre) => [pre, a.id] as [string, string]),
    ),
  );
  const successors = new Map(rows.map((a) => [a.id, [] as string[]]));
  for (const a of rows)
    for (const pre of a.predecessors) successors.get(pre)!.push(a.id);
  for (const id of sorted) {
    const a = byId.get(id)!,
      es = Math.max(0, ...a.predecessors.map((pre) => logical[pre].ef));
    logical[id] = metrics(es, es + a.duration, 0, 0, 0, 0);
  }
  for (const id of [...sorted].reverse()) {
    const a = byId.get(id)!,
      s = successors.get(id)!,
      lf = s.length ? Math.min(...s.map((v) => logical[v].ls)) : duration;
    const es = logical[id].es,
      ef = logical[id].ef;
    logical[id] = metrics(es, ef, lf - a.duration, lf, 0, 0);
  }
  for (const a of rows) {
    const s = successors.get(a.id)!,
      m = logical[a.id];
    m.ml = clean(
      (s.length ? Math.min(...s.map((v) => logical[v].es)) : duration) - m.ef,
    );
    m.mi = clean(
      Math.max(
        0,
        (s.length ? Math.min(...s.map((v) => logical[v].es)) : duration) -
          (a.predecessors.length
            ? Math.max(...a.predecessors.map((v) => logical[v].lf))
            : 0) -
          a.duration,
      ),
    );
  }
  return { duration, events, activities, logical };
}
/** Lazy depth-first enumeration; only emitted routes are retained for deduplication. */
export function* criticalPaths(p: Project, r: CPMResult): Generator<string[]> {
  const outgoing = new Map(p.events.map((e) => [e.id, [] as Project['activities']]));
  const hasIncoming = new Set<string>(), hasOutgoing = new Set<string>();
  for (const a of p.activities) {
    hasIncoming.add(a.target);
    hasOutgoing.add(a.source);
    if (r.activities[a.id]?.critical) outgoing.get(a.source)?.push(a);
  }
  const sources = p.events.filter((e) => !hasIncoming.has(e.id));
  const seen = new Set<string>();
  function* walk(id: string, path: string[]): Generator<string[]> {
    if (!hasOutgoing.has(id)) {
      if (Math.abs(r.events[id].early - r.duration) < EPSILON) {
        const key = JSON.stringify(path);
        if (!seen.has(key)) {
          seen.add(key);
          yield path;
        }
      }
      return;
    }
    for (const a of outgoing.get(id) || [])
      yield* walk(a.target, a.dummy ? path : [...path, a.name]);
  }
  for (const source of sources)
    if (Math.abs(r.events[source.id].late) < EPSILON)
      yield* walk(source.id, []);
}
