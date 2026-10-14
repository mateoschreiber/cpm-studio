import { describe, expect, it } from 'vitest';
import { guideProject } from '../core/fixtures';
import { solveCPM } from '../core/engine';
import { buildReportHTML, renderResourceSVG, renderScheduleSVG, scheduleCSV } from './academicExport';

describe('academic diagram exports', () => {
  it('keeps execution distinct from waiting and uses true dates', () => {
    const p = guideProject(), r = solveCPM(p);
    const early = renderScheduleSVG(p, r, 'early', 'calendar');
    expect(early).toContain('data-activity-id="B"');
    expect(early).toContain('data-start="0" data-finish="4"');
    expect(early).toContain('data-wait-start="4" data-wait-finish="8"');
    const late = renderScheduleSVG(p, r, 'late', 'calendar');
    expect(late).toContain('data-start="6" data-finish="10"');
    expect(late).toContain('data-wait-start="0" data-wait-finish="6"');
    expect(renderScheduleSVG(p, r, 'early', 'gantt')).toContain('Ventana de desplazamiento');
  });
  it('exports resources and all report families, safely escaping user text', () => {
    const p = guideProject();
    p.name = '<script>alert("x")</script>';
    p.activities[0].name = '<img src=x onerror=alert(1)>';
    const r = solveCPM(p);
    const svg = renderResourceSVG(p, r, 'early', false);
    expect(svg).toContain('Total: 89');
    expect(svg).toContain('Pico: 9');
    const html = buildReportHTML(p, r);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Calendario temprano');
    expect(html).toContain('Gantt tardío');
    expect(html).toContain('Consumo acumulado tardío');
    expect(html).toContain('pfc');
  });
  it('quotes CSV delimiters and neutralizes spreadsheet formulas', () => {
    const p = guideProject();
    p.activities[0].name = '=SUM(1;2)';
    const csv = scheduleCSV(p, solveCPM(p), 'early');
    expect(csv).toContain('"\'=SUM(1;2)"');
    expect(csv).toContain('pfc;ufc;pff;uff');
  });
});
