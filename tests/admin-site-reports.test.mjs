import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const get=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sql=get('supabase/easygart_admin_delegation_site_reports_v1.sql');
const frontend=get('cloud/app.js');
const siteSource=get('cloud/sites_history.js');

test('admin remains a worker and grant/revoke belongs only to original owner',()=>{
 assert.match(sql,/m\.role='worker' and exists\s*\(/);
 assert.match(sql,/c\.created_by=v_actor/);
 assert.match(sql,/m\.role='owner'/);
 assert.match(sql,/v_member\.role<>'worker'/);
 assert.match(sql,/grant execute on function public\.eg_set_admin_delegate/);
 assert.match(sql,/revoke all on function public\.eg_set_admin_delegate[\s\S]*from public,anon,authenticated/);
 assert.match(sql,/eg_admin_delegation_events/);
});
test('worker site access is company-scoped and only published coworker reports are shared',()=>{
 assert.match(sql,/create policy eg_sites_read[\s\S]*private\.eg_is_member\(company_id\)/);
 assert.match(sql,/site_id is not null and status in \(''submitted'',''approved''\)/);
 assert.match(sql,/private\.eg_is_member\(company_id\)/);
});
test('frontend distinguishes primary owner from delegated admin',()=>{
 assert.match(frontend,/const memberIsPrimaryOwner=/);
 assert.match(frontend,/const memberIsAdmin=/);
 assert.match(frontend,/const memberIsOwner = \(\) => memberIsPrimaryOwner\(\)\|\|memberIsAdmin\(\)/);
 assert.match(frontend,/if\(!memberIsPrimaryOwner\(\)\|\|!adminDelegationReady\)return/);
 assert.match(frontend,/data-action="member-admin"/);
 assert.match(frontend,/eg_set_admin_delegate/);
});
test('site history includes empty sites while hiding coworkers drafts',async()=>{
 const sandbox={window:{}};
 runInNewContext(siteSource,sandbox);
 const context={companyId:'co',user:{id:'u1'},isOwner:false,locale:'it',
  members:[{user_id:'u1',full_name:'Anna'},{user_id:'u2',full_name:'Paolo'}],
  sites:[{id:'s1',name:'Giardino'},{id:'s2',name:'Prato senza lavori'}],
  clients:[],tasks:[]};
 const data={
  eg_daily_reports:[{id:'r1',site_id:'s1',created_by:'u2',work_date:'2026-11-01',
    work_summary:'Rapporto pubblicato',status:'submitted',minutes_worked:60},
    {id:'r2',site_id:'s1',created_by:'u2',work_date:'2026-11-02',
    work_summary:'Bozza privata',status:'draft',minutes_worked:40},
    {id:'r3',site_id:'s1',created_by:'u1',work_date:'2026-11-03',
    work_summary:'Mia bozza',status:'draft',minutes_worked:20}],
  eg_shifts:[]
 };
 const client={
  from:table=>({select(){return this},eq(){return this},order(){return this},
    async range(){return {data:data[table]||[],error:null}}}),
  rpc:async()=>({error:{message:'material access denied'}})
 };
 const model=sandbox.window.createEasyGartSiteHistory({client,getContext:()=>context,esc:String});
 await model.refresh('co');
 assert.match(model.markup(),/Prato senza lavori/);
 model.open('s1');
 const detail=model.markup();
 assert.match(detail,/Rapporto pubblicato/);
 assert.match(detail,/Mia bozza/);
 assert.doesNotMatch(detail,/Bozza privata/);
 assert.match(detail,/data-action="site-history-edit-report" data-id="r3"/);
 assert.doesNotMatch(detail,/data-action="site-history-edit-report" data-id="r1"/);
 context.isOwner=true;
 assert.match(model.markup(),/data-action="site-history-edit-report" data-id="r1"/);
});
