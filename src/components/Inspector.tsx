import {
  Copy,
  Trash2,
  SlidersHorizontal,
  MousePointer2,
  Plus,
} from "lucide-react";
import {
  defaultEdgeVisual,
  type CPMResult,
  type EdgeVisual,
  type Project,
} from "../core/types";
import { numberText, useProjectStore } from "../store";
import { CommitInput } from "./Fields";

export function Inspector({
  project,
  selectedNodes,
  selectedEdges,
  result,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  selectedNodes: string[];
  selectedEdges: string[];
  result?: CPMResult;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const edit = useProjectStore((s) => s.edit);
  const editVisual = useProjectStore((s) => s.editVisual);
  const event =
    selectedNodes.length === 1 && !selectedEdges.length
      ? project.events.find((e) => e.id === selectedNodes[0])
      : undefined;
  const activity =
    selectedEdges.length === 1 && !selectedNodes.length
      ? project.activities.find((a) => a.id === selectedEdges[0])
      : undefined;
  const total = selectedNodes.length + selectedEdges.length;
  const v = activity
    ? (project.visual.edges[activity.id] ?? defaultEdgeVisual())
    : undefined;
  const updateVisual = (change: Partial<EdgeVisual>) =>
    editVisual((visual) => {
      visual.edges[activity!.id] = { ...v!, ...change };
    });
  const metric = activity ? result?.activities[activity.id] : undefined;
  return (
    <aside className="inspector" aria-label="Inspector de selección">
      <div className="section-heading">
        <SlidersHorizontal size={16} />
        <h2>Propiedades</h2>
        <span>{event ? "SUCESO" : activity ? "ACTIVIDAD" : "SELECCIÓN"}</span>
      </div>
      {!total && (
        <div className="inspector-empty">
          <MousePointer2 size={27} strokeWidth={1.4} />
          <h3>Cada detalle, en su lugar</h3>
          <p>
            Selecciona un suceso o una actividad para editar sus propiedades.
          </p>
          <div className="inspector-tip">
            <strong>Un lienzo, dos formas de crear</strong>
            <p>
              Dibuja tu red libremente o introduce las precedencias en la tabla.
            </p>
          </div>
        </div>
      )}
      {total > 1 && (
        <div className="inspector-body">
          <h3>{total} elementos seleccionados</h3>
          <p className="muted">Arrástralos para moverlos juntos.</p>
        </div>
      )}
      {event && (
        <div className="inspector-body">
          <h3>Suceso {event.label}</h3>
          <label>
            Número / identificador
            <CommitInput
              value={event.label}
              label="Identificador del suceso"
              onCommit={(label) =>
                edit((p) => {
                  p.events.find((e) => e.id === event.id)!.label = label.trim();
                })
              }
            />
          </label>
          <div className="field-pair">
            {(["x", "y"] as const).map((axis) => (
              <label key={axis}>
                Posición {axis.toUpperCase()}
                <CommitInput
                  label={`Posición ${axis}`}
                  value={project.visual.nodes[event.id]?.[axis] ?? 0}
                  onCommit={(value) => {
                    if (value.trim() && Number.isFinite(Number(value)))
                      editVisual((visual) => {
                        visual.nodes[event.id][axis] = Number(value);
                      });
                  }}
                />
              </label>
            ))}
          </div>
          {result && (
            <div className="metric-pair">
              <div>
                <span>Fecha temprana</span>
                <strong>{numberText(result.events[event.id].early)}</strong>
              </div>
              <div>
                <span>Fecha tardía</span>
                <strong>{numberText(result.events[event.id].late)}</strong>
              </div>
            </div>
          )}
          <p className="field-help">
            El identificador visible no cambia las conexiones internas.
          </p>
        </div>
      )}
      {activity && v && (
        <div className="inspector-body">
          <h3>
            {activity.dummy
              ? "Actividad ficticia"
              : `Actividad ${activity.name}`}
            {metric?.critical && <span className="critical-tag">Crítica</span>}
          </h3>
          <label>
            Nombre
            <CommitInput
              label="Nombre de actividad"
              value={activity.name}
              onCommit={(name) =>
                edit((p) => {
                  p.activities.find((a) => a.id === activity.id)!.name =
                    name.trim();
                })
              }
            />
          </label>
          <div className="field-pair">
            <label>
              Duración
              <CommitInput
                label="Duración de actividad"
                value={activity.duration}
                numeric
                disabled={activity.dummy}
                onCommit={(value) =>
                  edit((p) => {
                    p.activities.find((a) => a.id === activity.id)!.duration =
                      Number(value);
                  })
                }
              />
            </label>
            <label>
              Recursos
              <CommitInput
                label="Recursos de actividad"
                value={activity.resources}
                numeric
                integer
                disabled={activity.dummy}
                onCommit={(value) =>
                  edit((p) => {
                    p.activities.find((a) => a.id === activity.id)!.resources =
                      Number(value);
                  })
                }
              />
            </label>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={activity.dummy}
              onChange={(e) =>
                edit((p) => {
                  const a = p.activities.find((a) => a.id === activity.id)!;
                  a.dummy = e.target.checked;
                  if (a.dummy) {
                    a.duration = 0;
                    a.resources = 0;
                  }
                })
              }
            />
            Actividad ficticia (duración cero)
          </label>
          <div className="field-pair">
            {(["source", "target"] as const).map((end) => (
              <label key={end}>
                {end === "source" ? "Origen" : "Destino"}
                <select
                  aria-label={
                    end === "source" ? "Suceso origen" : "Suceso destino"
                  }
                  value={activity[end]}
                  onChange={(e) =>
                    edit((p) => {
                      p.activities.find((a) => a.id === activity.id)![end] =
                        e.target.value;
                    })
                  }
                >
                  {project.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="inspector-divider" />
          <h4>Apariencia</h4>
          <label>
            Recorrido
            <select
              aria-label="Recorrido de flecha"
              value={v.kind}
              onChange={(e) =>
                updateVisual({ kind: e.target.value as EdgeVisual["kind"] })
              }
            >
              <option value="straight">Recto</option>
              <option value="curve">Curvo</option>
              <option value="segments">Segmentado</option>
            </select>
          </label>
          {v.kind !== "straight" && (
            <label>
              Desvío <span className="range-value">{numberText(v.bend)}</span>
              <input
                aria-label="Desvío de flecha"
                type="range"
                min="-250"
                max="250"
                value={v.bend}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  useProjectStore.getState().beginGesture();
                }}
                onPointerUp={() => useProjectStore.getState().endGesture()}
                onPointerCancel={() => useProjectStore.getState().endGesture()}
                onLostPointerCapture={() =>
                  useProjectStore.getState().endGesture()
                }
                onChange={(e) =>
                  updateVisual({
                    bend: Number(e.target.value),
                    points: undefined,
                  })
                }
              />
            </label>
          )}
          {v.kind === "segments" && (
            <>
            <div className="inline-actions">
              <button
                onClick={() => {
                  const s = project.visual.nodes[activity.source],
                    t = project.visual.nodes[activity.target];
                  updateVisual({
                    points: [
                      ...(v.points ?? []),
                      {
                        x: (s.x + t.x) / 2 + 30,
                        y: (s.y + t.y) / 2 + 70 + (v.points?.length ?? 0) * 35,
                      },
                    ],
                  });
                }}
              >
                <Plus size={14} />
                Segmento
              </button>
              <button
                onClick={() => updateVisual({ points: undefined, bend: 0 })}
              >
                Restablecer
              </button>
            </div>
            {(v.points ?? []).map((point, index) => <fieldset key={index} style={{ border: "1px solid var(--border)", borderRadius: 8, margin: "10px 0", padding: 8 }}>
              <legend>Punto {index + 1}</legend>
              <div className="field-pair">
                {(["x", "y"] as const).map(axis => <label key={axis}>{axis.toUpperCase()}
                  <CommitInput label={`Punto ${index + 1} ${axis.toUpperCase()}`} value={point[axis]} onCommit={text => {
                    if (!text.trim() || !Number.isFinite(Number(text))) return;
                    editVisual(visual => {
                      const edge = visual.edges[activity.id];
                      if (edge.points?.[index]) edge.points[index][axis] = Number(text);
                    });
                  }} />
                </label>)}
              </div>
              <button aria-label={`Eliminar punto ${index + 1}`} onClick={() => editVisual(visual => {
                const edge = visual.edges[activity.id];
                edge.points = edge.points?.filter((_, i) => i !== index);
                if (!edge.points?.length) { edge.kind = "straight"; edge.bend = 0; }
              })}><Trash2 size={14} />Eliminar punto</button>
            </fieldset>)}
            </>
          )}
          <div className="field-pair">
            <label>
              Color
              <input
                type="color"
                aria-label="Color de flecha"
                value={v.color}
                onChange={(e) => updateVisual({ color: e.target.value })}
              />
            </label>
            <label>
              Grosor
              <CommitInput
                label="Grosor de flecha"
                numeric
                value={v.width}
                onCommit={(value) =>
                  updateVisual({
                    width: Math.max(0.5, Math.min(12, Number(value))),
                  })
                }
              />
            </label>
          </div>
          <div className="field-pair">
            {(["labelX", "labelY"] as const).map((axis) => (
              <label key={axis}>
                Etiqueta {axis === "labelX" ? "X" : "Y"}
                <CommitInput
                  label={`Desplazamiento ${axis}`}
                  value={v[axis]}
                  onCommit={(value) => {
                    if (value.trim() && Number.isFinite(Number(value)))
                      updateVisual({ [axis]: Number(value) });
                  }}
                />
              </label>
            ))}
          </div>
          {project.presentation?.activeView === "resolved" && (["startLabel", "endLabel"] as const).map(key => <fieldset key={key} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, margin: "10px 0" }}>
            <legend>Triángulo {key === "startLabel" ? "ufc" : "pff"}</legend>
            <div className="field-pair">
              {(["x", "y"] as const).map(axis => <label key={axis}>Desplazamiento {axis.toUpperCase()}
                <CommitInput label={`Triángulo ${key === "startLabel" ? "ufc" : "pff"} ${axis.toUpperCase()}`} value={v[key]?.[axis] ?? 0} onCommit={text => {
                  if (!text.trim() || !Number.isFinite(Number(text))) return;
                  updateVisual({ [key]: { x: v[key]?.x ?? 0, y: v[key]?.y ?? 0, [axis]: Number(text) } });
                }} />
              </label>)}
            </div>
          </fieldset>)}
          <p className="field-help">
            Arrastra la etiqueta, los controles azules o el centro de un tramo.
            Doble clic sobre una flecha inserta un punto; sobre un punto lo elimina.
            La apariencia no cambia las precedencias.
          </p>
          {metric && (
            <div className="mini-margins">
              {(["mt", "ml", "mi"] as const).map((m) => (
                <div key={m}>
                  <span>{m.toUpperCase()}</span>
                  <strong>{numberText(metric[m])}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!!total && (
        <div className="inspector-actions">
          <button onClick={onDuplicate}>
            <Copy size={15} />
            Duplicar
          </button>
          <button className="danger-text" onClick={onDelete}>
            <Trash2 size={15} />
            Eliminar
          </button>
        </div>
      )}
      <div className="inspector-foot">
        <span className="tiny-circle" /> La lógica y el dibujo se guardan por
        separado.
      </div>
    </aside>
  );
}
