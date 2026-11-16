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
const securityConfig=JSON.parse(await readFile(resolve(root,'vercel.json'),'utf8'));
const cloudCsp=securityConfig.headers.find(x=>x.source==='/cloud/(.*)')
  ?.headers.find(x=>x.key==='Content-Security-Policy')?.value;
assert.ok(cloudCsp,'Missing production CSP');
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!filename.startsWith(root+sep)){res.writeHead(403);res.end();return}
  const file=await stat(filename);
  if(!file.isFile()){res.writeHead(404);res.end();return}
  const headers={'content-type':mimes[extname(filename)]||'text/plain','cache-control':'no-store'};
  if(path.startsWith('/cloud/'))headers['content-security-policy']=cloudCsp;
  res.writeHead(200,headers);
  res.end(await readFile(filename));
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
function zipPayloads(bytes){
 const files={};let pos=0;
 while(pos+30<=bytes.length && bytes.readUInt32LE(pos)===0x04034b50){
   const len=bytes.readUInt32LE(pos+18);
   const nameLength=bytes.readUInt16LE(pos+26),extra=bytes.readUInt16LE(pos+28);
   const name=bytes.toString('utf8',pos+30,pos+30+nameLength);
   const begin=pos+30+nameLength+extra;
   files[name]=bytes.subarray(begin,begin+len);
   pos=begin+len;
 }
 assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50,'ZIP directory is present');
 return files;
}
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
 const context=await browser.newContext({...device,serviceWorkers:'block',acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://esm.sh/**',route=>route.fulfill({
  status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__testSupabase}'
 }));
 const ownerData=JSON.parse(JSON.stringify(fakeData));
 ownerData.eg_report_media=[{
   id:'abc123',company_id:'org1',report_id:'r1',author_id:'worker1',
   kind:'before',status:'uploaded',mime_type:'image/png',bytes:8,
   storage_path:'org1/r1/before/abc123.png',signer_name:null
 }];
 await page.addInitScript(data=>{
  class FakeQuery{
   constructor(table){this.table=table;this.filters=[];this.max=9999}
   select(){return this}
   eq(k,v){this.filters.push(row=>row[k]===v);return this}
   in(k,vals){this.filters.push(row=>vals.includes(row[k]));return this}
   order(){return this}
   range(from,to){this.from=from;this.to=to+1;return this}
   limit(n){this.max=n;return this}
   then(resolve,reject){
    const rows=(data[this.table]||[]).filter(row=>this.filters.every(fn=>fn(row))).slice(this.from||0,this.to||this.max);
    return Promise.resolve({data:rows,error:null}).then(resolve,reject);
   }
  }
  window.__testSupabase={
   auth:{getUser:async()=>({data:{user:{id:'owner1',email:'owner@example.invalid'}},error:null}),
     onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   from:table=>new FakeQuery(table),
   rpc:async(name)=>({data:name==='eg_generate_maintenance'?0:null,error:null}),
   storage:{from:()=>({
     createSignedUrl:async()=>({data:{},error:null}),
     download:async()=>({data:new Blob([Uint8Array.from([137,80,78,71,0,1,2,3])],{type:'image/png'}),error:null})
   })}
  };
 },ownerData);
 const response=await page.goto(base+'/cloud/',{waitUntil:'domcontentloaded'});
 assert.match(response.headers()['content-security-policy'],/frame-ancestors 'none'/);
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
 // Real browser download, not just static code: WebKit and Chromium.
 await page.locator('button[data-action="biz-export-data"]').click();
 // iOS requires a new, explicit tap after async preparation before starting the download.
 const downloadLink=page.locator('a[download][href^="blob:"]');
 await downloadLink.waitFor({timeout:15000});
 const downloadPromise=page.waitForEvent('download',{timeout:20000});
 await downloadLink.click();
 const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/^easygart-export-\d{4}-\d{2}-\d{2}\.json$/);
 const contents=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(contents.format,'easygart-json-export');
 assert.equal(contents.company.id,'org1');
 assert.equal(contents.tables.eg_clients[0].name,'Cliente prova');
 assert.equal(contents.tables.eg_materials[0].sale_price,12);
 assert.equal(contents.tables.eg_invoice_drafts[0].id,'i1');
 assert.ok(!('auth.users' in contents.tables));
 assert.ok(!('media_binary' in contents));
 // Complete archive: download the original private media after explicit user tap.
 await page.locator('button[data-action="biz-export-full"]').click();
 const zipLink=page.locator('a[download$=".zip"][href^="blob:"]');
 await zipLink.waitFor({timeout:15000});
 const zipPromise=page.waitForEvent('download',{timeout:20000});
 await zipLink.click();
 const zipped=await zipPromise;
 assert.match(zipped.suggestedFilename(),/^easygart-export-\d{4}-\d{2}-\d{2}\.zip$/);
 const payloads=zipPayloads(await readFile(await zipped.path()));
 assert.ok(payloads['easygart-export.json']);
 assert.ok(payloads['allegati/org1/r1/before/abc123.png']);
 assert.equal(JSON.parse(payloads['easygart-export.json'].toString('utf8')).tables.eg_report_media.length,1);
 assert.deepEqual([...payloads['allegati/org1/r1/before/abc123.png']],[137,80,78,71,0,1,2,3]);
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
async function workerSmoke(engineName,browserType,device){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({...device,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://esm.sh/**',route=>route.fulfill({
  status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__testSupabase}'
 }));
 const data=JSON.parse(JSON.stringify(fakeData));
 data.eg_daily_reports=[{...data.eg_daily_reports[0],id:'r2',status:'draft'}];
 data.eg_invoice_drafts=[];
 data.eg_invoice_lines=[];
 await page.addInitScript(data=>{
  class Query{
   constructor(table){this.table=table;this.filters=[];this.max=10000}
   select(){return this}
   eq(k,v){this.filters.push(x=>x[k]===v);return this}
   in(k,vals){this.filters.push(x=>vals.includes(x[k]));return this}
   order(){return this}
   limit(n){this.max=n;return this}
   then(resolve,reject){return Promise.resolve({
    data:(data[this.table]||[]).filter(x=>this.filters.every(f=>f(x))).slice(0,this.max),error:null
   }).then(resolve,reject)}
  }
  window.__testSupabase={
   auth:{getUser:async()=>({data:{user:{id:'worker1',email:'worker@example.invalid'}},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   from:table=>new Query(table),
   rpc:async(name,args)=>({error:null,
    data:name==='eg_list_materials'?[{id:'m1',name:'Terriccio',unit:'kg'}]:
      name==='eg_list_report_materials'?[]:
      name==='eg_media_reserve'?{id:'media-test',path:'org1/r2/'+(args?.p_kind||'before')+'/media-test.png'}:
      name==='eg_shift_action'?'shift-test':null
   }),
   storage:{from:()=>({
    createSignedUrl:async()=>({data:{},error:null}),
    upload:async()=>({data:{path:'uploaded'},error:null}),
    remove:async()=>({data:[],error:null})
   })}
  };
 },data);
 await page.goto(base+'/cloud/',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-view="reports"]').waitFor({timeout:15000});
 assert.equal(await page.locator('button[data-view="materials"]').count(),0,'Worker has manager-only navigation');
 await page.locator('button[data-view="reports"]').click();
 await page.locator('[data-action="biz-open-usage"]').click();
 assert.ok(await page.locator('form[data-form="biz-usage"]').isVisible());
 assert.ok((await page.locator('form[data-form="biz-usage"] select[name="material_id"] option').allTextContents()).some(x=>x.includes('Terriccio')));
 const image=await readFile(resolve(root,'cloud/icon-192.png'));
 await page.locator('input[data-ops-input="before"]').setInputFiles({
  name:'photo.png',mimeType:'image/png',buffer:image
 });
 await page.getByText('Fotografie caricate nel deposito privato.').waitFor({timeout:10000});
 await page.locator('[data-action="ops-sign-open"]').click();
 const canvas=page.locator('canvas[data-ops-signature]');
 await canvas.waitFor();
 await canvas.scrollIntoViewIfNeeded();
 const box=await canvas.boundingBox();
 await page.mouse.move(box.x+30,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/3,box.y+box.height/2-12,{steps:7});
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2+10,{steps:7});
 await page.mouse.up();
 await page.locator('form[data-form="ops-signature"] [name="signer_name"]').fill('Cliente Demo');
 await page.locator('form[data-form="ops-signature"] [name="consent"]').check();
 await page.locator('form[data-form="ops-signature"] button[type="submit"]').click();
 await page.getByText('Firma salvata in archivio privato.').waitFor({timeout:10000});
 const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.width+2,engineName+' overflow with worker media forms');
 assert.deepEqual(errors,[],engineName+' worker JS errors');
 await browser.close();
 console.log(engineName+': employee material catalog, photo upload and touch signature OK');
}
async function authSmoke(engineName,browserType,device){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({...device,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://esm.sh/**',route=>route.fulfill({
  status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__testSupabase}'
 }));
 await page.addInitScript(()=>{
  const events=[];
  window.__testSupabase={
   events,
   auth:{
    getUser:async()=>({data:{user:null},error:null}),
    onAuthStateChange:callback=>{window.__authCallback=callback;return {data:{subscription:{unsubscribe(){}}}}},
    resetPasswordForEmail:async(email,options)=>{
     events.push({action:'reset',email,options});return {data:{},error:null};
    },
    updateUser:async(payload)=>{events.push({action:'update',passwordLength:payload.password.length});return {data:{},error:null}},
    signOut:async(options)=>{events.push({action:'signout',options});return {data:{},error:null}}
   }
  };
 });
 await page.goto(base+'/cloud/',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-mode="forgot"]').waitFor({timeout:15000});
 await page.locator('#locale').selectOption('de');
 await page.locator('button[data-mode="forgot"]').click();
 await page.locator('form[data-form="password-request"] [name="email"]').fill('example@invalid.test');
 await page.locator('form[data-form="password-request"] button[type="submit"]').click();
 await page.getByText(/Wenn die Adresse registriert ist/).waitFor({timeout:10000});
 const reset=await page.evaluate(()=>window.__testSupabase.events[0]);
 assert.equal(reset.action,'reset');
 assert.equal(reset.options.redirectTo,'https://easygarte.vercel.app/cloud/');
 await page.evaluate(()=>window.__authCallback('PASSWORD_RECOVERY',{
  user:{id:'recover-user',email:'example@invalid.test'}
 }));
 await page.locator('form[data-form="password-update"]').waitFor({timeout:10000});
 assert.ok(await page.getByText('Neues Passwort festlegen').isVisible());
 await page.locator('form[data-form="password-update"] [name="password"]').fill('very-long-new-password-123');
 await page.locator('form[data-form="password-update"] [name="confirm_password"]').fill('very-long-new-password-123');
 await page.locator('form[data-form="password-update"] button[type="submit"]').click();
 await page.getByText(/Passwort aktualisiert/).waitFor({timeout:10000});
 const events=await page.evaluate(()=>window.__testSupabase.events);
 assert.deepEqual(events.map(e=>e.action),['reset','update','signout']);
 assert.equal(events[2].options.scope,'global');
 assert.deepEqual(errors,[],engineName+' password recovery JS errors');
 await browser.close();
 console.log(engineName+': German password recovery and secure signout OK');
}
try{
 await smoke('iOS WebKit emulation',webkit,devices['iPhone 13']);
 await smoke('Android Chromium emulation',chromium,devices['Pixel 7']);
 await workerSmoke('iOS WebKit emulation',webkit,devices['iPhone 13']);
 await workerSmoke('Android Chromium emulation',chromium,devices['Pixel 7']);
 await authSmoke('iOS WebKit emulation',webkit,devices['iPhone 13']);
 await authSmoke('Android Chromium emulation',chromium,devices['Pixel 7']);
}finally{server.close()}
