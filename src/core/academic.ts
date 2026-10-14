import { solveCPM, topological, validateGraph } from './engine';
import { EPSILON, type CPMResult, type Project } from './types';

export interface SolutionStep {
  id: string;
  phase: 'validation' | 'forward' | 'backward' | 'activities' | 'margins' | 'critical';
  targetId?: string;
  title: string;
  formula: string;
  substitution: string;
  value?: number;
  candidates: { id: string; label: string; value: number }[];
  determiningIds: string[];
  eventDates?: { early?: number; late?: number };
}
export interface ScheduledActivity {
  id: string;
  name: string;
  source: string;
  target: string;
  start: number;
  finish: number;
  duration: number;
  resources: number;
  dummy: boolean;
  critical: boolean;
  earliestStart: number;
  latestStart: number;
  eventStart: number;
  eventFinish: number;
}
export interface ResourceProfile {
  intervals: { start: number; end: number; load: number; cumulativeStart: number; cumulativeEnd: number }[];
  points: { time: number; load: number; cumulative: number }[];
  total: number;
  peak: number;
  duration: number;
}

/** Human-readable arithmetic; display rounding never changes the calculation. */
const n = (value: number) => String(Number(value.toPrecision(12)));
const clean = (value: number) => Math.abs(value) < EPSILON ? 0 : value;

/** Trace is a pure projection of a valid AOA network and its calculation. */
export function buildSolutionTrace(project: Project, result?: CPMResult): SolutionStep[] {
  const errors = validateGraph(project);
  if (errors.length) throw new Error(errors.join('\n'));
  const r = result ?? solveCPM(project);
  const order = topological(project.events.map(e => e.id), project.activities.map(a => [a.source, a.target]));
  const labels = new Map(project.events.map(e => [e.id, e.label]));
  const incoming = new Map(project.events.map(e => [e.id, [] as Project['activities']]));
  const outgoing = new Map(project.events.map(e => [e.id, [] as Project['activities']]));
  for (const a of project.activities) {
    incoming.get(a.target)!.push(a);
    outgoing.get(a.source)!.push(a);
  }
  const steps: SolutionStep[] = [{
    id: 'validation', phase: 'validation', title: 'Red válida y orden topológico',
    formula: 'Cada predecesor se resuelve antes que su sucesor.',
    substitution: order.map(id => labels.get(id)).join(' → '), candidates: [], determiningIds: [],
  }];
  for (const id of order) {
    const edges = incoming.get(id)!;
    const candidates = edges.map(a => ({ id: a.id, label: `${a.name}: ${n(r.events[a.source].early)} + ${n(a.duration)}`, value: r.events[a.source].early + a.duration }));
    const value = r.events[id].early;
    steps.push({ id: `forward:${id}`, phase: 'forward', targetId: id,
      title: `Ida · suceso ${labels.get(id)}`, formula: edges.length ? 'Ft(j) = máx [Ft(i) + d(i,j)]' : 'Ft(inicio) = 0',
      substitution: edges.length ? `máx(${candidates.map(c => c.label).join('; ')}) = ${n(value)}` : 'Frontera inicial virtual: 0',
      value, candidates, determiningIds: candidates.filter(c => Math.abs(c.value - value) < EPSILON).map(c => c.id), eventDates: { early: value },
    });
  }
  for (const id of [...order].reverse()) {
    const edges = outgoing.get(id)!;
    const candidates = edges.map(a => ({ id: a.id, label: `${a.name}: ${n(r.events[a.target].late)} − ${n(a.duration)}`, value: r.events[a.target].late - a.duration }));
    const value = r.events[id].late;
    steps.push({ id: `backward:${id}`, phase: 'backward', targetId: id,
      title: `Vuelta · suceso ${labels.get(id)}`, formula: edges.length ? 'FT(i) = mín [FT(j) − d(i,j)]' : 'FT(fin) = duración del proyecto',
      substitution: edges.length ? `mín(${candidates.map(c => c.label).join('; ')}) = ${n(value)}` : `Frontera final virtual: ${n(r.duration)}`,
      value, candidates, determiningIds: candidates.filter(c => Math.abs(c.value - value) < EPSILON).map(c => c.id), eventDates: { early: r.events[id].early, late: value },
    });
  }
  for (const a of project.activities) {
    const i = r.events[a.source], j = r.events[a.target], m = r.activities[a.id];
    const dates: [string, string, string, number][] = [
      ['pfc', 'pfc = Ft(i)', `${n(i.early)}`, m.es],
      ['ufc', 'ufc = FT(j) − d', `${n(j.late)} − ${n(a.duration)}`, m.ls],
      ['pff', 'pff = Ft(i) + d', `${n(i.early)} + ${n(a.duration)}`, m.ef],
      ['uff', 'uff = FT(j)', `${n(j.late)}`, m.lf],
    ];
    for (const [name, formula, expression, value] of dates)
      steps.push({ id: `activity:${a.id}:${name}`, phase: 'activities', targetId: a.id,
        title: `${a.name} · ${name}`, formula, substitution: `${expression} = ${n(value)}`, value, candidates: [], determiningIds: [a.id] });
  }
  for (const a of project.activities) {
    const i = r.events[a.source], j = r.events[a.target], m = r.activities[a.id];
    const margins: [string, string, string, number][] = [
      ['MT', 'MT = FT(j) − Ft(i) − d', `${n(j.late)} − ${n(i.early)} − ${n(a.duration)}`, m.mt],
      ['ML', 'ML = Ft(j) − Ft(i) − d', `${n(j.early)} − ${n(i.early)} − ${n(a.duration)}`, m.ml],
      ['MI', 'MI = máx(0, Ft(j) − FT(i) − d)', `máx(0, ${n(j.early)} − ${n(i.late)} − ${n(a.duration)})`, m.mi],
    ];
    for (const [name, formula, expression, value] of margins)
      steps.push({ id: `margin:${a.id}:${name}`, phase: 'margins', targetId: a.id,
        title: `${a.name} · ${name} por sucesos AOA`, formula, substitution: `${expression} = ${n(value)}`, value, candidates: [], determiningIds: [a.id] });
  }
  const critical = project.activities.filter(a => !a.dummy && r.activities[a.id].critical);
  steps.push({ id: 'critical', phase: 'critical', title: 'Duración y actividades críticas',
    formula: 'Duración = máx Ft(fin); actividad crítica ⇔ |MT| < 10⁻⁹',
    substitution: `Duración: ${n(r.duration)}. Actividades críticas: ${critical.map(a => a.name).join(', ')}. Las rutas se enumeran en el panel de resultados.`,
    value: r.duration, candidates: project.events.filter(e => !outgoing.get(e.id)!.length).map(e => ({ id: e.id, label: `Fin ${e.label}`, value: r.events[e.id].early })),
    determiningIds: project.events.filter(e=>!outgoing.get(e.id)!.length&&Math.abs(r.events[e.id].early-r.duration)<EPSILON).map(e=>e.id),
  });
  return steps;
}

/** Actual activity execution and its event-to-event span are separate quantities. */
export function buildSchedule(project: Project, result: CPMResult, mode: 'early' | 'late'): ScheduledActivity[] {
  return project.activities.map(a => {
    const m = result.activities[a.id];
    const i = result.events[a.source], j = result.events[a.target];
    return { ...a, resources: a.dummy ? 0 : a.resources, critical: m.critical,
      start: mode === 'early' ? m.es : m.ls, finish: mode === 'early' ? m.ef : m.lf,
      earliestStart: m.es, latestStart: m.ls,
      eventStart: mode === 'early' ? i.early : i.late, eventFinish: mode === 'early' ? j.early : j.late };
  });
}

/** Sweep [start, finish); coalesce only machine-roundoff-equivalent breakpoints. */
export function buildResourceProfile(schedule: ScheduledActivity[]): ResourceProfile {
  const changes = new Map<number, number>([[0, 0]]);
  let duration = 0;
  for (const a of schedule) {
    if (![a.start, a.finish, a.eventFinish, a.resources].every(Number.isFinite) || a.start < 0 || a.finish < a.start || a.resources < 0)
      throw new Error('Intervalo de recursos inválido.');
    duration = Math.max(duration, a.eventFinish, a.finish);
    if (a.dummy || a.finish === a.start || a.resources === 0) continue;
    changes.set(a.start, (changes.get(a.start) ?? 0) + a.resources);
    changes.set(a.finish, (changes.get(a.finish) ?? 0) - a.resources);
  }
  changes.set(duration, changes.get(duration) ?? 0);
  const times: number[] = [], deltas: number[] = [];
  for (const time of [...changes.keys()].sort((a, b) => a - b)) {
    const last = times.length - 1;
    // 0.1 + 0.2 and 0.3 must be the same boundary, without rounding all durations.
    const tolerance = Math.min(EPSILON, Number.EPSILON * 8 * Math.max(1, Math.abs(time)));
    if (last >= 0 && time - times[last] <= tolerance) {
      times[last] = time;
      deltas[last] += changes.get(time)!;
    } else {
      times.push(time);
      deltas.push(changes.get(time)!);
    }
  }
  const intervals: ResourceProfile['intervals'] = [], points: ResourceProfile['points'] = [];
  let load = 0, total = 0, peak = 0;
  for (let index = 0; index < times.length; index++) {
    const time = times[index];
    load = clean(load + deltas[index]);
    peak = Math.max(peak, load);
    points.push({ time, load, cumulative: total });
    if (index + 1 < times.length) {
      const end = times[index + 1], cumulativeStart = total;
      total += load * (end - time);
      intervals.push({ start: time, end, load, cumulativeStart, cumulativeEnd: total });
    }
  }
  return { intervals, points, total, peak, duration };
}
