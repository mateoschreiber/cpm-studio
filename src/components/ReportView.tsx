import { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import type { Project, CPMResult } from '../core/types';
import { buildReportHTML } from '../services/academicExport';
import { downloadFile } from '../services/persistence';
export default function ReportView({project,result}:{project:Project;result?:CPMResult}) {
  const html=useMemo(()=>result?buildReportHTML(project,result):'',[project,result]);
  if(!result)return <div className="view-empty"><h2>El informe requiere una red válida</h2><p>Completa la red antes de presentar sus resultados.</p></div>;
  return <section className="academic-view report-view"><header className="view-heading"><div><span className="eyebrow">PRESENTACIÓN ACADÉMICA</span><h2>Del procedimiento a la entrega</h2><p>Red, fechas, márgenes, programación y recursos en un mismo informe.</p></div><div className="inline-actions"><button onClick={()=>downloadFile(`${project.name}.html`,html,'text/html')}><Download size={16}/>Descargar informe</button><button className="primary-button" onClick={()=>{const frame=document.querySelector<HTMLIFrameElement>('#report-frame');frame?.contentWindow?.focus();frame?.contentWindow?.print();}}><Printer size={16}/>Imprimir / PDF</button></div></header><iframe id="report-frame" title="Vista previa del informe académico" srcDoc={html} sandbox="allow-same-origin allow-modals" className="report-frame"/></section>;
}
