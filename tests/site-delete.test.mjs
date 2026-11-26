import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/easygart_site_delete_v1.sql',import.meta.url),'utf8');
test('site removal is visible and permission-gated',()=>{
  assert.match(app,/data-action="delete-site"/);
  assert.ok(app.includes("if(a==='delete-site'&&memberIsOwner())"));
  assert.ok(app.includes("client.rpc('eg_delete_unused_site',{p_company_id:companyId,p_site_id:target.id})"));
  assert.ok(app.includes("if(!confirm(msg('Eliminare definitivamente il cantiere"));
});
test('site deletion preserves history and client',()=>{
  assert.match(sql,/private\.eg_is_owner\(p_company_id\)/);
  assert.match(sql,/for update/);
  for(const table of ['eg_tasks','eg_daily_reports','eg_shifts','eg_maintenance_plans'])assert.ok(sql.includes('from public.'+table+' where company_id=p_company_id and site_id=p_site_id'));
  assert.match(sql,/delete from public\.eg_sites where company_id=p_company_id and id=p_site_id/);
  assert.doesNotMatch(sql,/delete from public\.eg_clients/);
  assert.match(sql,/security invoker/);
});
