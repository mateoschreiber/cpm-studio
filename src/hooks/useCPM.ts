import {useMemo} from 'react';
import {emptyProject} from '../core/types';
import {solveCPM,validateGraph} from '../core/engine';
import {useProjectStore} from '../store';
export function useCPM(){
  const events=useProjectStore(s=>s.project.events),activities=useProjectStore(s=>s.project.activities);
  const logical=useMemo(()=>({...emptyProject(),events,activities}),[events,activities]);
  return useMemo(()=>{const errors=validateGraph(logical);if(errors.length)return {result:undefined,errors};try{return {result:solveCPM(logical),errors};}catch(error){return {result:undefined,errors:[(error as Error).message]};}},[logical]);
}
