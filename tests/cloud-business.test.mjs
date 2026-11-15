import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';
const source=readFileSync(new URL('../cloud/business.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/easygart_business_v1.sql',import.meta.url),'utf8');
const cron=readFileSync(new URL('../supabase/easygart_maintenance_cron_v1.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
function harness(isOwner=true){
 const calls=[];
 const db={
  eg_materials:[{id:'m1',company_id:'org',name:'Terriccio',unit:'kg',purchase_price:3,sale_price:12,vat_rate:22,active:true}],
  eg_maintenance_plans:[],
  eg_invoice_drafts:[{id:'i1',company_id:'org',client_id:'c1',report_id:'r1',created_at:'2026-11-16T00:00:00Z'}],
  eg_invoice_lines:[{id:'l1',company_id:'org',invoice_id:'i1',kind:'material',description:'Terriccio',quantity:2,unit:'kg',unit_price:12,vat_rate:22}],
  eg_report_materials:[{company_id:'org',report_id:'r1',material_id:'m1',material_name:'Terriccio',unit:'kg',quantity:2,sale_price_snapshot:12,vat_rate_snapshot:22}],
 };
 class Query{
  constructor(table){this.table=table;this.filters=[]}
  select(){return this}
  eq(key,value){this.filters.push([key,value]);return this}
  order(){return this}
  limit(){return this}
  then(resolve,reject){
   const rows=(db[this.table]||[]).filter(row=>this.filters.every(([k,v])=>row[k]===v));
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }
 }
 const client={
  from:table=>{calls.push({name:'select',table});return new Query(table)},
  rpc:async(name,args)=>{calls.push({name,args});return {data:
    name==='eg_list_materials'?[{id:'m1',name:'Terriccio',unit:'kg'}]:
    name==='eg_list_report_materials'?[{material_id:'m1',material_name:'Terriccio',unit:'kg',quantity:2}]:
    name==='eg_generate_maintenance'?0:
    null,error:null}}
 };
 const context=createContext({window:{},console,Date,Intl,Number,String,Math,Array,Object,Set,Map,Promise});
 new Script(source).runInContext(context,{timeout:1000});
 const state={user:{id:isOwner?'boss':'worker'},isOwner,companyId:'org',companyName:'Test Business',
   locale:'it',members:[{user_id:'boss',full_name:'Titolare',role:'owner',active:true},
      {user_id:'worker',full_name:'Marta',role:'worker',active:true}],
   clients:[{id:'c1',name:'Cliente Demo'}],sites:[{id:'s1',name:'Giardino',client_id:'c1'}],
   tasks:[{id:'t1',title:'Potatura',client_id:'c1',site_id:'s1',assignee_id:'worker'}],
   reports:[{id:'r1',task_id:'t1',created_by:'worker',work_date:'2026-11-16',status:'approved'},
     {id:'r2',task_id:'t1',created_by:'worker',work_date:'2026-11-16',status:'draft'}],
   reload:async()=>{}};
 const business=context.window.createEasyGartBusiness({
   client,getContext:()=>state,t:s=>s,tr:s=>s,
   esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
   onSuccess:()=>{},rerender:()=>{}
 });
 return {business,state,calls};
}
test('business module parses and is loaded before main app',()=>{
 new Script(source);
 assert.ok(html.indexOf('business.js')<html.indexOf('app.js?v='));
 assert.match(app,/window\.createEasyGartBusiness/);
 assert.match(app,/business\?\.reportMaterialsMarkup\(report\)/);
 assert.match(app,/business\?\.refresh\(org\)/);
});
test('material catalog keeps unit costs and selling prices owner-only',async()=>{
 const o=harness(true);await o.business.refresh('org');
 const shown=o.business.markup('materials');
 assert.match(shown,/Terriccio/);
 assert.match(shown,/3,00|3\.00|3,00/);
 assert.match(shown,/12,00|12\.00/);
 const w=harness(false);await w.business.refresh('org');
 assert.ok(w.calls.some(x=>x.name==='eg_list_materials'));
 assert.equal(w.calls.filter(x=>x.table==='eg_materials').length,0,'worker must never select material pricing table');
 assert.doesNotMatch(w.business.reportMaterialsMarkup(w.state.reports[1]),/12,00/);
});
test('worker sees consumption entry only for own editable report',async()=>{
 const h=harness(false);await h.business.refresh('org');
 const edit=h.state.reports[1];
 assert.match(h.business.reportMaterialsMarkup(edit),/biz-open-usage/);
 await h.business.handleAction({dataset:{action:'biz-open-usage',id:edit.id}});
 const html=h.business.reportMaterialsMarkup(edit);
 assert.match(html,/data-form="biz-usage"/);
 assert.match(html,/Terriccio/);
 assert.doesNotMatch(html,/sale_price_snapshot|purchase_price|12,00/);
 assert.doesNotMatch(h.business.reportMaterialsMarkup(h.state.reports[0]),/data-form="biz-usage"/);
});
test('owner can see invoice draft with VAT totals but not a fiscal invoice claim',async()=>{
 const h=harness(true);await h.business.refresh('org');
 const out=h.business.markup('invoices');
 assert.match(out,/Bozze proforma/);
 assert.match(out,/SDI/);
 assert.match(out,/Cliente Demo/);
 assert.match(out,/Crea bozza da rapporto approvato/);
 const s=h.business.summary('i1');
 assert.equal(Math.round(s.base*100),2400);
 assert.equal(Math.round(s.vat*100),528);
 assert.equal(Math.round(s.total*100),2928);
});
test('recurrence plan form supports frequency, assigned worker, client and site',async()=>{
 const h=harness(true);await h.business.refresh('org');
 await h.business.handleAction({dataset:{action:'biz-new-plan'}});
 const x=h.business.markup('maintenance');
 for(const name of ['cadence','assignee_id','client_id','site_id','next_due_date'])
   assert.match(x,new RegExp('name="'+name+'"'));
 for(const cadence of ['weekly','biweekly','monthly','quarterly'])assert.match(x,new RegExp('value="'+cadence+'"'));
});
test('RLS isolates catalog prices and invoice tables and denies direct worker writes',()=>{
 assert.match(sql,/alter table public\.eg_materials enable row level security/);
 assert.match(sql,/create policy eg_materials_owner_select[\s\S]*?private\.eg_is_owner\(company_id\)/);
 assert.match(sql,/create policy eg_report_materials_owner_select[\s\S]*?private\.eg_is_owner\(company_id\)/);
 assert.match(sql,/revoke all on public\.eg_report_materials from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.eg_report_materials to authenticated/);
 assert.match(sql,/create policy eg_invoice_drafts_owner_select/);
 assert.match(sql,/create policy eg_invoice_lines_owner_insert/);
 assert.match(sql,/private\.eg_is_member\(p_company_id\)/);
 assert.match(sql,/v_report\.status not in \('draft','changes_requested'\)/);
 assert.match(sql,/create unique index if not exists eg_tasks_unique_plan_date/);
 assert.match(sql,/on conflict \(maintenance_plan_id,due_date\) where maintenance_plan_id is not null/);
 assert.match(sql,/create function public\.eg_generate_maintenance/);
 assert.doesNotMatch(sql,/create function public\.eg_\w+\([\s\S]{0,180}security definer/);
});
test('recurring maintenance has a private, scheduled job and no public elevated API',()=>{
 assert.match(cron,/create extension if not exists pg_cron/);
 assert.match(cron,/private\.eg_run_maintenance_scheduler/);
 assert.match(cron,/revoke all on function private\.eg_run_maintenance_scheduler\(\) from public,anon,authenticated/);
 assert.match(cron,/cron\.schedule\(/);
 assert.match(cron,/on conflict\(maintenance_plan_id,due_date\)/);
 assert.doesNotMatch(cron,/create function public\.eg_run_maintenance_scheduler/);
});
test('business German dictionary covers all direct business labels',()=>{
 const dictionary=new Function(app.slice(app.indexOf('const german ='),app.indexOf('const tr ='))+';return german')();
 const businessTranslations=runInContext('window.EASYGART_BUSINESS_I18N',createContext((()=>{
   const state={window:{}};
   new Script(source).runInContext(createContext(state),{timeout:1000});
   return state;
 })()));
 const words=[...source.matchAll(/\b(?:b|tr)\((?:'([^']+)'|"([^"]+)")\)/g)]
   .map(m=>m[1]??m[2]);
 const missing=[...new Set(words)].filter(x=>!Object.hasOwn(dictionary,x)&&!Object.hasOwn(businessTranslations,x));
 assert.deepEqual(missing,[],'Missing German words: '+missing.join(' | '));
});
