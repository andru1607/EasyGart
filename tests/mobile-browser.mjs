// Browser-engine smoke: WebKit (iOS-like Safari) + Chromium (Android-like Chrome).
// Uses only stubbed Supabase responses. NO real company data or credentials.
import {chromium,webkit,devices} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.cwd()),mimes={
 '.html':'text/html','.js':'text/javascript','.json':'application/json',
 '.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'
};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!filename.startsWith(root+sep)){res.writeHead(403);res.end();return}
  const file=await stat(filename);
  if(!file.isFile()){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':mimes[extname(filename)]||'text/plain','cache-control':'no-store'});
  res.end(await readFile(filename));
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const fakeData={
 eg_members:[{company_id:'org1',user_id:'owner1',full_name:'Titolare Demo',role:'owner',active:true},
   {company_id:'org1',user_id:'worker1',full_name:'Operatore Demo',role:'worker',active:true}],
 eg_companies:[{id:'org1',name:'EasyGart Test'}],
 eg_clients:[{id:'c1',company_id:'org1',name:'Cliente prova'}],
 eg_sites:[{id:'s1',company_id:'org1',client_id:'c1',name:'Giardino prova',address:'Indirizzo fittizio'}],
 eg_tasks:[{id:'t1',company_id:'org1',client_id:'c1',site_id:'s1',title:'Potatura',assignee_id:'worker1',
    due_date:'2026-11-17',start_time:'10:00',status:'assigned',priority:'media',instructions:'Intervento programmato'}],
 eg_invites:[],
 eg_daily_reports:[{id:'r1',company_id:'org1',task_id:'t1',created_by:'worker1',work_date:'2026-11-16',
    minutes_worked:120,work_summary:'Potatura completata',status:'approved',created_at:'2026-11-16T09:00:00Z'}],
 eg_shifts:[],eg_report_media:[],
 eg_materials:[{id:'m1',company_id:'org1',name:'Terriccio',unit:'kg',purchase_price:3,sale_price:12,vat_rate:22,active:true}],
 eg_maintenance_plans:[],
 eg_invoice_drafts:[{id:'i1',company_id:'org1',report_id:'r1',client_id:'c1',created_at:'2026-11-16T09:00:00Z'}],
 eg_invoice_lines:[{id:'l1',company_id:'org1',invoice_id:'i1',description:'Terriccio',quantity:2,unit:'kg',unit_price:12,vat_rate:22}],
 eg_report_materials:[{company_id:'org1',report_id:'r1',material_id:'m1',material_name:'Terriccio',quantity:2,unit:'kg',sale_price_snapshot:12,vat_rate_snapshot:22}]
};
async function smoke(engineName,browserType,device){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({...device,serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://esm.sh/**',route=>route.fulfill({
  status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__testSupabase}'
 }));
 await page.addInitScript(data=>{
  class FakeQuery{
   constructor(table){this.table=table;this.filters=[];this.max=9999}
   select(){return this}
   eq(k,v){this.filters.push(row=>row[k]===v);return this}
   in(k,vals){this.filters.push(row=>vals.includes(row[k]));return this}
   order(){return this}
   limit(n){this.max=n;return this}
   then(resolve,reject){
    const rows=(data[this.table]||[]).filter(row=>this.filters.every(fn=>fn(row))).slice(0,this.max);
    return Promise.resolve({data:rows,error:null}).then(resolve,reject);
   }
  }
  window.__testSupabase={
   auth:{getUser:async()=>({data:{user:{id:'owner1',email:'owner@example.invalid'}},error:null}),
     onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   from:table=>new FakeQuery(table),
   rpc:async(name)=>({data:name==='eg_generate_maintenance'?0:null,error:null}),
   storage:{from:()=>({createSignedUrl:async()=>({data:{},error:null})})}
  };
 },fakeData);
 await page.goto(base+'/cloud/',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-view="materials"]').waitFor({timeout:15000});
 const views=['materials','maintenance','invoices','archive','tasks','reports','clock','clients','team'];
 for(const view of views){
  await page.locator('button[data-view="'+view+'"]').click();
  await page.waitForTimeout(30);
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.width+2,
    engineName+' horizontal overflow on '+view+': '+JSON.stringify(size));
 }
 await page.locator('button[data-view="materials"]').click();
 assert.ok(await page.getByText('Terriccio').count()>0,'catalog visible');
 await page.locator('button[data-action="biz-new-material"]').click();
 assert.ok(await page.locator('form[data-form="biz-material"]').isVisible());
 await page.locator('button[data-view="invoices"]').click();
 assert.ok(await page.getByText('Cliente prova').count()>0);
 await page.locator('button[data-action="biz-invoice-detail"]').click();
 assert.ok(await page.locator('#biz-invoice-detail').isVisible());
 await page.locator('#locale').selectOption('de');
 assert.ok(await page.locator('button[data-view="materials"]').textContent().then(x=>x.includes('Materialkatalog')));
 await page.locator('button[data-view="archive"]').click();
 assert.ok(await page.locator('button[data-action="biz-export-data"]').isVisible());
 await context.setOffline(true);
 // Mobile network banners depend on navigator.onLine; context offline event should fire.
 await page.waitForTimeout(200);
 const banner=page.locator('#eg-network-banner');
 assert.ok(await banner.isVisible(),'Offline banner not visible');
 await context.setOffline(false);
 await page.waitForTimeout(100);
 assert.ok(!(await banner.isVisible()),'Offline banner remains visible');
 assert.deepEqual(errors,[],engineName+' JS errors: '+errors.join(' | '));
 await browser.close();
 console.log(engineName+': all nine views, German UI, offline warning and no horizontal scrolling OK');
}
try{
 await smoke('iOS WebKit emulation',webkit,devices['iPhone 13']);
 await smoke('Android Chromium emulation',chromium,devices['Pixel 7']);
}finally{server.close()}
