import { describe, expect, it } from 'vitest';
import { buildResourceProfile, buildSchedule, buildSolutionTrace } from './academic';
import { guideProject, fourteenRows } from './fixtures';
import { solveCPM } from './engine';
import { generateAOA } from './generate';

describe('academic derived views', () => {
  it('uses event dates and activity dates separately, with the guide triangles', () => {
    const p = guideProject(), r = solveCPM(p);
    const early = buildSchedule(p, r, 'early'), late = buildSchedule(p, r, 'late');
    expect(early.find(a => a.id === 'B')).toMatchObject({ start: 0, finish: 4, eventFinish: 8 });
    expect(late.find(a => a.id === 'B')).toMatchObject({ start: 6, finish: 10, eventStart: 0 });
    expect(late.find(a => a.id === 'D')).toMatchObject({ start: 10, finish: 13 });
    expect(early.find(a => a.id === 'D')?.finish).toBe(11);
    for (const schedule of [early, late]) {
      const profile = buildResourceProfile(schedule);
      expect(profile.total).toBe(89);
      expect(profile.peak).toBe(9);
      expect(profile.duration).toBe(15);
      expect(profile.intervals.at(-1)?.cumulativeEnd).toBe(89);
    }
  });
  it('accounts for half-open intervals, zero durations, decimals and idle horizon', () => {
    const p = guideProject(), r = solveCPM(p);
    const base = buildSchedule(p, r, 'early')[0];
    const profile = buildResourceProfile([
      { ...base, id: 'a', start: 0, finish: 0.1, duration: 0.1, resources: 2, eventFinish: 1 },
      { ...base, id: 'b', start: 0.1, finish: 0.3, duration: 0.2, resources: 3, eventFinish: 1 },
      { ...base, id: 'z', start: 0.1, finish: 0.1, duration: 0, resources: 100, eventFinish: 1 },
    ]);
    expect(profile.peak).toBe(3);
    expect(profile.total).toBeCloseTo(0.8, 12);
    expect(profile.intervals.map(i => i.load)).toEqual([2, 3, 0]);
    expect(profile.points.at(-1)).toEqual({ time: 1, load: 0, cumulative: profile.total });
  });
  it('explains arithmetic and preserves all determining ties', () => {
    const p = guideProject();
    p.activities.find(a => a.id === 'B')!.duration = 8;
    const trace = buildSolutionTrace(p), r = solveCPM(p);
    expect(trace.find(s => s.id === 'forward:2')?.determiningIds.sort()).toEqual(['B', 'f1']);
    expect(trace.find(s => s.id === 'activity:B:ufc')?.value).toBe(2);
    expect(trace.at(-1)).toMatchObject({ phase: 'critical', value: r.duration });
    expect(new Set(trace.map(s => s.phase))).toEqual(new Set(['validation', 'forward', 'backward', 'activities', 'margins', 'critical']));
  });
  it('does not create a resource spike from decimal round-off at a shared boundary', () => {
    const p = guideProject(), r = solveCPM(p), base = buildSchedule(p, r, 'early')[0];
    const profile = buildResourceProfile([
      { ...base, start: 0, finish: 0.1 + 0.2, duration: 0.3, resources: 2, eventFinish: 1 },
      { ...base, id: 'b', start: 0.3, finish: 1, duration: 0.7, resources: 3, eventFinish: 1 },
    ]);
    expect(profile.peak).toBe(3);
    expect(profile.total).toBeCloseTo(2.7, 12);
    expect(profile.intervals).toHaveLength(2);
  });
  it('matches all fourteen activity calculations and rejects invalid drafts', () => {
    const p = generateAOA(fourteenRows), r = solveCPM(p), trace = buildSolutionTrace(p, r);
    expect(trace.at(-1)?.value).toBe(21);
    for (const a of p.activities) {
      expect(trace.find(s => s.id === `activity:${a.id}:pff`)?.value).toBe(r.activities[a.id].ef);
      expect(trace.find(s => s.id === `margin:${a.id}:MT`)?.value).toBe(r.activities[a.id].mt);
    }
    p.activities[0].target = p.activities[0].source;
    expect(() => buildSolutionTrace(p, r)).toThrow(/ciclo/);
  });
});
