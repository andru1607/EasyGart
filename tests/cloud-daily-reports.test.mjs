import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext, runInContext, Script} from 'node:vm';
const app = readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const sql = readFileSync(new URL('../supabase/easygart_daily_reports_v1.sql',import.meta.url),'utf8');

test('cloud JavaScript is syntactically valid',()=>new Script(app));
test('daily reports SQL uses transactional, paired function tags',()=>{
  assert.match(sql,/^begin;/m);
  assert.match(sql,/^commit;/m);
  assert.equal(sql.split('$eg_report_save$').length-1,2);
  assert.equal(sql.split('$eg_report_review$').length-1,2);
  assert.doesNotMatch(sql,/\bas \$(?!\$|[a-zA-Z_])/);
});
test('only owner or reporting employee reads reports',()=>{
  assert.match(sql,/create policy eg_reports_select[\s\S]*?private\.eg_is_owner\(company_id\)/);
  assert.match(sql,/private\.eg_is_member\(company_id\) and created_by=\(select auth\.uid\(\)\)/);
  assert.match(sql,/create policy eg_report_events_select[\s\S]*?r\.created_by=\(select auth\.uid\(\)\)/);
});
test('direct report write permissions denied',()=>{
  assert.match(sql,/revoke all on public\.eg_daily_reports, public\.eg_daily_report_events from public, anon, authenticated;/);
  assert.match(sql,/grant select on public\.eg_daily_reports, public\.eg_daily_report_events to authenticated;/);
  assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.eg_daily_reports to authenticated/i);
});
test('RPCs validate actor ownership, assignment, and lock submitted reports',()=>{
  assert.match(sql,/v_task\.assignee_id <> v_uid/);
  assert.match(sql,/m\.role='worker' and m\.active/);
  assert.match(sql,/v_report\.created_by <> v_uid/);
  assert.match(sql,/v_report\.status not in \('draft','changes_requested'\)/);
  assert.match(sql,/not private\.eg_is_owner\(v_report\.company_id\)/);
  assert.match(sql,/v_report\.status <> 'submitted'/);
  assert.match(sql,/function public\.eg_save_daily_report/);
  assert.match(sql,/function public\.eg_review_daily_report/);
  assert.match(sql,/public\.eg_daily_report_events/);
});
test('daily reports are tied to tasks in the same company',()=>{
  assert.match(sql,/foreign key\(company_id,task_id\)[\s\S]*?references public\.eg_tasks\(company_id,id\)/);
  assert.match(sql,/unique\(task_id,created_by,work_date\)/);
});
function browserHarness(){
  const elements = {app:{innerHTML:''},'top-right':{innerHTML:''}};
  const context=createContext({
    window:{EASYGART_SUPABASE_CONFIG:{url:'https://example.supabase.co',publishableKey:'sb_publishable_testing'}},
    document:{getElementById:id=>elements[id]||null,addEventListener:()=>{},activeElement:null,visibilityState:'visible'},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    location:{origin:'https://easygarte.vercel.app',pathname:'/cloud/',href:'https://easygarte.vercel.app/cloud/'},
    console,Date,Intl,Number,String,Object,Math,Array
  });
  const withoutBoot=app.replace(/\brender\(\);\s*boot\(\);\s*$/,'');
  assert.ok(withoutBoot!==app,'test harness must suppress backend boot');
  runInContext(withoutBoot,context,{timeout:1000});
  runInContext([
    "user={id:'worker-a',email:'worker@example.test'};",
    "memberships=[{company_id:'org-1',role:'worker',active:true}];",
    "selectedCompanyId='org-1';",
    "companies=[{id:'org-1',name:'EasyGart Test'}];",
    "members=[{user_id:'owner',role:'owner',active:true,full_name:'Titolare'},{user_id:'worker-a',role:'worker',active:true,full_name:'Anna'},{user_id:'worker-b',role:'worker',active:true,full_name:'Marco'}];",
    "clients=[{id:'client-1',name:'Cliente di prova'}];",
    "sites=[{id:'site-1',client_id:'client-1',name:'Giardino test'}];",
    "tasks=[{id:'task-a',assignee_id:'worker-a',client_id:'client-1',site_id:'site-1',title:'Potatura',due_date:'2026-11-14'},{id:'task-b',assignee_id:'worker-b',client_id:'client-1',site_id:'site-1',title:'Irrigazione',due_date:'2026-11-14'}];",
    "dailyReports=[{id:'report-a',company_id:'org-1',task_id:'task-a',created_by:'worker-a',work_date:'2026-11-14',minutes_worked:130,work_summary:'Lavorazione potatura',materials_used:'Cesoie',issues:'',status:'draft',manager_feedback:'',created_at:'2026-11-14T10:00:00Z'},{id:'report-b',company_id:'org-1',task_id:'task-b',created_by:'worker-b',work_date:'2026-11-14',minutes_worked:190,work_summary:'Irrigazione completata',materials_used:'Tubi',issues:'',status:'submitted',manager_feedback:'',created_at:'2026-11-14T11:00:00Z'}];",
    "reportsReady=true;reportsSetupError='';currentView='reports';"
  ].join('\n'),context,{timeout:1000});
  return {context,exec:q=>runInContext(q,context,{timeout:1000})};
}
test('worker sees personal report and cannot approve colleagues reports',()=>{
  const h=browserHarness();
  const html=h.exec('reportsMarkup()');
  assert.match(html,/Lavorazione potatura/);
  assert.doesNotMatch(html,/Irrigazione completata/);
  assert.doesNotMatch(html,/data-form="daily-review"/);
  assert.match(html,/report-edit/);
  assert.match(h.exec("reportEditingId='new';reportFormMarkup()"),/data-form="daily-report"/);
});
test('manager sees incoming report and review actions',()=>{
  const h=browserHarness();
  const html=h.exec("user={id:'owner',email:'boss@example.test'};memberships=[{company_id:'org-1',role:'owner',active:true}];reportsMarkup()");
  assert.match(html,/Irrigazione completata/);
  assert.match(html,/Lavorazione potatura/);
  assert.match(html,/data-form="daily-review"/);
  assert.match(html,/value="approved"/);
  assert.match(html,/value="changes_requested"/);
});
test('report form supports drafts and submitted reports cannot be edited',()=>{
  const h=browserHarness();
  assert.match(h.exec("reportEditingId='report-a';reportFormMarkup()"),/value="send"/);
  h.exec("dailyReports[0].status='submitted'");
  assert.equal(h.exec("reportFormMarkup()"),'');
});
test('cloud client calls protected RPCs, not direct report writes',()=>{
  assert.match(app,/client\.rpc\('eg_save_daily_report'/);
  assert.match(app,/client\.rpc\('eg_review_daily_report'/);
  assert.doesNotMatch(app,/client\.from\('eg_daily_reports'\)\.insert/);
  assert.doesNotMatch(app,/client\.from\('eg_daily_reports'\)\.update/);
  assert.match(app,/reportEditingId===null && editingTaskId===null/);
});
test('missing migration does not prevent task module from loading',()=>{
  assert.match(app,/if\(reportResponse\.error\)\s*\{/);
  assert.match(app,/reportsReady=false;dailyReports=\[\]/);
});
