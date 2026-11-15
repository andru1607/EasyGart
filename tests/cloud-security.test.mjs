import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../supabase/easygart_security_rpc_boundary_v1.sql',import.meta.url),'utf8');
const affected=[
'eg_claim_invitations','eg_invite_worker','eg_media_finalize','eg_media_release',
'eg_media_reserve','eg_review_daily_report','eg_save_daily_report',
'eg_set_task_status','eg_set_worker_active','eg_shift_action'
];
test('security migration atomic and protects against unsafe repeats',()=>{
  assert.match(migration,/^begin;/m);
  assert.match(migration,/^commit;/m);
  assert.match(migration,/v_public<>10/);
  assert.match(migration,/v_private<>0/);
  assert.equal(migration.split('$eg_rpc_preflight$').length-1,2);
});
test('all privileged RPCs are moved intact into an unexposed schema',()=>{
  for(const f of affected){
    assert.match(migration,new RegExp('alter function public\\.'+f+'\\('));
    assert.match(migration,new RegExp('create function public\\.'+f+'\\('));
    assert.match(migration,new RegExp('select private\\.'+f+'\\('));
    assert.match(migration,new RegExp('revoke all on function public\\.'+f+'\\('));
    assert.match(migration,new RegExp('grant execute on function public\\.'+f+'\\('));
  }
  assert.equal((migration.match(/alter function public\.eg_\w+\([^;\n]*\) set schema private;/g)||[]).length,10);
  assert.equal((migration.match(/language sql security invoker set search_path = ''/g)||[]).length,10);
  assert.equal((migration.match(/as \$eg_wrapper\$/g)||[]).length,10);
  assert.equal(migration.split('$eg_wrapper$').length-1,20);
});
test('role privileges follow least-privilege and schema remains hidden',()=>{
  assert.match(migration,/revoke all on schema private from public,anon;/);
  assert.match(migration,/grant usage on schema private to authenticated;/);
  assert.match(migration,/notify pgrst,'reload schema';/);
  assert.doesNotMatch(migration,/grant execute on function public\.eg_\w+\([^;]*\) to anon;/);
  assert.doesNotMatch(migration,/disable row level security|drop table|delete from public\.eg_/i);
});
test('frontend RPC names and default args stay compatible',()=>{
  assert.match(migration,/eg_media_reserve\([\s\S]*?p_signer_name text DEFAULT NULL::text, p_consent boolean DEFAULT false\)/);
  assert.match(migration,/eg_shift_action\(p_company_id uuid, p_action text, p_site_id uuid DEFAULT NULL::uuid\)/);
});
