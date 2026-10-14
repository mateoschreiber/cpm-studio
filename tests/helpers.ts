import { expect, type Page } from '@playwright/test';
export async function readSavedProject(page:Page) {
  await expect(page.getByText('Guardado en este navegador',{exact:false})).toBeVisible();
  return page.evaluate(()=>new Promise<any>((resolve,reject)=>{
    const id=localStorage.getItem('cpm-studio.active-project.v2');
    const request=indexedDB.open('cpm-studio',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;const get=db.transaction('projects').objectStore('projects').get(id!);get.onsuccess=()=>{db.close();resolve(get.result?.project);};get.onerror=()=>{db.close();reject(get.error);};};
  }));
}
