import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";

// A connected chain avoids benchmarking the separate AOA simplifier instead of the editor.
function fixture(count) {
  const events = Array.from({length:count+1},(_,i)=>({id:`n${i}`,label:String(i)}));
  const activities = Array.from({length:count},(_,i)=>({id:`a${i}`,name:`A${i+1}`,source:`n${i}`,target:`n${i+1}`,duration:1,resources:1,dummy:false}));
  return {
    version:1,name:`Medición ${count}`,events,activities,
    visual:{
      nodes:Object.fromEntries(events.map((event,i)=>[event.id,{x:80+(i%12)*130,y:80+Math.floor(i/12)*100}])),
      edges:Object.fromEntries(activities.map(activity=>[activity.id,{kind:"straight",bend:0,labelX:0,labelY:0,color:"#64748b",width:2}])),
    },
    preferences:{grid:true,snap:false,showLabels:true,showDates:true,highlight:true,criticalColor:"#ef4444"},
  };
}
const browser = await chromium.launch();
const results = [];
try {
  for (const count of [100,500]) {
    const context = await browser.newContext({viewport:{width:1440,height:1100}});
    const page = await context.newPage();
    await page.goto(process.env.CPM_BENCHMARK_URL || "http://127.0.0.1:4173/");
    const started = performance.now();
    await page.getByLabel("Importar proyecto JSON").setInputFiles({name:"benchmark.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture(count)))});
    await page.getByTestId("project-duration").filter({hasText:String(count)}).waitFor();
    await page.locator(".react-flow__node").first().waitFor();
    const importMs = performance.now()-started;
    await page.getByText('Guardado en este navegador',{exact:false}).waitFor();
    // Exclude the requested initial fit animation from the measured drag.
    await page.evaluate(()=>new Promise(resolve=>{
      let previous='',stable=0;
      const frame=()=>{const current=document.querySelector('.react-flow__viewport')?.getAttribute('style')??'';stable=current===previous?stable+1:0;previous=current;if(stable>=3)resolve();else requestAnimationFrame(frame);};
      requestAnimationFrame(frame);
    }));
    // Sample frames over a real mouse gesture; store raw samples for reproducibility.
    await page.evaluate(()=>{
      window.__cpmFrames=[]; window.__cpmSampling=true;
      let last;
      const frame=(now)=>{if(last!==undefined)window.__cpmFrames.push(now-last);last=now;if(window.__cpmSampling)requestAnimationFrame(frame);};
      requestAnimationFrame(frame);
    });
    // The middle node remains inside the canvas even at the minimum zoom.
    const node = page.locator(".react-flow__node").nth(Math.floor(count/2));
    await node.scrollIntoViewIfNeeded();
    const box = await node.boundingBox();
    if (!box) throw new Error(`No visible node for ${count} activities`);
    const beforePosition=await node.getAttribute('style');
    const dragStarted=performance.now();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    for(let step=1;step<=30;step++) {
      await page.mouse.move(box.x+box.width/2+step*2,box.y+box.height/2+step);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    }
    await page.mouse.up();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    if(await node.getAttribute('style')===beforePosition)throw new Error(`The benchmark did not move a node for ${count} activities`);
    const dragMs=performance.now()-dragStarted;
    const samples = await page.evaluate(()=>{window.__cpmSampling=false;return window.__cpmFrames;});
    const sorted=[...samples].sort((a,b)=>a-b);
    const quantile=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]??null;
    results.push({activities:count,importMs,dragMs,frameMedianMs:quantile(.5),frameP95Ms:quantile(.95),framesOver50Ms:samples.filter(ms=>ms>50).length,samples});
    await context.close();
  }
  await mkdir("test-results",{recursive:true});
  const report={createdAt:new Date().toISOString(),platform:process.platform,cpu:os.cpus()[0]?.model,browser:browser.version(),results};
  await writeFile("test-results/benchmark.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,results:results.map(({samples,...summary})=>summary)},null,2));
} finally { await browser.close(); }
