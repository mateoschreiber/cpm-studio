import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sigma } from 'lucide-react';
import { buildSolutionTrace } from '../core/academic';
import type { CPMResult, Project } from '../core/types';
import { numberText, useProjectStore } from '../store';
import { ReactFlowProvider } from '@xyflow/react';
import { NetworkCanvas } from './NetworkCanvas';
import { displayProject } from '../services/presentation';
import { defaultPresentation, emptyProject } from '../core/types';

const phaseNames={validation:'Validación',forward:'Cómputo de ida',backward:'Cómputo de vuelta',activities:'Fechas de actividades',margins:'Márgenes',critical:'Camino crítico'};
export default function SolutionView({project,result,onSelect}:{project:Project;result?:CPMResult;onSelect:(id:string,activity:boolean)=>void}) {
  const setPresentation=useProjectStore(s=>s.setPresentation);
  const logical=useMemo(()=>({...emptyProject(),events:project.events,activities:project.activities}),[project.events,project.activities]);
  const steps=useMemo(()=>result?buildSolutionTrace(logical,result):[],[result,logical]);
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false);
  useEffect(()=>{setIndex(0);setPlaying(false);},[steps]);
  useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>{if(index>=steps.length-1)setPlaying(false);else setIndex(i=>i+1);},project.presentation?.motion===false?1800:1100);return()=>clearTimeout(timer);},[playing,index,steps.length,project.presentation?.motion]);
  const step=steps[Math.min(index,steps.length-1)];
  const graph=useMemo(()=>displayProject({...project,presentation:{...(project.presentation??defaultPresentation()),activeView:'resolved'}}),[project]);
  const revealed=useMemo(()=>{const visited=steps.slice(0,index+1);return {early:new Set(visited.filter(s=>s.phase==='forward').map(s=>s.targetId!)),late:new Set(visited.filter(s=>s.phase==='backward').map(s=>s.targetId!)),activities:visited.some(s=>s.phase==='activities'),margins:visited.some(s=>s.phase==='margins'),critical:visited.some(s=>s.phase==='critical')};},[steps,index]);
  if(!step)return <div className="view-empty"><Sigma size={32}/><h2>Primero, una red válida</h2><p>Completa las conexiones para desarrollar la resolución.</p></div>;
  function move(next:number){setPlaying(false);setIndex(next);const target=steps[next]?.targetId;if(target)onSelect(target,!['forward','backward'].includes(steps[next].phase));}
  return <section className="academic-view solution-view" aria-label="Resolución paso a paso"><header className="view-heading"><div><span className="eyebrow">COMPRENDER EL PROCEDIMIENTO</span><h2>Una operación a la vez</h2><p>Las fechas y los márgenes se derivan de la red vigente.</p></div><label className="check-label"><input type="checkbox" checked={project.presentation?.motion!==false} onChange={e=>setPresentation({motion:e.target.checked})}/>Animaciones didácticas</label></header>
    <div className="phase-track">{Object.entries(phaseNames).map(([phase,name])=><button key={phase} className={step.phase===phase?'active':''} onClick={()=>move(Math.max(0,steps.findIndex(s=>s.phase===phase)))}>{name}</button>)}</div>
    <div className={`solution-operation ${project.presentation?.motion!==false?'with-motion':''}`} key={step.id}><div className="step-kicker"><span>Paso {index+1} / {steps.length}</span><strong>{phaseNames[step.phase]}</strong></div><h3>{step.title}</h3><div className="equation formula">{step.formula}</div><div className="equation substitution">{step.substitution}</div>{step.value!==undefined&&<div className="solution-value">Resultado <strong>{numberText(step.value)}</strong></div>}
      {!!step.candidates.length&&<div className="candidate-list">{step.candidates.map((candidate,i)=><button key={`${candidate.id}-${i}`} className={step.determiningIds.includes(candidate.id)?'determining':''} onClick={()=>onSelect(candidate.id,step.phase!=='critical')}><span>{candidate.label}</span><strong>{numberText(candidate.value)}</strong>{step.determiningIds.includes(candidate.id)&&<small>Determina el resultado</small>}</button>)}</div>}
      {step.determiningIds.length>1&&<p className="field-help">Hay un empate: todas las alternativas marcadas determinan esta fecha.</p>}
      {step.phase==='critical'&&<p className="field-help">Consulta todas las rutas en Resultados CPM; la enumeración se realiza por páginas.</p>}
    </div>
    <div className="solution-controls"><button aria-label="Paso anterior" disabled={index===0} onClick={()=>move(index-1)}><ChevronLeft size={17}/>Anterior</button><button className="primary-button" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/ >}{playing?'Pausar':'Reproducir'}</button><button aria-label="Paso siguiente" disabled={index>=steps.length-1} onClick={()=>move(index+1)}>Siguiente<ChevronRight size={17}/></button><button aria-label="Reiniciar resolución" onClick={()=>move(0)}><RotateCcw size={16}/></button></div>
    <label className="step-progress">Progreso<input aria-label="Paso de resolución" type="range" min="0" max={steps.length-1} value={index} onChange={e=>move(Number(e.target.value))}/></label>
    <div className="solution-graph"><ReactFlowProvider><NetworkCanvas project={graph} result={result} reveal={revealed} readOnly tool="select" selectedNodes={step.targetId&&['forward','backward'].includes(step.phase)?[step.targetId]:[]} selectedEdges={step.targetId&&!['forward','backward'].includes(step.phase)?[step.targetId]:step.determiningIds} onSelection={(nodes,edges)=>{if(edges?.[0])onSelect(edges[0],true);if(nodes?.[0])onSelect(nodes[0],false);}} onAddEvent={()=>{}} onConnect={()=>{}} onEventClick={()=>{}}/></ReactFlowProvider></div>
  </section>;
}
