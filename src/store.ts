import { create } from "zustand";
import { emptyProject, type Project } from "./core/types";

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  gesture: Project | null;
  edit: (change: (project: Project) => void) => void;
  replace: (project: Project) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: emptyProject(),
  past: [],
  future: [],
  gesture: null,
  edit: (change) => {
    const s = get();
    const next = structuredClone(s.project);
    change(next);
    if (JSON.stringify(next) === JSON.stringify(s.project)) return;
    set({
      project: next,
      past: s.gesture ? s.past : [...s.past, s.project],
      future: [],
    });
  },
  replace: (project) => {
    const s = get();
    set({
      project: structuredClone(project),
      past: [...s.past, s.project],
      future: [],
      gesture: null,
    });
  },
  beginGesture: () => {
    if (!get().gesture) set({ gesture: get().project });
  },
  endGesture: () => {
    const s = get();
    if (!s.gesture) return;
    set({
      gesture: null,
      past:
        JSON.stringify(s.gesture) === JSON.stringify(s.project)
          ? s.past
          : [...s.past, s.gesture],
    });
  },
  undo: () => {
    const s = get();
    if (!s.past.length) return;
    set({
      project: s.past.at(-1)!,
      past: s.past.slice(0, -1),
      future: [s.project, ...s.future],
      gesture: null,
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    set({
      project: s.future[0],
      past: [...s.past, s.project],
      future: s.future.slice(1),
      gesture: null,
    });
  },
}));

export const uid = () => crypto.randomUUID();
export const numberText = (n: number) =>
  Number(n.toFixed(6)).toLocaleString("es-PY", { maximumFractionDigits: 6 });
