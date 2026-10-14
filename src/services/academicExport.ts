import { buildResourceProfile, buildSchedule, buildSolutionTrace, type ScheduledActivity } from '../core/academic';
import { criticalPaths } from '../core/engine';
import { defaultPresentation, type CPMResult, type Project } from '../core/types';
import { numberText } from '../store';
import { exportSVG } from './export';
import { downloadFile } from './persistence';

export type ScheduleMode = 'early' | 'late';
export const escapeMarkup = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeColor = (value: string) => /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value) ? value : '#dc2626';
const scaleOf = (project: Project) => Math.min(120, Math.max(16, project.presentation?.timeScale ?? 48));
const modeName = (mode: ScheduleMode) => mode === 'early' ? 'temprano' : 'tardío';
const text = (x: number, y: number, value: unknown, attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${escapeMarkup(value)}</text>`;
const root = (project: Project, title: string, width: number, height: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeMarkup(title)}" font-family="Arial,sans-serif" font-size="12"><title>${escapeMarkup(`${project.name} · ${title}`)}</title><rect width="${width}" height="${height}" fill="#ffffff"/>${body}</svg>`;

export function orderedSchedule(project: Project, result: CPMResult, mode: ScheduleMode): ScheduledActivity[] {
  const order = new Map((project.presentation?.rowOrder ?? []).map((id, i) => [id, i]));
  return buildSchedule(project, result, mode).sort((a,b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}
function axis(duration: number, scale: number, top: number, bottom: number): string {
  const steps = Math.max(1, Math.min(10, Math.ceil(duration)));
  const ticks = Array.from({length: steps + 1}, (_, i) => duration * i / steps);
  return ticks.map(t => `<path d="M ${200+t*scale} ${top} V ${bottom}" stroke="#e2e8f0"/>${text(200+t*scale, top-9, numberText(t), 'text-anchor="middle" fill="#475569"')}`).join('');
}

/** Shared by the screen, standalone SVG/PNG and printable report. */
export function renderScheduleSVG(project: Project, result: CPMResult, mode: ScheduleMode, kind: 'calendar' | 'gantt'): string {
  const schedule = orderedSchedule(project, result, mode), scale = scaleOf(project);
  const rowY = (a: ScheduledActivity, index: number) => 100 + index*68 + Math.max(-20,Math.min(40,project.presentation?.rowOffsets[a.id] ?? 0));
  const width = Math.max(660, 250 + result.duration*scale), height = Math.max(220, 150 + schedule.length*68);
  let body = text(18, 27, `${kind === 'calendar' ? 'Calendario' : 'Gantt'} ${modeName(mode)}`, 'font-size="18" font-weight="700" fill="#0f172a"');
  body += text(18, 49, 'Tiempo abstracto · duración a escala · rojo: crítica', 'fill="#475569"');
  body += axis(result.duration, scale, 78, height-45);
  const labels = new Map(project.events.map(e => [e.id,e.label]));
  for (const [index,a] of schedule.entries()) {
    const y = rowY(a,index), x = (time: number) => 200+time*scale;
    const color = a.critical && project.preferences.highlight ? safeColor(project.preferences.criticalColor) : a.dummy ? '#64748b' : '#0f766e';
    body += `<g data-activity-id="${escapeMarkup(a.id)}"><title>${escapeMarkup(`${a.name}: ${numberText(a.start)}–${numberText(a.finish)}; duración ${numberText(a.duration)}${a.critical ? '; crítica' : ''}`)}</title>`;
    body += text(15,y+4, `${a.name.slice(0,25)}${a.dummy ? ' · ficticia' : a.critical ? ' · crítica' : ''}`, 'fill="#0f172a"');
    if(kind === 'gantt') {
      const m = result.activities[a.id];
      body += `<rect x="${x(m.es)}" y="${y-13}" width="${Math.max(0,(m.lf-m.es)*scale)}" height="26" rx="5" fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="4 3"/>`;
      if(a.finish>a.start) body += `<rect data-start="${a.start}" data-finish="${a.finish}" x="${x(a.start)}" y="${y-9}" width="${(a.finish-a.start)*scale}" height="18" rx="4" fill="${color}"/>`;
    } else {
      const waitStart = mode === 'early' ? a.finish : a.eventStart, waitFinish = mode === 'early' ? a.eventFinish : a.start;
      if(waitFinish>waitStart) body += `<path data-wait-start="${waitStart}" data-wait-finish="${waitFinish}" d="M ${x(waitStart)} ${y} H ${x(waitFinish)}" stroke="#94a3b8" stroke-width="3" stroke-dasharray="5 4"/>`;
      body += `<path data-start="${a.start}" data-finish="${a.finish}" d="M ${x(a.start)} ${y} H ${x(a.finish)}" stroke="${color}" stroke-width="${a.dummy?2:5}"${a.dummy?' stroke-dasharray="4 3"':''}/>`;
      for(const [id,time] of [[a.source,a.eventStart],[a.target,a.eventFinish]] as const) {
        const cx=x(time);
        body += `<path d="M ${cx-6} ${y} L ${cx} ${y-6} L ${cx+6} ${y} L ${cx} ${y+6} Z" fill="white" stroke="#334155"/>`;
        body += text(cx,y+22, `${labels.get(id)} · ${numberText(time)}`, 'text-anchor="middle" font-size="10" fill="#475569"');
      }
    }
    if(a.start===a.finish) body += `<path data-start="${a.start}" data-finish="${a.finish}" d="M ${x(a.start)-5} ${y} L ${x(a.start)} ${y-9} L ${x(a.start)+5} ${y} L ${x(a.start)} ${y+9} Z" fill="${color}"/>`;
    body += text(x(a.start), y-20, `${numberText(a.start)} → ${numberText(a.finish)}`, 'font-size="10" fill="#475569"');
    body += '</g>';
  }
  body += text(18,height-16,kind === 'calendar' ? 'Línea continua: ejecución · línea discontinua gris: espera · rombo: suceso' : 'Barra: ejecución · Ventana de desplazamiento: pfc → uff (incluye duración y margen total)', 'fill="#475569"');
  return root(project,`${kind === 'calendar' ? 'Calendario' : 'Gantt'} ${modeName(mode)}`,width,height,body);
}

export function renderResourceSVG(project: Project, result: CPMResult, mode: ScheduleMode, cumulative: boolean): string {
  const profile=buildResourceProfile(buildSchedule(project,result,mode)), scale=scaleOf(project);
  const width=Math.max(660,250+profile.duration*scale), height=420, top=95, bottom=345;
  const maximum=Math.max(1,cumulative?profile.total:profile.peak), x=(t:number)=>200+t*scale, y=(v:number)=>bottom-v/maximum*(bottom-top);
  let body=text(18,28,`${cumulative?'Consumo acumulado':'Carga de recursos'} ${modeName(mode)}`, 'font-size="18" font-weight="700" fill="#0f172a"');
  body+=text(18,52,`Total: ${numberText(profile.total)} recursos·tiempo · Pico: ${numberText(profile.peak)} recursos`, 'fill="#475569"');
  body+=axis(profile.duration,scale,top,bottom);
  for(let i=0;i<=4;i++) {
    const value=maximum*i/4, yy=y(value);
    body+=`<path d="M 190 ${yy} H ${width-30}" stroke="#e2e8f0"/>`+text(180,yy+4,numberText(value),'text-anchor="end" fill="#475569"');
  }
  if(cumulative) {
    const path=profile.points.map((p,i)=>`${i?'L':'M'} ${x(p.time)} ${y(p.cumulative)}`).join(' ');
    body+=`<path d="${path}" fill="none" stroke="#0f766e" stroke-width="3"/>`;
    for(const p of profile.points) body+=`<circle cx="${x(p.time)}" cy="${y(p.cumulative)}" r="3" fill="#0f766e"/>`;
  } else for(const interval of profile.intervals) body+=`<rect data-start="${interval.start}" data-end="${interval.end}" data-load="${interval.load}" x="${x(interval.start)}" y="${y(interval.load)}" width="${(interval.end-interval.start)*scale}" height="${bottom-y(interval.load)}" fill="#0f766e" fill-opacity="0.8" stroke="white"/>`;
  body+=text(18,390,cumulative?'Eje vertical: recursos × unidades de tiempo':'Eje vertical: recursos simultáneos · intervalos [inicio, fin)', 'fill="#475569"');
  return root(project,`${cumulative?'Consumo acumulado':'Carga de recursos'} ${modeName(mode)}`,width,height,body);
}

const csvCell = (value: unknown) => {
  let s=String(value);
  if(typeof value==='string' && /^(?:\s*[=+@\-]|[\t\r])/.test(s)) s="'"+s;
  return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
};
const csvRows = (rows: unknown[][]) => '\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
export function scheduleCSV(project:Project,result:CPMResult,mode:ScheduleMode):string {
  return csvRows([['Actividad','Inicio','Fin','Duración','Recursos','pfc','ufc','pff','uff','MT','ML','MI'],...orderedSchedule(project,result,mode).map(a=> {
    const m=result.activities[a.id];return [a.name,a.start,a.finish,a.duration,a.resources,m.es,m.ls,m.ef,m.lf,m.mt,m.ml,m.mi];
  })]);
}
export function resourceCSV(project:Project,result:CPMResult,mode:ScheduleMode):string {
  const p=buildResourceProfile(buildSchedule(project,result,mode));
  return csvRows([['Inicio incluido','Fin excluido','Recursos','Acumulado inicial','Acumulado final'],...p.intervals.map(i=>[i.start,i.end,i.load,i.cumulativeStart,i.cumulativeEnd])]);
}

export async function downloadSVGImage(svg:string,filename:string,format:'svg'|'png'):Promise<void> {
  if(format==='svg') {downloadFile(`${filename}.svg`,svg,'image/svg+xml;charset=utf-8');return;}
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try {
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('No se pudo preparar la imagen.'));image.src=url;});
    const scale=Math.min(2,8192/Math.max(image.width,image.height),Math.sqrt(16_000_000/(image.width*image.height)));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(image.width*scale));canvas.height=Math.max(1,Math.ceil(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo crear el PNG.');
    context.scale(scale,scale);context.drawImage(image,0,0);
    const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo exportar PNG.')),'image/png'));
    downloadFile(`${filename}.png`,png,'image/png');
  } finally {URL.revokeObjectURL(url);}
}

function table(headers:string[],rows:unknown[][]):string {
  return `<table><thead><tr>${headers.map(h=>`<th>${escapeMarkup(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escapeMarkup(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
/** Report intentionally limits route preview and discloses it; the app paginates all routes. */
export function buildReportHTML(project:Project,result:CPMResult):string {
  const sections:string[]=[];
  const section=(title:string,content:string)=>sections.push(`<section><h2>${escapeMarkup(title)}</h2>${content}</section>`);
  section('a) Red lógica',exportSVG({...project,preferences:{...project.preferences,showDates:false},presentation:{...(project.presentation??defaultPresentation()),activeView:'network'}}));
  section('b) Red resuelta',exportSVG({...project,preferences:{...project.preferences,showDates:true},presentation:{...(project.presentation??defaultPresentation()),activeView:'resolved'}},result));
  section('Fechas y márgenes por sucesos AOA',table(['Actividad','d','pfc','ufc','pff','uff','MT','ML','MI'],project.activities.map(a=>{const m=result.activities[a.id];return [a.name,...[a.duration,m.es,m.ls,m.ef,m.lf,m.mt,m.ml,m.mi].map(numberText)];})));
  section('Márgenes por precedencias',table(['Actividad','MT','ML','MI'],project.activities.filter(a=>!a.dummy).map(a=>{const m=result.logical[a.id];return [a.name,...[m.mt,m.ml,m.mi].map(numberText)];})));
  const routes:string[][]=[];
  for(const route of criticalPaths(project,result)){routes.push(route);if(routes.length===11)break;}
  section('d) Actividades y rutas críticas',`<p>Duración: ${numberText(result.duration)}. Actividades: ${escapeMarkup(project.activities.filter(a=>!a.dummy&&result.activities[a.id].critical).map(a=>a.name).join(', '))}.</p><ol>${routes.slice(0,10).map(route=>`<li>${escapeMarkup(route.join(' → '))}</li>`).join('')}</ol>${routes.length>10?'<p>Vista previa: primeras 10 rutas. Existen más rutas; consulte la paginación completa en la aplicación.</p>':''}`);
  for(const mode of ['early','late'] as const) {
    for(const kind of ['calendar','gantt'] as const) section(`${kind==='calendar'?'Calendario':'Gantt'} ${modeName(mode)}`,renderScheduleSVG(project,result,mode,kind));
    section(`Carga de recursos ${modeName(mode)}`,renderResourceSVG(project,result,mode,false));
    section(`Consumo acumulado ${modeName(mode)}`,renderResourceSVG(project,result,mode,true));
    const p=buildResourceProfile(buildSchedule(project,result,mode));
    section(`Intervalos de recursos ${modeName(mode)}`,table(['Inicio','Fin','Carga','Acumulado inicial','Acumulado final'],p.intervals.map(i=>[i.start,i.end,i.load,i.cumulativeStart,i.cumulativeEnd].map(numberText))));
  }
  section('Desarrollo del cálculo',buildSolutionTrace(project,result).map(s=>`<article><h3>${escapeMarkup(s.title)}</h3><p>${escapeMarkup(s.formula)}</p><p>${escapeMarkup(s.substitution)}</p></article>`).join(''));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeMarkup(project.name)} · CPM Studio</title><style>body{font:14px Arial,sans-serif;color:#0f172a;margin:32px auto;max-width:1200px;padding:0 24px}h1,h2{color:#0f766e}section{margin:32px 0;break-inside:avoid}svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#f1f5f9}article{break-inside:avoid}h3{font-size:14px;margin-bottom:6px}p{line-height:1.5}@media print{body{margin:0;padding:0}section{break-inside:auto}h2{break-after:avoid}svg,table{break-inside:avoid}}</style></head><body><h1>${escapeMarkup(project.name)}</h1><p>CPM determinista · Duración ${numberText(result.duration)} unidades de tiempo. Use Imprimir en su navegador para guardar como PDF.</p><p>Ft/FT: fechas de sucesos. pfc/ufc/pff/uff: fechas de actividades. Los márgenes por sucesos y por precedencias pueden diferir debido a las ficticias. Recursos sin nivelación ni restricciones de disponibilidad.</p>${sections.join('')}<footer>Generado íntegramente en el navegador con CPM Studio.</footer></body></html>`;
}
