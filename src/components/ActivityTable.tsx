import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, GitBranch, Plus, Trash2 } from "lucide-react";
import { extractPrecedences, validateTable } from "../core/engine";
import type { Project, TableRow } from "../core/types";
import { uid } from "../store";
import { CommitInput } from "./Fields";

export function ActivityTable({
  project,
  syncToken,
  onApply,
  onDraftState,
  onScalar,
  busy,
}: {
  project: Project;
  syncToken: number;
  onApply: (rows: TableRow[]) => void;
  onDraftState: (dirty: boolean) => void;
  onScalar: (
    id: string,
    patch: Partial<Pick<TableRow, "duration" | "resources">>,
  ) => void;
  busy: boolean;
}) {
  const signature = JSON.stringify(project.activities);
  const canonical = useMemo(() => extractPrecedences(project), [signature]);
  const [rows, setRows] = useState<TableRow[]>(canonical);
  const baseline = useRef({ canonical, syncToken });
  useEffect(() => {
    const old = baseline.current;
    baseline.current = { canonical, syncToken };
    setRows((draft) => {
      if (
        old.syncToken !== syncToken ||
        JSON.stringify(draft) === JSON.stringify(old.canonical)
      )
        return canonical;
      // Reconcile canonical edits without discarding pending user fields or added/deleted draft rows.
      const merged = draft.map((row) => {
        const before = old.canonical.find((r) => r.id === row.id),
          after = canonical.find((r) => r.id === row.id);
        if (!before || !after) return row;
        const next = { ...row };
        for (const field of [
          "name",
          "duration",
          "resources",
          "predecessors",
        ] as const) {
          if (JSON.stringify(row[field]) === JSON.stringify(before[field]))
            Object.assign(next, { [field]: after[field] });
        }
        return next;
      });
      return [
        ...merged,
        ...canonical.filter(
          (row) =>
            !old.canonical.some((r) => r.id === row.id) &&
            !merged.some((r) => r.id === row.id),
        ),
      ];
    });
  }, [canonical, syncToken]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(canonical);
  useEffect(() => {
    onDraftState(dirty);
  }, [dirty, onDraftState]);
  const errors = rows.length ? validateTable(rows) : [];
  function change(next: TableRow[]) {
    setRows(next);
    if (!next.length || !validateTable(next).length) onApply(next);
  }
  function update(id: string, patch: Partial<TableRow>) {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    if (
      canonical.some((r) => r.id === id) &&
      ("duration" in patch || "resources" in patch)
    ) {
      setRows(next);
      onScalar(id, patch);
    } else change(next);
  }
  function nextName() {
    let i = 1;
    while (rows.some((r) => r.name === `A${i}`)) i++;
    return `A${i}`;
  }
  return (
    <div className="table-panel">
      <div className="panel-toolbar">
        <div>
          <h3>Tabla de actividades</h3>
          <p>Precedencias de actividades reales · recursos por actividad</p>
        </div>
        <div className="inline-actions">
          {dirty && (
            <button
              disabled={!!errors.length || busy}
              onClick={() => onApply(rows)}
            >
              <GitBranch size={15} />
              Aplicar cambios
            </button>
          )}
          <button
            className="soft-button"
            disabled={busy}
            onClick={() =>
              change([
                ...rows,
                {
                  id: uid(),
                  name: nextName(),
                  predecessors: [],
                  duration: 0,
                  resources: 0,
                },
              ])
            }
          >
            <Plus size={15} />
            Agregar actividad
          </button>
        </div>
      </div>
      {dirty && (
        <div className="draft-banner" role="status">
          Borrador pendiente. Los resultados corresponden exclusivamente a la
          red vigente.
          {!errors.length &&
            " Aplica los cambios o confirma la actualización estructural."}
          <button onClick={() => setRows(canonical)}>Descartar borrador</button>
        </div>
      )}
      {!!errors.length && (
        <div className="inline-error" role="alert">
          {errors.join(" ").replaceAll("inexistente:", "")}
        </div>
      )}
      <div className="table-scroll">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Predecesoras</th>
              <th>Duración</th>
              <th>Recursos</th>
              <th className="table-action-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <CommitInput
                    label={`Actividad ${row.name}`}
                    value={row.name}
                    onCommit={(name) => update(row.id, { name: name.trim() })}
                  />
                </td>
                <td>
                  <div className="predecessor-cell">
                    <CommitInput
                      label={`Predecesoras de ${row.name}`}
                      value={row.predecessors
                        .map(
                          (id) =>
                            rows.find((r) => r.id === id)?.name ??
                            id.replace(/^inexistente:/, ""),
                        )
                        .join(", ")}
                      placeholder="—"
                      onCommit={(value) =>
                        update(row.id, {
                          predecessors:
                            value.trim() &&
                            value.trim() !== "-" &&
                            value.trim() !== "—"
                              ? [
                                  ...new Set(
                                    value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .map(
                                        (name) =>
                                          rows.find((r) => r.name === name)
                                            ?.id ?? `inexistente:${name}`,
                                      ),
                                  ),
                                ]
                              : [],
                        })
                      }
                    />
                    <details className="predecessor-picker">
                      <summary
                        aria-label={`Seleccionar predecesoras de ${row.name}`}
                      >
                        <GitBranch size={13} />
                      </summary>
                      <div className="picker-options">
                        {rows
                          .filter((r) => r.id !== row.id)
                          .map((other) => (
                            <label key={other.id}>
                              <input
                                type="checkbox"
                                checked={row.predecessors.includes(other.id)}
                                onChange={(e) =>
                                  update(row.id, {
                                    predecessors: e.target.checked
                                      ? [...row.predecessors, other.id]
                                      : row.predecessors.filter(
                                          (id) => id !== other.id,
                                        ),
                                  })
                                }
                              />
                              {other.name}
                            </label>
                          ))}
                        {rows.length < 2 && <span>Agrega otra actividad.</span>}
                      </div>
                    </details>
                  </div>
                </td>
                <td>
                  <CommitInput
                    label={`Duración de ${row.name}`}
                    value={row.duration}
                    numeric
                    onCommit={(value) =>
                      update(row.id, { duration: Number(value) })
                    }
                  />
                </td>
                <td>
                  <CommitInput
                    label={`Recursos de ${row.name}`}
                    value={row.resources}
                    numeric
                    integer
                    onCommit={(value) =>
                      update(row.id, { resources: Number(value) })
                    }
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      title="Duplicar actividad"
                      aria-label={`Duplicar ${row.name}`}
                      onClick={() =>
                        change([
                          ...rows,
                          {
                            ...row,
                            id: uid(),
                            name: nextName(),
                            predecessors: [...row.predecessors],
                          },
                        ])
                      }
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      title="Eliminar actividad"
                      aria-label={`Eliminar ${row.name}`}
                      onClick={() =>
                        change(
                          rows
                            .filter((r) => r.id !== row.id)
                            .map((r) => ({
                              ...r,
                              predecessors: r.predecessors.filter(
                                (id) => id !== row.id,
                              ),
                            })),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="empty-table">
                  Añade una actividad para generar tu primera red
                  automáticamente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          {rows.length} actividades reales ·{" "}
          {project.activities.filter((a) => a.dummy).length} ficticias en la red
        </span>
        <span>
          <Check size={13} /> Los cambios válidos se aplican al confirmar la
          celda
        </span>
      </div>
    </div>
  );
}
