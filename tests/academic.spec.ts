import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { guideProject } from '../src/core/fixtures';
import {readSavedProject} from './helpers';

async function loadGuide(page:Page) {
  await page.goto('/');
  await page.getByLabel('Importar proyecto JSON').setInputFiles({name:'guia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(guideProject()))});
  await expect(page.getByTestId('project-duration')).toHaveText('15');
}
async function openView(page:Page,name:string) {
  await page.getByRole('navigation',{name:'Módulos académicos'}).getByRole('button',{name,exact:true}).click();
}

test('red resuelta reproduce rombos y triángulos calculados de la guía',async({page})=>{
  await loadGuide(page);
  await openView(page,'Red resuelta');
  for(const [id,value] of [['ufc-B','6'],['pff-B','4'],['ufc-D','10'],['pff-D','11']])
    await expect(page.getByTestId(id).locator('text')).toHaveText(value);
  for(const [id,early,late] of [['0',0,0],['1',8,8],['2',8,10],['3',13,13],['4',15,15]])
    await expect(page.locator(`.react-flow__node[data-id="${id}"] .event-diamond`)).toHaveAttribute('aria-label',`Suceso ${id}, Ft ${early}, FT ${late}`);
  await expect(page.getByTestId('project-duration')).toHaveText('15');
});

test('calendario y Gantt mantienen la ejecución real y distinguen la espera',async({page})=>{
  await loadGuide(page);
  await openView(page,'Calendario');
  const calendar=page.getByRole('region',{name:'Calendario',exact:true});
  const b=calendar.locator('g[data-activity-id="B"]');
  await expect(b.locator('[data-start="0"][data-finish="4"]')).toHaveCount(1);
  await expect(b.locator('[data-wait-start="4"][data-wait-finish="8"]')).toHaveCount(1);
  await calendar.getByRole('button',{name:'Tardía',exact:true}).click();
  await expect(b.locator('[data-start="6"][data-finish="10"]')).toHaveCount(1);
  await expect(b.locator('[data-wait-start="0"][data-wait-finish="6"]')).toHaveCount(1);
  await calendar.getByRole('button',{name:'B',exact:true}).click();
  await calendar.getByLabel('Desplazamiento vertical de actividad').fill('12');
  await calendar.getByRole('button',{name:'Subir actividad',exact:true}).click();
  await expect(calendar.locator('tbody tr').first()).toContainText('B');
  await openView(page,'Gantt');
  const gantt=page.getByRole('region',{name:'Gantt',exact:true});
  await gantt.getByRole('button',{name:'Temprana',exact:true}).click();
  await expect(gantt.locator('g[data-activity-id="B"] [data-start="0"][data-finish="4"]')).toHaveCount(1);
  await gantt.getByRole('button',{name:'Tardía',exact:true}).click();
  await expect(gantt.locator('g[data-activity-id="B"] [data-start="6"][data-finish="10"]')).toHaveCount(1);
  await expect(page.getByTestId('project-duration')).toHaveText('15');
});

test('recursos temprano y tardío tienen total 89, pico 9 y exportaciones reales',async({page})=>{
  await loadGuide(page);await openView(page,'Recursos');
  const view=page.getByRole('region',{name:'Recursos',exact:true});
  for(const mode of ['Temprana','Tardía']) {
    await view.getByRole('button',{name:mode,exact:true}).click();
    await expect(view.locator('.temporal-stats>div').nth(1)).toContainText('9 recursos');
    await expect(view.locator('.temporal-stats>div').nth(2)).toContainText('89 recursos·tiempo');
    await view.getByRole('button',{name:'Acumulado',exact:true}).click();
    await expect(view.locator('.temporal-plot svg')).toHaveAttribute('aria-label',new RegExp('Consumo acumulado'));
    await expect(view.locator('tbody tr').last().locator('td').last()).toHaveText('89');
  }
  for(const format of ['SVG','PNG','CSV']) {
    const promise=page.waitForEvent('download');
    await view.getByRole('button',{name:format,exact:true}).click();
    const download=await promise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    const filename=await download.path();
    expect(filename).not.toBeNull();
    const bytes=await readFile(filename!);
    expect(bytes.length).toBeGreaterThan(100);
    if(format==='PNG')expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    if(format==='SVG')expect(bytes.toString()).toContain('Total: 89');
  }
});

test('resolución didáctica termina en la duración del motor y permite reiniciar',async({page})=>{
  await loadGuide(page);await openView(page,'Resolución');
  const view=page.getByRole('region',{name:'Resolución paso a paso'});
  await view.getByRole('button',{name:'Camino crítico',exact:true}).click();
  await expect(view.locator('.solution-value strong')).toHaveText('15');
  await expect(view.locator('.substitution')).toContainText('A, C, E');
  await expect(view.getByLabel('Paso siguiente')).toBeDisabled();
  await view.getByLabel('Reiniciar resolución').click();
  await expect(view.locator('.step-kicker')).toContainText('Paso 1 /');
  await view.getByRole('button',{name:'Cómputo de ida',exact:true}).click();
  await expect(view.locator('.solution-operation')).toContainText('Ft(inicio) = 0');
  await view.getByLabel('Animaciones didácticas').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  await expect(view.locator('.solution-operation')).not.toHaveClass(/with-motion/);
});

test('temas y módulos se adaptan a 390, 768 y 1440 píxeles con movimiento reducido',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
  await loadGuide(page);
  await page.getByRole('button',{name:'Cambiar tema',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await openView(page,'Calendario');
  for(const width of [390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    await expect(page.getByRole('region',{name:'Calendario',exact:true})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,`horizontal page overflow at ${width}px`).toBe(false);
    await expect(page.locator('.temporal-stats>div').first()).toHaveCSS('animation-name','none');
  }
  await page.getByRole('button',{name:'Cambiar tema',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('PWA abre módulos nunca visitados y genera informe tras recargar sin conexión',async({page,context})=>{
  test.setTimeout(60000);
  const external:string[]=[];
  page.on('request',request=>{const url=request.url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:4173/'))external.push(url);});
  await loadGuide(page);
  await expect(page.getByText('Guardado en este navegador',{exact:false})).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:20000}).toBe(true);
  // No academic lazy view has been opened in this isolated browser context.
  await context.setOffline(true);
  try {
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByTestId('project-duration')).toHaveText('15');
    expect(await page.evaluate(()=>fetch(`/not-in-cache-${Date.now()}`).then(()=>false).catch(()=>true))).toBe(true);
    // ELK and the compute worker have never run in this context before disconnecting.
    const before=await readSavedProject(page);
    await page.getByRole('button',{name:'Distribuir',exact:true}).click();
    await expect.poll(async()=>(await readSavedProject(page)).visual.nodes,{timeout:20000}).not.toEqual(before.visual.nodes);
    await expect(page.getByTestId('project-duration')).toHaveText('15');
    await openView(page,'Calendario');
    await expect(page.getByRole('region',{name:'Calendario',exact:true}).locator('g[data-activity-id="B"]')).toHaveCount(1);
    await openView(page,'Gantt');
    await expect(page.getByRole('region',{name:'Gantt',exact:true}).locator('svg')).toHaveCount(1);
    await openView(page,'Recursos');
    await expect(page.locator('.temporal-stats>div').nth(2)).toContainText('89');
    await openView(page,'Resolución');
    await expect(page.getByRole('region',{name:'Resolución paso a paso'})).toBeVisible();
    await openView(page,'Informe');
    const report=page.frameLocator('#report-frame');
    await expect(report.getByRole('heading',{name:'Consumo acumulado tardío',exact:true})).toBeVisible();
    await expect(report.locator('svg')).toHaveCount(10);
    expect(external).toEqual([]);
  } finally {await context.setOffline(false);}
});
