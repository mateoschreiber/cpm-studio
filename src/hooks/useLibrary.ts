import { useCallback, useEffect, useRef, useState } from "react";
import { emptyProject, type Project } from "../core/types";
import { migrateProject } from "../services/persistence";
import {
  deleteLibraryProject, duplicateLibraryProject, getLastActiveProjectId,
  getLibraryProject, listProjects, migrateLegacyProject, saveLibraryProject,
  setLastActiveProjectId, type ProjectSummary,
} from "../services/projectLibrary";
import { useProjectStore } from "../store";

const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo actualizar la biblioteca. Descarga el JSON para conservar tu trabajo.";

export function useLibrary() {
  const project = useProjectStore(s => s.project);
  const revision = useProjectStore(s => s.documentRevision);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRevision,setSavedRevision]=useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressed = useRef(-1);
  const previous = useRef<Project | null>(null);
  const deleted = useRef(new Set<string>());
  const pending = useRef(0);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    try { setProjects(await enqueue(listProjects)); }
    catch (reason) { setError(message(reason)); }
  }, [enqueue]);

  const persist = useCallback(async (snapshot: Project) => {
    if (!snapshot.id || deleted.current.has(snapshot.id)) return true;
    pending.current += 1;
    setSaving(true);
    try {
      await enqueue(() => saveLibraryProject(snapshot));
      // A completed save of another document must not replace the active id.
      if (useProjectStore.getState().project.id === snapshot.id) setLastActiveProjectId(snapshot.id);
      if(useProjectStore.getState().project===snapshot)setSavedRevision(useProjectStore.getState().documentRevision);
      setError(null);
      setProjects(await enqueue(listProjects));
      return true;
    } catch (reason) { setError(message(reason)); return false; }
    finally {
      pending.current -= 1;
      if (!pending.current) setSaving(false);
    }
  }, [enqueue]);

  const cancelTimer = useCallback(() => { clearTimeout(timer.current); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = getLastActiveProjectId();
        const recovered = (active ? await enqueue(() => getLibraryProject(active)) : null)
          ?? await enqueue(migrateLegacyProject);
        if (cancelled) return;
        const next = recovered ?? migrateProject(emptyProject());
        if (!recovered) await enqueue(() => saveLibraryProject(next));
        if (cancelled) return;
        useProjectStore.getState().load(next);
        previous.current = useProjectStore.getState().project;
        setLastActiveProjectId(next.id!);
        setProjects(await enqueue(listProjects));
      } catch (reason) {
        if (cancelled) return;
        // Do not overwrite malformed legacy storage or create a replacement silently.
        useProjectStore.getState().load(migrateProject(emptyProject()));
        previous.current = useProjectStore.getState().project;
        suppressed.current = useProjectStore.getState().documentRevision;
        setError(`No se pudo recuperar el proyecto guardado. ${message(reason)}`);
      } finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [enqueue]);

  useEffect(() => {
    if (!ready) return;
    const old = previous.current;
    previous.current = project;
    if (old?.id && old.id !== project.id && !deleted.current.has(old.id)) void persist(old);
    if (revision <= suppressed.current) return;
    setSaving(true);
    timer.current = setTimeout(() => { void persist(project); }, 300);
    return cancelTimer;
  }, [project, ready, revision, persist, cancelTimer]);

  useEffect(() => {
    // Flush pending changes when leaving the document; transactions remain asynchronous.
    const flush = () => {
      cancelTimer();
      if (ready && useProjectStore.getState().documentRevision > suppressed.current) {
        void persist(useProjectStore.getState().project);
      }
    };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ready, persist, cancelTimer]);

  const open = useCallback(async (id: string) => {
    cancelTimer();
    if (!await persist(useProjectStore.getState().project)) return;
    try {
      const next = await enqueue(() => getLibraryProject(id));
      if (!next) throw new Error("El proyecto ya no existe en la biblioteca.");
      useProjectStore.getState().load(next);
      setLastActiveProjectId(id);
    } catch (reason) { setError(message(reason)); }
  }, [cancelTimer, enqueue, persist]);

  const remove = useCallback(async (id: string) => {
    cancelTimer();
    const current = useProjectStore.getState().project;
    try {
      if (current.id !== id && !await persist(current)) return;
      deleted.current.add(id);
      await enqueue(() => deleteLibraryProject(id));
      const remaining = await enqueue(listProjects);
      if (current.id === id) {
        const next = remaining.length ? await enqueue(() => getLibraryProject(remaining[0].id)) : migrateProject(emptyProject());
        if (next) {
          useProjectStore.getState().load(next);
          await persist(next);
          setLastActiveProjectId(next.id!);
        }
      }
      setProjects(await enqueue(listProjects));
    } catch (reason) { deleted.current.delete(id); setError(message(reason)); }
  }, [cancelTimer, enqueue, persist]);

  const duplicate = useCallback(async (id: string) => {
    cancelTimer();
    if (!await persist(useProjectStore.getState().project)) return;
    try { await enqueue(() => duplicateLibraryProject(id)); await refresh(); }
    catch (reason) { setError(message(reason)); }
  }, [cancelTimer, enqueue, persist, refresh]);

  const rename = useCallback(async (id: string, name: string) => {
    if (!name.trim()) { setError("El nombre del proyecto no puede estar vacío."); return; }
    cancelTimer();
    try {
      const current = useProjectStore.getState();
      if (current.project.id === id) {
        current.edit(p => { p.name = name.trim(); });
        await persist(useProjectStore.getState().project);
      } else {
        await enqueue(async () => {
          const next = await getLibraryProject(id);
          if (!next) throw new Error("El proyecto ya no existe.");
          await saveLibraryProject({ ...next, name: name.trim() });
        });
        await refresh();
      }
    } catch (reason) { setError(message(reason)); }
  }, [cancelTimer, enqueue, persist, refresh]);

  const flushAndSave=useCallback(async()=>{cancelTimer();const snapshot=useProjectStore.getState().project;const saved=await persist(snapshot);return saved&&useProjectStore.getState().project===snapshot;},[cancelTimer,persist]);
  return { ready, saving:saving||(ready&&revision>suppressed.current&&savedRevision!==revision), error, setError, projects, refresh, open, remove, duplicate, rename, flushAndSave };
}
