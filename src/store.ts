import { create } from 'zustand';
import { applyPatches, enablePatches, produce, produceWithPatches, type Patch } from 'immer';
import { defaultPresentation, emptyProject, type Presentation, type Project, type VisualModel } from './core/types';
import { migrateProject } from './services/persistence';
import { repairVisual } from './services/presentation';
enablePatches();
interface Command { forward: Patch[]; inverse: Patch[]; logical: boolean }
interface ProjectState {
  project: Project; past: Command[]; future: Command[]; gesture: Command | null;
  logicalRevision: number; documentRevision: number;
  edit: (change: (project: Project) => void) => void;
  editVisual: (change: (visual: VisualModel) => void) => void;
  setPresentation: (patch: Partial<Presentation>) => void;
  replace: (project: Project) => void; load: (project: Project) => void;
  beginGesture: () => void; endGesture: () => void; undo: () => void; redo: () => void;
}
const limit = (commands: Command[]) => commands.slice(-100);
const changesLogic = (patches: Patch[]) => patches.some(p => !p.path.length || p.path[0] === 'events' || p.path[0] === 'activities');
export const currentVisual = (project: Project): VisualModel => project.presentation?.activeView === 'resolved' ? project.presentation.resolved ?? project.visual : project.visual;
export const useProjectStore = create<ProjectState>((set, get) => ({
  project: emptyProject(), past: [], future: [], gesture: null, logicalRevision: 0, documentRevision: 0,
  edit: change => {
    const s = get();
    let [project, forward, inverse] = produceWithPatches(s.project, change);
    if (!forward.length) return;
    const logical = changesLogic(forward);
    if(logical&&project.presentation?.resolved){const [fixed,add,back]=produceWithPatches(project,p=>{p.presentation!.resolved=repairVisual(p,p.presentation!.resolved);});project=fixed;forward=[...forward,...add];inverse=[...back,...inverse];}
    const command = {forward, inverse, logical};
    set({project, documentRevision:s.documentRevision+1, logicalRevision:s.logicalRevision+(logical?1:0),
      past: s.gesture ? s.past : limit([...s.past,command]), future:[],
      gesture: s.gesture ? {forward:[...s.gesture.forward,...forward],inverse:[...inverse,...s.gesture.inverse],logical:s.gesture.logical||logical} : null});
  },
  editVisual: change => get().edit(p => change(currentVisual(p))),
  setPresentation: patch => {
    const s = get();
    const project = produce(s.project,p => {p.presentation ??= defaultPresentation(); Object.assign(p.presentation,patch);});
    if (project !== s.project) set({project,documentRevision:s.documentRevision+1});
  },
  replace: input => {
    const s=get(), project=migrateProject(input);
    const command:Command={forward:[{op:'replace',path:[],value:project}],inverse:[{op:'replace',path:[],value:s.project}],logical:true};
    set({project,past:limit([...s.past,command]),future:[],gesture:null,logicalRevision:s.logicalRevision+1,documentRevision:s.documentRevision+1});
  },
  load: input => {const s=get();set({project:migrateProject(input),past:[],future:[],gesture:null,logicalRevision:s.logicalRevision+1,documentRevision:s.documentRevision+1});},
  beginGesture: () => {if(!get().gesture)set({gesture:{forward:[],inverse:[],logical:false}});},
  endGesture: () => {const s=get(); if(!s.gesture)return;set({gesture:null,past:s.gesture.forward.length?limit([...s.past,s.gesture]):s.past});},
  undo: () => {const s=get(), command=s.past.at(-1);if(!command)return;set({project:applyPatches(s.project,command.inverse),past:s.past.slice(0,-1),future:[command,...s.future],gesture:null,logicalRevision:s.logicalRevision+(command.logical?1:0),documentRevision:s.documentRevision+1});},
  redo: () => {const s=get(),command=s.future[0];if(!command)return;set({project:applyPatches(s.project,command.forward),past:limit([...s.past,command]),future:s.future.slice(1),gesture:null,logicalRevision:s.logicalRevision+(command.logical?1:0),documentRevision:s.documentRevision+1});},
}));
export const uid = () => crypto.randomUUID();
export const numberText = (n: number) => Number(n.toFixed(6)).toLocaleString('es-PY',{maximumFractionDigits:6});
