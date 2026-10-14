import type { ComponentProps } from "react";
import {
  ArrowUpRight, ChevronDown, CirclePlus, Download, Grid2X2, Magnet,
  Maximize, MousePointer2, Redo2, Settings2, Trash2, Undo2, Workflow,
} from "lucide-react";
import type { CPMResult, Project } from "../core/types";
import { useProjectStore } from "../store";
import { downloadFile } from "../services/persistence";
import { exportPNG, exportSVG } from "../services/export";
import { NetworkCanvas, type Tool } from "./NetworkCanvas";
import { Inspector } from "./Inspector";

type CanvasProps = ComponentProps<typeof NetworkCanvas>;
interface EditorWorkspaceProps {
  project: Project;
  shownProject: Project;
  result?: CPMResult;
  tool: Tool;
  setTool: (tool: Tool) => void;
  selectedNodes: string[];
  selectedEdges: string[];
  connectionStart: string | null;
  setConnectionStart: (id: string | null) => void;
  busy: boolean;
  onSelection: CanvasProps["onSelection"];
  newEvent: CanvasProps["onAddEvent"];
  connect: CanvasProps["onConnect"];
  clickEvent: CanvasProps["onEventClick"];
  duplicateSelection: () => void;
  removeSelection: () => void;
  arrange: () => void;
  onCancelOperation: () => void;
  onFitView: () => void;
  setNotice: (message: string) => void;
}

/** Editor UI stays mounted while academic views are open to preserve its viewport. */
export function EditorWorkspace({
  project, shownProject, result, tool, setTool, selectedNodes, selectedEdges,
  connectionStart, setConnectionStart, busy, onSelection, newEvent, connect,
  clickEvent, duplicateSelection, removeSelection, arrange, onCancelOperation,
  onFitView, setNotice,
}: EditorWorkspaceProps) {
  const edit = useProjectStore(s => s.edit);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const past = useProjectStore(s => s.past);
  const future = useProjectStore(s => s.future);
  const setPresentation = useProjectStore(s => s.setPresentation);
  const view = project.presentation?.activeView ?? "network";
  return (
<section className="editor-card" aria-label="Editor de red" hidden={!['network','resolved'].includes(view)}>
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
                  onClick={onFitView}
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
              {busy&&<button onClick={onCancelOperation}>Cancelar operación</button>}
              <details className="toolbar-menu">
                <summary
                  title="Opciones de visualización"
                  aria-label="Opciones de visualización"
                >
                  <Settings2 size={17} />
                  <ChevronDown size={12} />
                </summary>
                <div className="menu-popover">
                  <label>Tamaño de sucesos<select aria-label="Tamaño de sucesos" value={project.presentation?.nodeSize??'normal'} onChange={e=>setPresentation({nodeSize:e.target.value as 'small'|'normal'|'large'})}><option value="small">Pequeño</option><option value="normal">Normal</option><option value="large">Grande</option></select></label>
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
                project={shownProject}
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
                project={shownProject}
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
  );
}
