import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  TriangleAlert,
} from "lucide-react";
import { criticalPaths } from "../core/engine";
import type { CPMResult, Project } from "../core/types";
import {emptyProject} from '../core/types';
import { numberText } from "../store";

export const Results = memo(function Results({
  project,
  result,
  errors,
  dirty,
}: {
  project: Project;
  result?: CPMResult;
  errors: string[];
  dirty: boolean;
}) {
  const [mode, setMode] = useState<"aoa" | "logical">("aoa");
  const [query, setQuery] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [sort, setSort] = useState<"name" | "duration" | "mt">("name");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const logical=useMemo(()=>({...emptyProject(),events:project.events,activities:project.activities}),[project.events,project.activities]);
  const routes = useMemo(
    () => ({
      iterator: result ? criticalPaths(logical, result) : undefined,
      cache: [] as string[][],
      done: false,
    }),
    [result,logical],
  );
  useEffect(() => {
    setPage(0);
  }, [result]);
  while (!routes.done && routes.cache.length < (page + 1) * 10 + 1) {
    const next = routes.iterator?.next();
    if (!next || next.done) routes.done = true;
    else routes.cache.push(next.value);
  }
  if (!result)
    return (
      <div className="results-empty">
        <TriangleAlert size={28} />
        <h3>Completa una red válida para calcular</h3>
        <p>
          {errors[0] ?? "Crea sucesos y actividades o introduce una tabla."}
        </p>
        <span>
          No se presentan resultados definitivos para una red incompleta.
        </span>
      </div>
    );
  const metrics = mode === "aoa" ? result.activities : result.logical;
  const activities = project.activities
    .filter(
      (a) =>
        (mode === "aoa" || !a.dummy) &&
        a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
        (!criticalOnly || metrics[a.id]?.critical),
    )
    .sort((a, b) => {
      const order =
        sort === "name"
          ? a.name.localeCompare(b.name, "es", { numeric: true })
          : sort === "duration"
            ? a.duration - b.duration
            : (metrics[a.id]?.mt ?? 0) - (metrics[b.id]?.mt ?? 0);
      return descending ? -order : order;
    });
  const different = project.activities.some(
    (a) =>
      !a.dummy &&
      ["ml", "mi"].some(
        (k) =>
          Math.abs(
            result.activities[a.id][k as "ml" | "mi"] -
              result.logical[a.id][k as "ml" | "mi"],
          ) > 1e-9,
      ),
  );
  function sortBy(key: typeof sort) {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(false);
    }
  }
  return (
    <div className="results-panel">
      {dirty && (
        <div className="draft-banner">
          Resultados de la red vigente. Hay un borrador de tabla sin aplicar.
        </div>
      )}
      <div className="panel-toolbar">
        <div className="segmented-control">
          <button
            className={mode === "aoa" ? "active" : ""}
            onClick={() => setMode("aoa")}
          >
            Por sucesos AOA
          </button>
          <button
            className={mode === "logical" ? "active" : ""}
            onClick={() => setMode("logical")}
          >
            Por precedencias
          </button>
        </div>
        <div className="result-filters">
          <label className="search-field">
            <Search size={14} />
            <input
              aria-label="Filtrar actividades"
              placeholder="Buscar actividad…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => setCriticalOnly(e.target.checked)}
            />
            Solo críticas
          </label>
        </div>
      </div>
      {different && (
        <div className="margin-note">
          ML y MI pueden depender de la posición de las ficticias. Las
          diferencias aparecen debajo de cada margen con su referencia AOA o de
          precedencias.
        </div>
      )}
      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("name")}>Actividad ↕</button>
              </th>
              <th>Sucesos</th>
              <th>
                <button onClick={() => sortBy("duration")}>Duración ↕</button>
              </th>
              {(mode === "aoa"
                ? ["Ft(i)", "FT(i)", "Ft(j)", "FT(j)"]
                : ["pfc (ES)", "ufc (LS)", "pff (EF)", "uff (LF)"]
              ).map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>
                <button onClick={() => sortBy("mt")}>MT ↕</button>
              </th>
              <th>ML</th>
              <th>MI</th>
              <th>Crítica</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => {
              const m = metrics[a.id],
                alt = (mode === "aoa" ? result.logical : result.activities)[
                  a.id
                ];
              const dates =
                mode === "aoa"
                  ? [
                      result.events[a.source].early,
                      result.events[a.source].late,
                      result.events[a.target].early,
                      result.events[a.target].late,
                    ]
                  : [m.es, m.ls, m.ef, m.lf];
              return (
                <tr key={a.id} className={m.critical ? "critical-row" : ""}>
                  <td>
                    <strong>{a.name}</strong>
                    {a.dummy && <span className="dummy-tag">Ficticia</span>}
                  </td>
                  <td className="muted">
                    {project.events.find((e) => e.id === a.source)?.label} →{" "}
                    {project.events.find((e) => e.id === a.target)?.label}
                  </td>
                  <td>{numberText(a.duration)}</td>
                  {dates.map((d, i) => (
                    <td key={i}>{numberText(d)}</td>
                  ))}
                  {(["mt", "ml", "mi"] as const).map((k) => (
                    <td key={k}>
                      {numberText(m[k])}
                      {alt && Math.abs(alt[k] - m[k]) > 1e-9 && (
                        <small className="alternate-margin">
                          {mode === "aoa" ? "Prec." : "AOA"}{" "}
                          {numberText(alt[k])}
                        </small>
                      )}
                    </td>
                  ))}
                  <td>
                    {m.critical ? (
                      <span className="critical-tag">Sí</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {!activities.length && (
              <tr>
                <td colSpan={11} className="empty-table">
                  No hay actividades que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="routes-section">
        <div className="routes-heading">
          <h3>
            <ArrowRight size={15} />
            Rutas críticas
          </h3>
          <span>
            Duración del proyecto:{" "}
            <strong>{numberText(result.duration)}</strong>
          </span>
          <div className="pagination">
            <button
              aria-label="Rutas anteriores"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>Página {page + 1}</span>
            <button
              aria-label="Más rutas críticas"
              disabled={routes.cache.length <= (page + 1) * 10}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="route-list">
          {routes.cache.slice(page * 10, (page + 1) * 10).map((route, i) => (
            <div className="route" key={i}>
              <span className="route-number">{page * 10 + i + 1}</span>
              {route.length ? (
                route.map((name, j) => (
                  <span className="route-part" key={j}>
                    {j > 0 && <ArrowRight size={13} />}
                    <strong>{name}</strong>
                  </span>
                ))
              ) : (
                <span>Ruta de duración cero</span>
              )}
            </div>
          ))}
        </div>
        <p className="field-help">
          Se enumeran progresivamente todas las rutas; las ficticias se omiten
          de sus nombres. MT: margen total · ML: libre · MI: independiente.
        </p>
      </div>
    </div>
  );
});
