import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, type Connection } from "@xyflow/react";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  FileJson,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Network,
  Route,
  Save,
  Table2,
  TriangleAlert,
  Workflow,
  X,
  CalendarDays, BarChart3, BookOpen, Files, FileText, Moon, Sun, Diamond,
} from "lucide-react";
import {
  emptyProject,
  defaultEdgeVisual,
  defaultPresentation,
  type Project,
  type TableRow,
  type AppView,
} from "./core/types";
import {
  extractPrecedences,
  validateTable,
} from "./core/engine";
import { generateAOA } from "./core/generate";
import { fourteenRows, guideProject } from "./core/fixtures";
import {
  downloadFile,
  parseProject,
  serializeProject,
} from "./services/persistence";
import { generateInWorker, layoutInWorker, cancelJobs } from './services/jobs';
import { displayProject, repairVisual } from './services/presentation';
import { useLibrary } from './hooks/useLibrary';
import { usePWA } from './hooks/usePWA';
import {useCPM} from './hooks/useCPM';
import { LibraryDialog } from './components/LibraryDialog';
import { currentVisual, numberText, uid, useProjectStore } from "./store";
import type { Tool } from "./components/NetworkCanvas";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { ActivityTable } from "./components/ActivityTable";
import { Results } from "./components/Results";
import { CommitInput } from "./components/Fields";

const SolutionView=lazy(()=>import('./components/SolutionView'));
const ReportView=lazy(()=>import('./components/ReportView'));
const TemporalViews=lazy(()=>import('./components/TemporalViews').then(m=>({default:m.TemporalViews})));

type Confirmation = {
  title: string;
  description: string;
  details?: string[];
  apply: () => void;
};
type PanelTab = "activities" | "results" | "validation";

export default function App() {
  const project=useProjectStore(s=>s.project),edit=useProjectStore(s=>s.edit),replace=useProjectStore(s=>s.replace),undo=useProjectStore(s=>s.undo),redo=useProjectStore(s=>s.redo),setPresentation=useProjectStore(s=>s.setPresentation);
  const library=useLibrary(),pwa=usePWA();
  const [libraryOpen,setLibraryOpen]=useState(false);
  const view=project.presentation?.activeView??'network';
  const shownProject=useMemo(()=>displayProject(project),[project]);
  const tableProject=useMemo(()=>({...emptyProject(),id:project.id,name:project.name,events:project.events,activities:project.activities,presentation:{...defaultPresentation(),draftRows:project.presentation?.draftRows}}),[project.id,project.name,project.events,project.activities,project.presentation?.draftRows]);
  const requestRowsRef=useRef<(rows:TableRow[])=>Promise<void>>(async()=>{});
  const applyRows=useCallback((rows:TableRow[])=>{void requestRowsRef.current(rows);},[]);
  const updateScalar=useCallback((id:string,patch:Partial<Pick<TableRow,'duration'|'resources'>>)=>edit(p=>{const activity=p.activities.find(a=>a.id===id);if(activity&&!activity.dummy)Object.assign(activity,patch);}),[edit]);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("activities");
  const [dirty, setDirty] = useState(false);
  const [tableEpoch, setTableEpoch] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState('');
  const saved=library.ready&&!library.saving&&!library.error;
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const latestRequest = useRef(0);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const {result,errors}=useCPM();
  useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)'); const apply=()=>{document.documentElement.dataset.theme=project.presentation?.theme==='system'?(media.matches?'dark':'light'):project.presentation?.theme??'light';document.documentElement.dataset.motion=project.presentation?.motion===false?'reduced':'full';};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[project.presentation?.theme,project.presentation?.motion]);
  const onSelection = useCallback((nodes?: string[], edges?: string[]) => {
    if (nodes !== undefined)
      setSelectedNodes((prev) =>
        JSON.stringify(prev) === JSON.stringify(nodes) ? prev : nodes,
      );
    if (edges !== undefined)
      setSelectedEdges((prev) =>
        JSON.stringify(prev) === JSON.stringify(edges) ? prev : edges,
      );
  }, []);
  const reframe=useCallback(() => {
    const duration=useProjectStore.getState().project.presentation?.motion===false||matchMedia('(prefers-reduced-motion: reduce)').matches?0:220;
    window.setTimeout(() => void fitView({ padding: 0.25, duration }), 80);
  },[fitView]);
  useEffect(() => {
    if (library.ready&&useProjectStore.getState().project.events.length) reframe();
  }, [library.ready,project.id,reframe]);
  function changeView(next:AppView){if(next==='resolved'&&!project.presentation?.resolved)setPresentation({activeView:next,resolved:structuredClone(project.visual)});else setPresentation({activeView:next});setTool('select');setConnectionStart(null);}
  function install(next: Project, frame = false) {
    replace(next);
    setSelectedNodes([]);
    setSelectedEdges([]);
    setConnectionStart(null);
    setTool("select");
    setTableEpoch((n) => n + 1);
    if (frame) reframe();
  }
  function confirmReplace(next: Project, title: string) {
    document
      .querySelectorAll("details[open]")
      .forEach((menu) => menu.removeAttribute("open"));
    if (!project.events.length && !project.activities.length && !dirty) {
      install(next, true);
      return;
    }
    setConfirmation({
      title,
      description:
        "Se reemplazará la red vigente. Puedes recuperar la anterior con Deshacer. Descarga el JSON si quieres conservar una copia independiente.",
      apply: () => install(next, true),
    });
  }
  function newEvent(point?: { x: number; y: number }) {
    const id = uid();
    let label = 0;
    while (project.events.some((e) => e.label === String(label))) label++;
    edit((p) => {
      p.events.push({ id, label: String(label) });
      p.visual.nodes[id] =
        point ??
        screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 3,
        });
    });
    onSelection([id], []);
  }
  function nextActivityName() {
    let i = 0;
    while (
      project.activities.some(
        (a) => a.name === (i < 26 ? String.fromCharCode(65 + i) : `A${i + 1}`),
      )
    )
      i++;
    return i < 26 ? String.fromCharCode(65 + i) : `A${i + 1}`;
  }
  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) {
      setNotice("Una actividad debe conectar dos sucesos diferentes.");
      return;
    }
    const id = uid(),
      dummy = tool === "dummy";
    edit((p) => {
      p.activities.push({
        id,
        name: dummy
          ? `f${p.activities.filter((a) => a.dummy).length + 1}`
          : nextActivityName(),
        source: connection.source,
        target: connection.target,
        duration: 0,
        resources: 0,
        dummy,
      });
      const parallel =
        p.activities.filter(
          (a) =>
            a.source === connection.source && a.target === connection.target,
        ).length - 1;
      p.visual.edges[id] = {
        ...defaultEdgeVisual(),
        ...(parallel ? { kind: "curve" as const, bend: parallel * 70 } : {}),
      };
    });
    onSelection([], [id]);
    setConnectionStart(null);
  }
  function clickEvent(id: string) {
    if (tool !== "activity" && tool !== "dummy") return;
    if (!connectionStart) {
      setConnectionStart(id);
      onSelection([id], []);
    } else
      connect({
        source: connectionStart,
        target: id,
        sourceHandle: "out",
        targetHandle: "in",
      });
  }
  function removeSelection() {
    if (!selectedNodes.length && !selectedEdges.length) return;
    edit((p) => {
      const removed = new Set([
        ...selectedEdges,
        ...p.activities
          .filter(
            (a) =>
              selectedNodes.includes(a.source) ||
              selectedNodes.includes(a.target),
          )
          .map((a) => a.id),
      ]);
      p.activities = p.activities.filter((a) => !removed.has(a.id));
      p.events = p.events.filter((e) => !selectedNodes.includes(e.id));
      for (const id of removed) delete p.visual.edges[id];
      for (const id of selectedNodes) delete p.visual.nodes[id];
    });
    onSelection([], []);
  }
  function duplicateSelection() {
    const nodes: string[] = [],
      edges: string[] = [];
    edit((p) => {
      const ids = new Map<string, string>();
      const visual=currentVisual(p);
      for (const old of project.events.filter((e) =>
        selectedNodes.includes(e.id),
      )) {
        const id = uid();
        ids.set(old.id, id);
        nodes.push(id);
        let label = 0;
        while (p.events.some((e) => e.label === String(label))) label++;
        p.events.push({ id, label: String(label) });
        const pos = visual.nodes[old.id];
        p.visual.nodes[id] = { x: pos.x + 40, y: pos.y + 40 };
      }
      for (const a of project.activities.filter(
        (a) =>
          selectedEdges.includes(a.id) ||
          (ids.has(a.source) && ids.has(a.target)),
      )) {
        const id = uid();
        edges.push(id);
        let name = `${a.name}_copia`,
          i = 2;
        while (p.activities.some((a) => a.name === name))
          name = `${a.name}_copia${i++}`;
        p.activities.push({
          ...a,
          id,
          name,
          source: ids.get(a.source) ?? a.source,
          target: ids.get(a.target) ?? a.target,
        });
        p.visual.edges[id] = {
          ...(visual.edges[a.id] ?? defaultEdgeVisual()),
          kind: "curve",
          bend: (visual.edges[a.id]?.bend ?? 0) + 60,
        };
      }
    });
    onSelection(nodes, edges);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], dialog',
        )
      )
        return;
      if (confirmation || help) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelection();
      } else if (event.key === "Escape") {
        setTool("select");
        setConnectionStart(null);
        onSelection([], []);
      } else if (event.key.toLowerCase() === "v") setTool("select");
      else if (event.key.toLowerCase() === "n") setTool("event");
      else if (event.key.toLowerCase() === "a") setTool("activity");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function requestRows(rows: TableRow[]) {
    const errors = rows.length ? validateTable(rows) : [];
    if (errors.length) return;
    const current = useProjectStore.getState().project;
    const oldRows = extractPrecedences(current);
    const structure = (data: TableRow[]) =>
      JSON.stringify(
        data
          .map((r) => [r.id, [...r.predecessors].sort()])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      );
    if (structure(rows) === structure(oldRows)) {
      edit((p) => {
        for (const row of rows) {
          const a = p.activities.find((a) => a.id === row.id)!;
          a.name = row.name;
          a.duration = row.duration;
          a.resources = row.resources;
        }
      });
      return;
    }
    const request = ++latestRequest.current;
    setBusy(true);
    try {
      const next = rows.length
        ? await generateInWorker(rows, current)
        : {
            ...emptyProject(),
            name: current.name,
            preferences: current.preferences,
          };
      next.id=current.id; next.presentation={...current.presentation!,draftRows:undefined,resolved:current.presentation?.resolved?repairVisual(next,current.presentation.resolved):undefined};
      if (
        request !== latestRequest.current ||
        current.activities !== useProjectStore.getState().project.activities || current.events !== useProjectStore.getState().project.events
      )
        return;
      const deletedEvents = current.events.filter(
        (e) => !next.events.some((n) => n.id === e.id),
      );
      const deletedEdges = current.activities.filter(
        (a) => !next.activities.some((n) => n.id === a.id),
      );
      const reconnected = current.activities.filter((a) =>
        next.activities.some(
          (n) =>
            n.id === a.id && (a.source !== n.source || a.target !== n.target),
        ),
      );
      const applyGenerated=()=>{const latest=useProjectStore.getState().project;install({...next,id:latest.id,name:latest.name,preferences:latest.preferences,visual:repairVisual(next,latest.visual),presentation:{...latest.presentation!,draftRows:undefined,resolved:latest.presentation?.resolved?repairVisual(next,latest.presentation.resolved):undefined}},!current.events.length);};
      if (deletedEvents.length || deletedEdges.length || reconnected.length)
        setConfirmation({
          title: "Actualizar la estructura de la red",
          description:
            "El cambio de precedencias necesita adaptar sucesos y flechas. Las posiciones de los elementos reutilizables se conservarán.",
          details: [
            `${deletedEvents.length} sucesos eliminados`,
            `${deletedEdges.length} flechas eliminadas`,
            `${reconnected.length} actividades reconectadas`,
          ],
          apply: () => {
            if (current.activities !== useProjectStore.getState().project.activities || current.events !== useProjectStore.getState().project.events) {
              setNotice(
                "La red cambió mientras confirmabas. Aplica nuevamente el borrador.",
              );
              return;
            }
            applyGenerated();
          },
        });
      else applyGenerated();
    } catch (e) {
      if((e as Error).name!=='AbortError')setNotice((e as Error).message);
    } finally {
      if (request === latestRequest.current) setBusy(false);
    }
  }
  requestRowsRef.current=requestRows;
  async function arrange() {
    if (!project.events.length) return;
    const current = project;
    const request=++latestRequest.current;
    setBusy(true);
    try {
      let next = await layoutInWorker(shownProject);
      if(view==='resolved')next={...current,presentation:{...current.presentation!,resolved:next.visual}};
      if (request===latestRequest.current&&useProjectStore.getState().project === current) {
        replace(next);
        reframe();
      } else
        setNotice(
          "La red cambió durante la distribución. Vuelve a solicitarla.",
        );
    } catch (error) {
      if((error as Error).name!=='AbortError')setNotice("No se pudo distribuir esta red. Tus posiciones se conservan.");
    } finally {
      if(request===latestRequest.current)setBusy(false);
    }
  }
  const criticalCount = result
    ? project.activities.filter(
        (a) => !a.dummy && result.activities[a.id].critical,
      ).length
    : 0;
  if(!library.ready)return <div className="app-loading"><Route size={38}/><h1>CPM Studio</h1><p>Abriendo tu espacio de trabajo…</p></div>;
  return (
    <div className="app-shell" aria-busy={busy}>
      <header className="app-header">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Route size={23} />
          </span>
          <span>
            CPM<span className="brand-light"> Studio</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="header-subtitle">Investigación de operaciones</span>
        <span className="local-badge">
          <span />
          Local · sin conexión requerida
        </span>
        <button className="icon-button" aria-label="Cambiar tema" title="Cambiar tema" onClick={()=>setPresentation({theme:document.documentElement.dataset.theme==='dark'?'light':'dark'})}>{document.documentElement.dataset.theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
        <button
          className="icon-button help-button"
          aria-label="Ayuda y atajos"
          title="Ayuda y atajos"
          onClick={() => setHelp(true)}
        >
          <HelpCircle size={20} />
        </button>
      </header>
      <div className="main-layout">
        <nav className="nav-rail" aria-label="Vistas del proyecto">
          <button
            className={tab === "activities" ? "active" : ""}
            aria-label="Editor y actividades"
            title="Editor y actividades"
            onClick={() => setTab("activities")}
          >
            <Network size={21} />
          </button>
          <button
            className={tab === "results" ? "active" : ""}
            aria-label="Ver resultados"
            title="Resultados CPM"
            onClick={() => setTab("results")}
          >
            <ChartNoAxesCombined size={21} />
          </button>
          <button
            className={tab === "validation" ? "active" : ""}
            aria-label="Ver validación"
            title="Validación"
            onClick={() => setTab("validation")}
          >
            <Check size={21} />
          </button>
          <div className="rail-spacer" />
          <button
            aria-label="Ayuda"
            title="Ayuda"
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={21} />
          </button>
          <span className="rail-version">v0.2</span>
        </nav>
        <main className="workspace">
          <div className="project-heading">
            <div>
              <div className="breadcrumb">
                ESPACIO DE TRABAJO <span>/</span> MÉTODO DEL CAMINO CRÍTICO
              </div>
              <div className="project-title">
                <CommitInput
                  label="Nombre del proyecto"
                  value={project.name}
                  onCommit={(name) =>
                    edit((p) => {
                      p.name = name.trim() || "Proyecto sin título";
                    })
                  }
                />
                <span className="project-type">CPM / AOA</span>
              </div>
              <div className="save-status" aria-live="polite">
                <span className={saved ? "status-dot" : "status-dot unsaved"} />
                {saved
                  ? "Guardado en este navegador"
                  : library.error
                    ? "Recuperación pendiente"
                    : "Guardando…"}
                <span className="status-separator">·</span>
                {project.events.length} sucesos,{" "}
                {project.activities.filter((a) => !a.dummy).length} actividades
              </div>
            </div>
            <div className="project-actions">
              <button onClick={()=>{void library.refresh();setLibraryOpen(true);}}><Files size={16}/><span>Proyectos</span></button>
              <button
                title="Nuevo proyecto"
                onClick={() =>
                  confirmReplace(emptyProject(), "Crear un proyecto nuevo")
                }
              >
                <FilePlus2 size={16} />
                <span>Nuevo</span>
              </button>
              <button onClick={() => fileInput.current?.click()}>
                <FolderOpen size={16} />
                <span>Abrir</span>
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  downloadFile(
                    `${project.name}.json`,
                    serializeProject(project),
                  );
                  setNotice(
                    "Proyecto JSON descargado. Incluye la red y su distribución gráfica.",
                  );
                }}
              >
                <Save size={16} />
                Guardar JSON
              </button>
            </div>
          </div>
          {!!(notice||library.error) && (
            <div className="notice" role="status">
              <TriangleAlert size={16} />
              <span>{notice||library.error}</span>
              <button aria-label="Cerrar aviso" onClick={() => {setNotice('');library.setError(null);}}>
                <X size={15} />
              </button>
            </div>
          )}
          {(pwa.offlineReady||pwa.needRefresh)&&<div className="pwa-banner" role="status"><Check size={16}/><span>{pwa.needRefresh?'Hay una actualización disponible. Guarda tu trabajo antes de aplicarla.':'Aplicación lista para trabajar sin conexión, incluidas todas sus vistas.'}</span>{pwa.needRefresh&&<button disabled={!saved||dirty||busy} onClick={async()=>{if(await library.flushAndSave())await pwa.applyUpdate();}}>Aplicar actualización</button>}<button aria-label="Cerrar aviso offline" onClick={pwa.dismiss}><X size={15}/></button></div>}
          <div className="summary-strip">
            <div className="summary-item">
              <span className="summary-icon">
                <Workflow size={19} />
              </span>
              <div>
                <span>Duración del proyecto</span>
                <strong>
                  <span data-testid="project-duration">
                    {result ? numberText(result.duration) : "—"}
                  </span>
                  <small> unidades de tiempo</small>
                </strong>
              </div>
            </div>
            <div className="summary-item">
              <span className="summary-icon critical">
                <Route size={19} />
              </span>
              <div>
                <span>Actividades críticas</span>
                <strong>
                  {result ? criticalCount : "—"}
                  <small>
                    {" "}
                    de {project.activities.filter((a) => !a.dummy).length}{" "}
                    actividades reales
                  </small>
                </strong>
              </div>
            </div>
            <div className="summary-item network-state">
              <span className={`validation-symbol ${result ? "valid" : ""}`}>
                {result ? <Check size={18} /> : <TriangleAlert size={18} />}
              </span>
              <div>
                <span>Estado de la red</span>
                <strong>
                  {result ? "Red válida" : "En edición"}
                  <small>
                    {dirty
                      ? " · tabla pendiente"
                      : result
                        ? " · cálculo actualizado"
                        : " · completa las conexiones"}
                  </small>
                </strong>
              </div>
            </div>
          </div>
          <nav className="workspace-view-tabs" aria-label="Módulos académicos">{([{id:'network',label:'Red lógica',icon:Network},{id:'resolved',label:'Red resuelta',icon:Diamond},{id:'solution',label:'Resolución',icon:BookOpen},{id:'calendar',label:'Calendario',icon:CalendarDays},{id:'gantt',label:'Gantt',icon:BarChart3},{id:'resources',label:'Recursos',icon:ChartNoAxesCombined},{id:'report',label:'Informe',icon:FileText}] as const).map(item=><button key={item.id} className={view===item.id?'active':''} aria-current={view===item.id?'page':undefined} onClick={()=>changeView(item.id)}><item.icon size={17}/>{item.label}</button>)}</nav>
          <Suspense fallback={<div className="view-loading">Preparando vista…</div>}>
            {view==='solution'&&<SolutionView project={project} result={result} onSelect={(id,activity)=>onSelection(activity?[]:[id],activity?[id]:[])}/>}
            {(['calendar','gantt','resources'] as string[]).includes(view)&&(result?<TemporalViews kind={view as 'calendar'|'gantt'|'resources'} project={project} result={result} selectedId={selectedEdges[0]} onSelect={id=>onSelection([],[id])}/>:<div className="view-empty"><h2>Completa una red válida</h2><p>Los diagramas temporales requieren fechas calculadas.</p></div>)}
            {view==='report'&&<ReportView project={project} result={result}/>}
          </Suspense>
          <EditorWorkspace
            project={project} shownProject={shownProject} result={result}
            tool={tool} setTool={setTool}
            selectedNodes={selectedNodes} selectedEdges={selectedEdges}
            connectionStart={connectionStart} setConnectionStart={setConnectionStart}
            busy={busy} onSelection={onSelection} newEvent={newEvent}
            connect={connect} clickEvent={clickEvent}
            duplicateSelection={duplicateSelection} removeSelection={removeSelection}
            arrange={arrange} setNotice={setNotice}
            onFitView={reframe}
            onCancelOperation={() => { cancelJobs(); setBusy(false); latestRequest.current++; }}
          />
          <section className="data-card" aria-label="Datos del proyecto" hidden={!['network','resolved'].includes(view)}>
            <div
              className="data-tabs"
              role="tablist"
              aria-label="Paneles del proyecto"
            >
              <button
                role="tab"
                aria-selected={tab === "activities"}
                className={tab === "activities" ? "active" : ""}
                onClick={() => setTab("activities")}
              >
                <Table2 size={16} />
                Actividades
                <span>{project.activities.filter((a) => !a.dummy).length}</span>
              </button>
              <button
                role="tab"
                aria-selected={tab === "results"}
                className={tab === "results" ? "active" : ""}
                onClick={() => setTab("results")}
              >
                <ChartNoAxesCombined size={16} />
                Resultados CPM
              </button>
              <button
                role="tab"
                aria-selected={tab === "validation"}
                className={tab === "validation" ? "active" : ""}
                onClick={() => setTab("validation")}
              >
                <Check size={16} />
                Validación
                {errors.length > 0 && project.events.length > 0 && (
                  <span className="error-count">{errors.length}</span>
                )}
              </button>
              <div className="toolbar-spacer" />
              <details className="examples-menu">
                <summary>
                  <FileJson size={15} />
                  Ejercicios de referencia
                  <ChevronDown size={13} />
                </summary>
                <div className="menu-popover">
                  <button
                    onClick={() =>
                      confirmReplace(guideProject(), "Cargar el ejercicio guía")
                    }
                  >
                    <Route size={15} />
                    Guía · 5 actividades
                  </button>
                  <button
                    onClick={() =>
                      confirmReplace(
                        generateAOA(fourteenRows),
                        "Cargar el ejercicio de 14 actividades",
                      )
                    }
                  >
                    <Network size={15} />
                    Ejercicio · 14 actividades
                  </button>
                </div>
              </details>
            </div>
            <div hidden={tab !== "activities"} role="tabpanel">
              <ActivityTable
                key={project.id}
                project={tableProject}
                syncToken={tableEpoch}
                onApply={applyRows}
                onScalar={updateScalar}
                onDraftState={setDirty}
                busy={busy}
              />
            </div>
            <div hidden={tab !== "results"} role="tabpanel">
              <Results
                project={tableProject}
                result={result}
                errors={errors}
                dirty={dirty}
              />
            </div>
            <div hidden={tab !== "validation"} role="tabpanel">
              <div className="validation-panel">
                <h3>
                  {result ? (
                    <>
                      <Check size={19} />
                      La red está lista para resolver
                    </>
                  ) : (
                    <>
                      <TriangleAlert size={19} />
                      Validación de la red
                    </>
                  )}
                </h3>
                {errors.length ? (
                  <ul>
                    {errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Sin ciclos, extremos inexistentes ni elementos aislados.
                    Duraciones y recursos válidos.
                  </p>
                )}
                <p className="muted">
                  Puedes guardar redes incompletas y continuar editándolas. Solo
                  las redes válidas muestran resultados definitivos.
                </p>
                {dirty && (
                  <div className="draft-banner">
                    Hay cambios de tabla pendientes de aplicación.
                  </div>
                )}
              </div>
            </div>
          </section>
          <footer className="workspace-footer">
            <span>
              CPM Studio <span>·</span> Herramientas para entender cada camino
            </span>
            <span>
              Ft / FT <span>·</span> MT / ML / MI <span>·</span> AOA
            </span>
          </footer>
        </main>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Importar proyecto JSON"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (file.size > 10 * 1024 * 1024)
              throw new Error("El archivo supera el límite de 10 MB.");
            confirmReplace(
              parseProject(await file.text()),
              "Abrir proyecto JSON",
            );
          } catch (e) {
            setNotice(`No se abrió el proyecto. ${(e as Error).message}`);
          }
        }}
      />
      {libraryOpen&&<LibraryDialog projects={library.projects} onOpen={id=>{void library.open(id);setLibraryOpen(false);setSelectedEdges([]);setSelectedNodes([]);}} onDelete={id=>void library.remove(id)} onDuplicate={id=>void library.duplicate(id)} onRename={(id,name)=>void library.rename(id,name)} onClose={()=>setLibraryOpen(false)}/>}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p>{confirmation.description}</p>
          {confirmation.details && (
            <ul className="impact-list">
              {confirmation.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <div className="modal-actions">
            <button onClick={() => setConfirmation(null)}>Cancelar</button>
            <button
              className="primary-button"
              onClick={() => {
                const action = confirmation.apply;
                setConfirmation(null);
                action();
              }}
            >
              Confirmar actualización
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Un espacio para explorar el camino crítico"
          onClose={() => setHelp(false)}
        >
          <p>
            Crea sucesos con la herramienta <strong>Suceso</strong>. Para
            conectar, elige <strong>Actividad</strong> o{" "}
            <strong>Ficticia</strong> y haz clic en origen y destino. También
            puedes arrastrar entre los conectores laterales.
          </p>
          <p>
            Edita nombres, duraciones, recursos y recorridos desde Propiedades.
            Arrastra etiquetas y controles de flecha para ajustar el dibujo.
          </p>
          <dl className="shortcut-list">
            <dt>V / N / A</dt>
            <dd>Seleccionar / suceso / actividad</dd>
            <dt>Ctrl + Z / Ctrl + Mayús + Z</dt>
            <dd>Deshacer / rehacer</dd>
            <dt>Supr</dt>
            <dd>Eliminar selección</dd>
            <dt>Mayús + clic</dt>
            <dd>Selección múltiple</dd>
            <dt>Rueda / botón central</dt>
            <dd>Zoom / desplazar lienzo</dd>
            <dt>Escape</dt>
            <dd>Cancelar conexión o selección</dd>
          </dl>
          <p className="field-help">
            Las duraciones usan unidades de tiempo abstractas. La herramienta calcula
            CPM determinista; no incluye PERT probabilístico ni nivelación de
            recursos. Guarda un JSON para trasladar el proyecto a otro
            navegador.
          </p>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button aria-label="Cerrar diálogo" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
