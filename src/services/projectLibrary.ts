import type { Project } from "../core/types";
import { migrateProject, parseProject, serializeProject, STORAGE_KEY } from "./persistence";

export const LIBRARY_DB = "cpm-studio";
export const ACTIVE_PROJECT_KEY = "cpm-studio.active-project.v2";
export const LEGACY_MIGRATED_KEY = "cpm-studio.migrated-project.v2";
export interface ProjectSummary { id: string; name: string; updatedAt: number }
interface SavedProject extends ProjectSummary { project: Project }

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("El navegador no permite almacenamiento IndexedDB. Descarga el JSON para conservar el proyecto."));
      return;
    }
    const request = indexedDB.open(LIBRARY_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("projects")) {
        request.result.createObjectStore("projects", { keyPath: "id" });
      }
    };
    request.onerror = () => reject(new Error("No se pudo abrir la biblioteca de proyectos."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de CPM Studio para abrir la biblioteca."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", mode);
    let result: T;
    try {
      const request = operation(tx.objectStore("projects"));
      request.onsuccess = () => { result = request.result; };
    } catch (error) {
      tx.abort(); db.close(); reject(error); return;
    }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("No se pudo guardar o leer la biblioteca. Descarga el JSON; el proyecto abierto sigue disponible."));
    };
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await transaction<SavedProject[]>("readonly", store => store.getAll());
  return rows.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export async function saveLibraryProject(project: Project): Promise<void> {
  if (!project.id) throw new Error("Migra el proyecto antes de guardarlo en la biblioteca.");
  const id = project.id;
  const validated = parseProject(serializeProject(project));
  await transaction("readwrite", store => store.put({
    id, name: project.name, updatedAt: Date.now(), project: validated,
  } satisfies SavedProject));
}

export async function getLibraryProject(id: string): Promise<Project | null> {
  const saved = await transaction<SavedProject | undefined>("readonly", store => store.get(id));
  return saved ? migrateProject(parseProject(serializeProject(saved.project))) : null;
}

export async function deleteLibraryProject(id: string): Promise<void> {
  await transaction("readwrite", store => store.delete(id));
  if (getLastActiveProjectId() === id) {
    try { localStorage.removeItem(ACTIVE_PROJECT_KEY); } catch { /* The data deletion has already committed. */ }
  }
}

export async function duplicateLibraryProject(id: string): Promise<Project> {
  const project = await getLibraryProject(id);
  if (!project) throw new Error("El proyecto que quieres duplicar ya no existe.");
  const duplicate = { ...project, id: crypto.randomUUID(), name: `${project.name} (copia)` };
  await saveLibraryProject(duplicate);
  return duplicate;
}

export function getLastActiveProjectId(): string | null {
  try { return localStorage.getItem(ACTIVE_PROJECT_KEY); } catch { return null; }
}
export function setLastActiveProjectId(id: string): void {
  try { localStorage.setItem(ACTIVE_PROJECT_KEY, id); } catch { /* IndexedDB remains authoritative. */ }
}

/** Keep the legacy source as a backup; mark migration only after transaction completion. */
export async function migrateLegacyProject(): Promise<Project | null> {
  const marker = localStorage.getItem(LEGACY_MIGRATED_KEY);
  if (marker) return getLibraryProject(marker);
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) return null;
  const project = migrateProject(parseProject(legacy));
  // A deterministic migration id avoids duplicates if marker storage fails after IDB commits.
  project.id = project.id && JSON.parse(legacy).id ? project.id : "legacy-local-project";
  const existing = await getLibraryProject(project.id!);
  if (!existing) await saveLibraryProject(project);
  localStorage.setItem(LEGACY_MIGRATED_KEY, project.id!);
  setLastActiveProjectId(project.id!);
  return existing ?? project;
}
