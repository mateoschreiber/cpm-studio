import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, type Connection } from "@xyflow/react";
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CirclePlus,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  HelpCircle,
  Magnet,
  Maximize,
  MousePointer2,
  Network,
  Redo2,
  Route,
  Save,
  Settings2,
  Table2,
  Trash2,
  TriangleAlert,
  Undo2,
  Workflow,
  X,
} from "lucide-react";
import {
  emptyProject,
  defaultEdgeVisual,
  type Project,
  type TableRow,
} from "./core/types";
import {
  extractPrecedences,
  solveCPM,
  validateGraph,
  validateTable,
} from "./core/engine";
import { generateAOA } from "./core/generate";
import { fourteenRows, guideProject } from "./core/fixtures";
import {
  downloadFile,
  loadProject,
  parseProject,
  saveProject,
  serializeProject,
} from "./services/persistence";
import { exportPNG, exportSVG } from "./services/export";
import { layoutProject } from "./services/layout";
import { numberText, uid, useProjectStore } from "./store";
import { NetworkCanvas, type Tool } from "./components/NetworkCanvas";
import { Inspector } from "./components/Inspector";
import { ActivityTable } from "./components/ActivityTable";
import { Results } from "./components/Results";
import { CommitInput } from "./components/Fields";

const recovered = loadProject();
if (recovered.project) useProjectStore.setState({ project: recovered.project });

type Confirmation = {
  title: string;
  description: string;
  details?: string[];
  apply: () => void;
};
type PanelTab = "activities" | "results" | "validation";

export default function App() {
  const { project, edit, replace, undo, redo, past, future } =
    useProjectStore();
  const [tool, setTool] = useState<Tool>("select");
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("activities");
  const [dirty, setDirty] = useState(false);
  const [tableEpoch, setTableEpoch] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState(recovered.error ?? "");
  const [saved, setSaved] = useState(!recovered.error);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const autoSaveBlocked = useRef(!!recovered.error);
  const originalProject = useRef(project);
  const latestRequest = useRef(0);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const graphSignature = JSON.stringify({
    events: project.events,
    activities: project.activities,
  });
  const { result, errors } = useMemo(() => {
    const errors = validateGraph(project);
    if (errors.length) return { result: undefined, errors };
    try {
      return { result: solveCPM(project), errors };
    } catch (e) {
      return { result: undefined, errors: [(e as Error).message] };
    }
  }, [graphSignature]);
  useEffect(() => {
    if (autoSaveBlocked.current && project === originalProject.current) return;
    autoSaveBlocked.current = false;
    setSaved(false);
    const timer = window.setTimeout(() => {
      const error = saveProject(project);
      setSaved(!error);
      if (error) setNotice(error);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [project]);
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
  function reframe() {
    window.setTimeout(() => void fitView({ padding: 0.25, duration: 250 }), 80);
  }
  useEffect(() => {
    if (recovered.project?.events.length) reframe();
  }, []);
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
      for (const old of project.events.filter((e) =>
        selectedNodes.includes(e.id),
      )) {
        const id = uid();
        ids.set(old.id, id);
        nodes.push(id);
        let label = 0;
        while (p.events.some((e) => e.label === String(label))) label++;
        p.events.push({ id, label: String(label) });
        const pos = p.visual.nodes[old.id];
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
          ...(p.visual.edges[a.id] ?? defaultEdgeVisual()),
          kind: "curve",
          bend: (p.visual.edges[a.id]?.bend ?? 0) + 60,
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
    try {
      let next = rows.length
        ? generateAOA(rows, current)
        : {
            ...emptyProject(),
            name: current.name,
            preferences: current.preferences,
          };
      if (!current.events.length && rows.length) {
        setBusy(true);
        next = await layoutProject(next);
      }
      if (
        request !== latestRequest.current ||
        current !== useProjectStore.getState().project
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
            if (current !== useProjectStore.getState().project) {
              setNotice(
                "La red cambió mientras confirmabas. Aplica nuevamente el borrador.",
              );
              return;
            }
            install(next);
          },
        });
      else install(next, !current.events.length);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      if (request === latestRequest.current) setBusy(false);
    }
  }
  async function arrange() {
    if (!project.events.length) return;
    const current = project;
    setBusy(true);
    try {
      const next = await layoutProject(current);
      if (useProjectStore.getState().project === current) {
        replace(next);
        reframe();
      } else
        setNotice(
          "La red cambió durante la distribución. Vuelve a solicitarla.",
        );
    } catch {
      setNotice("No se pudo distribuir esta red. Tus posiciones se conservan.");
    } finally {
      setBusy(false);
    }
  }
  const criticalCount = result
    ? project.activities.filter(
        (a) => !a.dummy && result.activities[a.id].critical,
      ).length
    : 0;
  return (
    <div className="app-shell">
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
          <span className="rail-version">v0.1</span>
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
                  : autoSaveBlocked.current
                    ? "Recuperación pendiente"
                    : "Guardando…"}
                <span className="status-separator">·</span>
                {project.events.length} sucesos,{" "}
                {project.activities.filter((a) => !a.dummy).length} actividades
              </div>
            </div>
            <div className="project-actions">
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
          {!!notice && (
            <div className="notice" role="status">
              <TriangleAlert size={16} />
              <span>{notice}</span>
              <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
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
          <section className="editor-card" aria-label="Editor de red">
            <div className="editor-toolbar">
              <div
                className="tool-group"
                role="toolbar"
                aria-label="Herramientas del editor"
              >
                {(
                  [
                    {
                      id: "select",
                      icon: MousePointer2,
                      label: "Seleccionar",
                      shortcut: "V",
                    },
                    {
                      id: "event",
                      icon: CirclePlus,
                      label: "Suceso",
                      shortcut: "N",
                    },
                    {
                      id: "activity",
                      icon: ArrowUpRight,
                      label: "Actividad",
                      shortcut: "A",
                    },
                    {
                      id: "dummy",
                      icon: Workflow,
                      label: "Ficticia",
                      shortcut: "",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    className={tool === t.id ? "active" : ""}
                    title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""}`}
                    onClick={() => {
                      setTool(t.id);
                      setConnectionStart(null);
                    }}
                  >
                    <t.icon size={17} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="toolbar-separator" />
              <div className="tool-group">
                <button
                  aria-label="Deshacer"
                  title="Deshacer (Ctrl+Z)"
                  disabled={!past.length}
                  onClick={undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  aria-label="Rehacer"
                  title="Rehacer (Ctrl+Mayús+Z)"
                  disabled={!future.length}
                  onClick={redo}
                >
                  <Redo2 size={17} />
                </button>
                <button
                  aria-label="Eliminar selección"
                  title="Eliminar selección (Supr)"
                  disabled={!selectedNodes.length && !selectedEdges.length}
                  onClick={removeSelection}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="toolbar-spacer" />
              <div className="tool-group view-tools">
                <button
                  aria-label="Cuadrícula"
                  title="Mostrar cuadrícula"
                  className={project.preferences.grid ? "active-subtle" : ""}
                  onClick={() =>
                    edit((p) => {
                      p.preferences.grid = !p.preferences.grid;
                    })
                  }
                >
                  <Grid2X2 size={16} />
                </button>
                <button
                  aria-label="Ajuste magnético"
                  title="Ajuste magnético"
                  className={project.preferences.snap ? "active-subtle" : ""}
                  onClick={() =>
                    edit((p) => {
                      p.preferences.snap = !p.preferences.snap;
                    })
                  }
                >
                  <Magnet size={16} />
                </button>
                <button
                  aria-label="Ajustar a pantalla"
                  title="Ajustar a pantalla"
                  onClick={() => void fitView({ padding: 0.25, duration: 250 })}
                >
                  <Maximize size={16} />
                </button>
              </div>
              <button
                className="arrange-button"
                disabled={busy || !project.events.length}
                onClick={arrange}
              >
                <Workflow size={15} />
                <span>{busy ? "Procesando…" : "Distribuir"}</span>
              </button>
              <details className="toolbar-menu">
                <summary
                  title="Opciones de visualización"
                  aria-label="Opciones de visualización"
                >
                  <Settings2 size={17} />
                  <ChevronDown size={12} />
                </summary>
                <div className="menu-popover">
                  {(
                    [
                      { key: "showLabels", label: "Numeración de sucesos" },
                      { key: "showDates", label: "Fechas y márgenes" },
                      { key: "highlight", label: "Resaltado crítico" },
                    ] as const
                  ).map((o) => (
                    <label className="check-label" key={o.key}>
                      <input
                        type="checkbox"
                        checked={project.preferences[o.key]}
                        onChange={(e) =>
                          edit((p) => {
                            p.preferences[o.key] = e.target.checked;
                          })
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                  <label>
                    Color crítico
                    <input
                      type="color"
                      aria-label="Color crítico"
                      value={project.preferences.criticalColor}
                      onChange={(e) =>
                        edit((p) => {
                          p.preferences.criticalColor = e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
              </details>
              <details className="toolbar-menu">
                <summary aria-label="Exportar diagrama">
                  <Download size={16} />
                  <span>Exportar</span>
                  <ChevronDown size={12} />
                </summary>
                <div className="menu-popover">
                  <button
                    onClick={() =>
                      downloadFile(
                        `${project.name}.svg`,
                        exportSVG(project, result),
                        "image/svg+xml",
                      )
                    }
                  >
                    <Download size={15} />
                    Diagrama SVG
                  </button>
                  <button
                    onClick={() =>
                      void exportPNG(project, result).catch((e) =>
                        setNotice((e as Error).message),
                      )
                    }
                  >
                    <Download size={15} />
                    Diagrama PNG
                  </button>
                </div>
              </details>
            </div>
            <div className="editor-main">
              <NetworkCanvas
                project={project}
                result={result}
                tool={tool}
                selectedNodes={selectedNodes}
                selectedEdges={selectedEdges}
                onSelection={onSelection}
                onAddEvent={newEvent}
                onConnect={connect}
                onEventClick={clickEvent}
              />
              <Inspector
                project={project}
                result={result}
                selectedNodes={selectedNodes}
                selectedEdges={selectedEdges}
                onDuplicate={duplicateSelection}
                onDelete={removeSelection}
              />
            </div>
            <div className="editor-statusbar">
              <div>
                <span
                  className="legend-line critical"
                  style={{ borderTopColor: project.preferences.criticalColor }}
                />
                Camino crítico <span className="legend-line" />
                Actividad <span className="legend-line dummy" />
                Ficticia
              </div>
              <span>
                {connectionStart
                  ? `Origen seleccionado: ${project.events.find((e) => e.id === connectionStart)?.label}. Elige el destino.`
                  : "Los cambios visuales no alteran el cálculo."}
              </span>
            </div>
          </section>
          <section className="data-card" aria-label="Datos del proyecto">
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
                project={project}
                syncToken={tableEpoch}
                onApply={(rows) => void requestRows(rows)}
                onScalar={(id, patch) =>
                  edit((p) => {
                    const activity = p.activities.find((a) => a.id === id);
                    if (activity && !activity.dummy)
                      Object.assign(activity, patch);
                  })
                }
                onDraftState={setDirty}
                busy={busy}
              />
            </div>
            <div hidden={tab !== "results"} role="tabpanel">
              <Results
                project={project}
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
            Las duraciones usan unidades de tiempo abstractas. Este MVP calcula
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
