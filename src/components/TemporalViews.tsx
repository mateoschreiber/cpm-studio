import { useMemo, useState } from 'react';
import { buildResourceProfile, buildSchedule } from '../core/academic';
import type { CPMResult, Project } from '../core/types';
import { numberText, useProjectStore } from '../store';
import { downloadSVGImage, orderedSchedule, renderResourceSVG, renderScheduleSVG, resourceCSV, scheduleCSV, type ScheduleMode } from '../services/academicExport';
import { downloadFile } from '../services/persistence';
import './temporal.css';

export function TemporalViews({kind,project,result,selectedId,onSelect}: {
  kind:'calendar'|'gantt'|'resources';project:Project;result:CPMResult;selectedId?:string|null;onSelect:(id:string)=>void;
}) {
  const [mode,setMode]=useState<ScheduleMode>('early');
  const [cumulative,setCumulative]=useState(false);
  const [status,setStatus]=useState('');
  const [exporting,setExporting]=useState(false);
  const setPresentation=useProjectStore(s=>s.setPresentation);
  const schedule=useMemo(()=>orderedSchedule(project,result,mode),[project,result,mode]);
  const profile=useMemo(()=>buildResourceProfile(buildSchedule(project,result,mode)),[project,result,mode]);
  const svg=useMemo(()=>kind==='resources'?renderResourceSVG(project,result,mode,cumulative):renderScheduleSVG(project,result,mode,kind),[kind,project,result,mode,cumulative]);
  const selected=schedule.find(a=>a.id===selectedId), selectedIndex=schedule.findIndex(a=>a.id===selectedId);
  const scale=project.presentation?.timeScale??48;
  const title=kind==='calendar'?'Calendario':kind==='gantt'?'Gantt':'Recursos';
  const modeTitle=mode==='early'?'temprano':'tardío';
  function reorder(direction:-1|1) {
    const order=schedule.map(a=>a.id), index=selectedIndex+direction;
    if(selectedIndex<0||index<0||index>=order.length)return;
    [order[selectedIndex],order[index]]=[order[index],order[selectedIndex]];
    setPresentation({rowOrder:order});
  }
  async function image(format:'svg'|'png') {
    setExporting(true);setStatus('');
    try{await downloadSVGImage(svg,`${project.name}-${title}-${modeTitle}`,format);setStatus(`Exportación ${format.toUpperCase()} preparada.`);}
    catch(error){setStatus(error instanceof Error?error.message:'No se pudo exportar el gráfico.');}
    finally{setExporting(false);}
  }
  return <section className="temporal-workspace" aria-label={title} data-motion={project.presentation?.motion===false?'off':'on'}>
    <header className="temporal-header">
      <div><span className="temporal-eyebrow">PROGRAMACIÓN DEL PROYECTO</span><h2>{title}</h2><p>{kind==='resources'?'Consumo derivado de la ejecución simultánea, sin nivelación.':'Fechas calculadas, posiciones temporales exactas y presentación ajustable.'}</p></div>
      <div className="temporal-mode" role="group" aria-label="Programación"><button aria-pressed={mode==='early'} onClick={()=>setMode('early')}>Temprana</button><button aria-pressed={mode==='late'} onClick={()=>setMode('late')}>Tardía</button></div>
    </header>
    <div className="temporal-toolbar">
      <label>Escala <input aria-label="Escala temporal" type="range" min="16" max="120" value={scale} onChange={e=>setPresentation({timeScale:Number(e.target.value)})}/><span>{scale} px/u</span></label>
      {kind==='resources'?<div className="temporal-mode" role="group" aria-label="Gráfico de recursos"><button aria-pressed={!cumulative} onClick={()=>setCumulative(false)}>Carga</button><button aria-pressed={cumulative} onClick={()=>setCumulative(true)}>Acumulado</button></div>:<>
        <button onClick={()=>setPresentation({rowOrder:[...schedule].sort((a,b)=>Number(b.critical)-Number(a.critical)).map(a=>a.id)})}>Críticas primero</button>
        <button disabled={selectedIndex<=0} onClick={()=>reorder(-1)} aria-label="Subir actividad">↑ Subir</button>
        <button disabled={selectedIndex<0||selectedIndex===schedule.length-1} onClick={()=>reorder(1)} aria-label="Bajar actividad">↓ Bajar</button>
        <label>Desplazamiento vertical <input aria-label="Desplazamiento vertical de actividad" type="number" min="-20" max="40" disabled={!selected} value={selected?(project.presentation?.rowOffsets[selected.id]??0):0} onChange={e=>{if(selected&&e.target.value!==''&&Number.isFinite(Number(e.target.value)))setPresentation({rowOffsets:{...project.presentation?.rowOffsets,[selected.id]:Math.max(-20,Math.min(40,Number(e.target.value)))}});}}/></label>
      </>}
      <div className="temporal-export"><button disabled={exporting} onClick={()=>void image('svg')}>SVG</button><button disabled={exporting} onClick={()=>void image('png')}>PNG</button><button onClick={()=>downloadFile(`${project.name}-${title}-${modeTitle}.csv`,kind==='resources'?resourceCSV(project,result,mode):scheduleCSV(project,result,mode),'text/csv;charset=utf-8')}>CSV</button></div>
    </div>
    <div className="temporal-stats">
      <div><span>Duración del proyecto</span><strong>{numberText(result.duration)} <small>u. tiempo</small></strong></div>
      {kind==='resources'?<><div><span>Pico de carga</span><strong>{numberText(profile.peak)} <small>recursos</small></strong></div><div><span>Consumo total</span><strong>{numberText(profile.total)} <small>recursos·tiempo</small></strong></div></>:<><div><span>Programación</span><strong>{mode==='early'?'Fechas tempranas':'Fechas tardías'}</strong></div><div><span>Actividad seleccionada</span><strong>{selected?.name??'Ninguna'}</strong></div></>}
    </div>
    <div className="temporal-plot" onClick={e=>{const target=(e.target as Element).closest('[data-activity-id]');const id=target?.getAttribute('data-activity-id');if(id)onSelect(id);}} dangerouslySetInnerHTML={{__html:svg}}/>
    <p className="temporal-note">{kind==='calendar'?'La línea continua mide la ejecución. La línea discontinua es espera hasta el suceso o antes del comienzo tardío. Los rombos muestran las fechas de los sucesos.':kind==='gantt'?'La ventana gris pfc–uff incluye la duración y el margen total. Una actividad de duración cero se representa con una marca de instante.':'Intervalos [inicio, fin): una actividad que termina en un instante ya no consume recursos cuando otra empieza en ese mismo instante. Las ficticias y actividades de duración cero no consumen recursos·tiempo.'}</p>
    <div role="status" aria-live="polite">{status}</div>
    <div className="temporal-table-wrap">
      {kind==='resources'?<table className="temporal-table"><caption>Intervalos de recursos · programación {mode==='early'?'temprana':'tardía'}</caption><thead><tr><th>Inicio incluido</th><th>Fin excluido</th><th>Carga</th><th>Acumulado inicial</th><th>Acumulado final</th></tr></thead><tbody>{profile.intervals.map((interval,i)=><tr key={i}>{[interval.start,interval.end,interval.load,interval.cumulativeStart,interval.cumulativeEnd].map((v,j)=><td key={j}>{numberText(v)}</td>)}</tr>)}</tbody></table>:<table className="temporal-table"><caption>Fechas de actividades · seleccione una fila para ajustar su presentación</caption><thead><tr><th>Actividad</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>pfc</th><th>ufc</th><th>pff</th><th>uff</th><th>MT</th></tr></thead><tbody>{schedule.map(a=>{const m=result.activities[a.id];return <tr key={a.id} className={a.id===selectedId?'selected':''}><th><button aria-pressed={a.id===selectedId} onClick={()=>onSelect(a.id)}>{a.name}{a.dummy?' · ficticia':a.critical?' · crítica':''}</button></th>{[a.start,a.finish,a.duration,m.es,m.ls,m.ef,m.lf,m.mt].map((v,i)=><td key={i}>{numberText(v)}</td>)}</tr>;})}</tbody></table>}
    </div>
  </section>;
}
