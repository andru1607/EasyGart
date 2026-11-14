import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const config=readFileSync(new URL('../cloud/config.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/easygart_core_v1.sql',import.meta.url),'utf8');

test('cloud script parses without syntax errors',()=>new Script(app));
test('page boots independent cloud config and app',()=>{
  assert.match(html,/\.\/config\.js/);assert.match(html,/\.\/app\.js/);
  assert.match(html,/id="app"/);
});
test('credentials are not committed',()=>{
  assert.match(config,/publishableKey:\s*"sb_publishable_[A-Za-z0-9_-]+"/);
  assert.doesNotMatch(config,/sb_secret_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{40,}/);
  assert.match(config,/xdwsqkteykjjpzogwocx/);
});
test('data isolation through RLS is enabled on every cloud table',()=>{
  for(const t of ['eg_companies','eg_members','eg_clients','eg_sites','eg_tasks','eg_invites','eg_task_events']){
    assert.ok(sql.includes('alter table public.'+t+' enable row level security'),t+' must enable RLS');
  }
  assert.match(sql,/create policy eg_tasks_read[\s\S]*?assignee_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(sql,/create policy eg_tasks_write[\s\S]*?private\.eg_is_owner\(company_id\)/);
  assert.match(sql,/create policy eg_tasks_edit[\s\S]*?private\.eg_is_owner\(company_id\)/);
});
test('cross-company references use qualified outer table in policies',()=>{
  assert.match(sql,/t\.client_id=eg_clients\.id and t\.company_id=eg_clients\.company_id/);
  assert.match(sql,/t\.site_id=eg_sites\.id and t\.company_id=eg_sites\.company_id/);
  assert.match(sql,/t\.id=eg_task_events\.task_id and t\.company_id=eg_task_events\.company_id/);
});
test('invitation verified via server Auth not user metadata',()=>{
  assert.match(sql,/email_confirmed_at is not null/);
  assert.match(sql,/from auth\.users u/);
  assert.doesNotMatch(sql,/auth\.jwt\(\)[^\n]*(user_metadata|raw_user_meta_data)/);
});
test('task state mutation uses server-side permission checks and audit',()=>{
  assert.match(sql,/create or replace function public\.eg_set_task_status/);
  assert.match(sql,/v_task\.assignee_id=v_uid/);
  assert.match(sql,/create table if not exists public\.eg_task_events/);
  assert.match(app,/client\.rpc\('eg_set_task_status'/);
});
test('worker invitation and suspension only through server RPC',()=>{
  assert.match(sql,/private\.eg_is_owner\(p_company_id\)/);
  assert.match(sql,/function public\.eg_invite_worker/);
  assert.match(sql,/function public\.eg_set_worker_active/);
  assert.match(app,/client\.rpc\('eg_invite_worker'/);
  assert.match(app,/client\.rpc\('eg_set_worker_active'/);
});
test('client uses pinned Supabase SDK and no admin key',()=>{
  assert.match(app,/@supabase\/supabase-js@2\.57\.0/);
  assert.doesNotMatch(app,/auth\.admin|service_role|sb_secret_/);
});
test('old demo remains independent',()=>{
  assert.match(app,/href="\.\.\/"/);
  assert.doesNotMatch(app,/easygart_mvp_2026_v1/);
});

test('SQL migration has valid paired function delimiters and safe rerun',()=>{
  assert.match(sql,/\nbegin;\s*\n/);
  assert.match(sql,/\ncommit;\s*$/);
  assert.doesNotMatch(sql,/\bas \$(?!\$|[a-zA-Z_])/);
  const dollars=sql.match(/\$\$/g)||[];
  assert.equal(dollars.length%2,0,'double-dollar function delimiters must be paired');
  for(const name of ['eg_invite','eg_worker']){
    assert.equal(sql.split('$'+name+'$').length-1,2,name+' function tag must be paired');
  }
  const policies=[...sql.matchAll(/^create policy (\w+) on (public\.\w+) /gm)];
  assert.equal(policies.length,16);
  for(const p of policies){
    assert.ok(sql.includes('drop policy if exists '+p[1]+' on '+p[2]+';'),
      p[1]+' must be repeatable');
  }
});
