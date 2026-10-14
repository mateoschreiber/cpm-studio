import { defaultEdgeVisual, nodeRadius, type Activity, type CPMResult, type Project, type VisualModel } from '../core/types';
export const isResolved = (project:Project) => project.presentation?.activeView==='resolved';
export function repairVisual(project:Project,visual?:VisualModel):VisualModel {
  return {nodes:Object.fromEntries(project.events.map(e=>[e.id,visual?.nodes[e.id]??project.visual.nodes[e.id]??{x:0,y:0}])),edges:Object.fromEntries(project.activities.map(a=>[a.id,visual?.edges[a.id]??project.visual.edges[a.id]??defaultEdgeVisual()]))};
}
export function displayProject(project:Project):Project {
  return isResolved(project)?{...project,visual:repairVisual(project,project.presentation?.resolved)}:project;
}
export function eventCenter(project:Project,id:string) {
  const pos=project.visual.nodes[id]??{x:0,y:0},r=nodeRadius(project);
  return {x:pos.x+r*(isResolved(project)?1.2:1),y:pos.y+r};
}
export function academicSymbols(project:Project,activity:Activity,result:CPMResult) {
  const s=eventCenter(project,activity.source),t=eventCenter(project,activity.target),v=project.visual.edges[activity.id]??defaultEdgeVisual();
  const dx=t.x-s.x,dy=t.y-s.y,len=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx)*180/Math.PI;
  return ([['ufc',result.activities[activity.id].ls,.23,v.startLabel],['pff',result.activities[activity.id].ef,.77,v.endLabel]] as const).map(([kind,value,fraction,offset])=>({kind,value,angle,x:s.x+dx*fraction-dy/len*v.bend*.25+(offset?.x??0),y:s.y+dy*fraction+dx/len*v.bend*.25+(offset?.y??0)}));
}
