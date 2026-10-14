import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { emptyProject } from "../core/types";
import { migrateProject, parseProject, serializeProject, STORAGE_KEY } from "./persistence";
import {
  ACTIVE_PROJECT_KEY, LEGACY_MIGRATED_KEY, LIBRARY_DB, deleteLibraryProject,
  duplicateLibraryProject, getLastActiveProjectId, getLibraryProject, listProjects,
  migrateLegacyProject, saveLibraryProject, setLastActiveProjectId,
} from "./projectLibrary";

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("migración versionada", () => {
  it("migra sin mutar y conserva una presentación independiente", () => {
    const source = { ...emptyProject(), version: 1 as const };
    const before = structuredClone(source);
    const next = migrateProject(source);
    expect(source).toEqual(before);
    expect(next.version).toBe(2);
    expect(next.id).toBeTruthy();
    expect(next.presentation?.activeView).toBe("network");
    expect(parseProject(serializeProject(next))).toEqual(next);
    expect(migrateProject(next)).toEqual(next);
  });
  it("rechaza offsets no finitos y formas incompletas de presentación", () => {
    const project = migrateProject(emptyProject());
    expect(() => parseProject(JSON.stringify({ ...project, presentation: {} }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, presentation: { ...project.presentation, rowOffsets: { A: Infinity } } }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, id: undefined }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, presentation: { ...project.presentation, resolved: { nodes: {}, edges: { A: {} } } } }))).toThrow();
  });
  it("conserva los borradores de tabla y valida sus números", () => {
    const project = migrateProject(emptyProject());
    project.presentation!.draftRows = [{ id: "A", name: "", duration: 0, resources: 0, predecessors: ["missing"] }];
    expect(parseProject(serializeProject(project))).toEqual(project);
    project.presentation!.draftRows[0].resources = -1;
    expect(() => parseProject(serializeProject(project))).toThrow();
  });
});

describe("biblioteca IndexedDB", () => {
  it("guarda, lista, abre, duplica y elimina sin perder el original", async () => {
    const project = migrateProject(emptyProject());
    await saveLibraryProject(project);
    expect(await getLibraryProject(project.id!)).toEqual(project);
    expect(await listProjects()).toEqual([{ id: project.id, name: project.name, updatedAt: expect.any(Number) }]);
    const copy = await duplicateLibraryProject(project.id!);
    expect(copy.id).not.toBe(project.id);
    expect(copy.name).toContain("(copia)");
    copy.visual.nodes.X = { x: 1, y: 2 };
    expect((await getLibraryProject(project.id!))?.visual.nodes).toEqual({});
    setLastActiveProjectId(project.id!);
    expect(getLastActiveProjectId()).toBe(project.id);
    await deleteLibraryProject(project.id!);
    expect(await getLibraryProject(project.id!)).toBeNull();
    expect(getLastActiveProjectId()).toBeNull();
    expect(await listProjects()).toHaveLength(1);
  });
  it("conserva el respaldo y no duplica la migración al recargar", async () => {
    const text = serializeProject({ ...emptyProject(), version: 1 as const });
    storage.set(STORAGE_KEY, text);
    const first = await migrateLegacyProject();
    expect(first?.version).toBe(2);
    expect(storage.get(STORAGE_KEY)).toBe(text);
    expect(storage.get(LEGACY_MIGRATED_KEY)).toBe(first?.id);
    expect(storage.get(ACTIVE_PROJECT_KEY)).toBe(first?.id);
    expect(await migrateLegacyProject()).toEqual(first);
    expect(await listProjects()).toHaveLength(1);
  });
  it("no marca una migración fallida ni altera el original", async () => {
    const text = serializeProject({ ...emptyProject(), version: 1 as const });
    storage.set(STORAGE_KEY, text);
    vi.stubGlobal("indexedDB", undefined);
    await expect(migrateLegacyProject()).rejects.toThrow(/IndexedDB/);
    expect(storage.has(LEGACY_MIGRATED_KEY)).toBe(false);
    expect(storage.get(STORAGE_KEY)).toBe(text);
  });
  it("espera la confirmación de la transacción y propaga abortos de escritura", async () => {
    const factory = indexedDB;
    const request = factory.open(LIBRARY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const prototype = Object.getPrototypeOf(db.transaction("projects", "readwrite").objectStore("projects"));
    const put = vi.spyOn(prototype, "put").mockImplementation(function(this: IDBObjectStore) {
      this.transaction.abort();
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    await expect(saveLibraryProject(migrateProject(emptyProject()))).rejects.toThrow();
    put.mockRestore();
    db.close();
    expect(await listProjects()).toEqual([]);
  });
  it("rechaza identificadores faltantes, datos inválidos y duplicados inexistentes", async () => {
    await expect(saveLibraryProject({ ...emptyProject(), id: undefined })).rejects.toThrow();
    await expect(duplicateLibraryProject("unknown")).rejects.toThrow(/existe/);
    const p = migrateProject(emptyProject());
    p.visual.nodes.bad = { x: 0, y: 0 };
    await expect(saveLibraryProject(p)).rejects.toThrow();
    expect(await listProjects()).toEqual([]);
  });
});
