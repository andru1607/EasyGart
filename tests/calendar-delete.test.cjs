'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../cloud/calendar.js'),'utf8');
const sandbox={window:{},Date};
vm.runInNewContext(source,sandbox);
const makeCalendar=sandbox.window.createEasyGartCalendar;
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
const reports=[
 {id:'r1',task_id:'t1',site_id:'site1',created_by:'u1',work_date:'2026-10-05',
  work_start_time:'08:00:00',work_end_time:'16:00:00',break_minutes:30,
  minutes_worked:450,work_summary:'Lavoro uno',status:'submitted',invoice_locked:false},
 {id:'r2',task_id:'t1',site_id:'site1',created_by:'u2',work_date:'2026-10-05',
  minutes_worked:120,work_summary:'Lavoro collega',invoice_locked:false}
];
const shifts=[
 {id:'s1',company_id:'co1',user_id:'u1',site_id:'site1',status:'closed',
  started_at:'2026-10-05T08:00:00Z',ended_at:'2026-10-05T14:00:00Z',break_seconds:0},
 {id:'s2',company_id:'co1',user_id:'u2',site_id:'site1',status:'closed',
  started_at:'2026-10-05T08:00:00Z',ended_at:'2026-10-05T11:00:00Z',break_seconds:0}
];
const fakeClient={from:table=>{
 const data=table==='eg_daily_reports'?reports:shifts;
 return {select(){return this},eq(){return this},gte(){return this},
   lt(){return this},order(){return this},async range(){return {data,error:null}}};
}};
function fixture(mode,owner=false){
 const ctx={locale:'it',isOwner:owner,user:{id:'u1'},
  members:[{user_id:'u1',full_name:'Elena'},{user_id:'u2',full_name:'Davide'}],
  sites:[{id:'site1',name:'Prato Nord'}],tasks:[{id:'t1',site_id:'site1',title:'Taglio erba'}]};
 const calendar=makeCalendar({client:fakeClient,getContext:()=>ctx,esc,rerender:()=>{},mode});
 calendar.setSelection({year:2026,month:9,chosen:'2026-10-05',worker:'all'});
 return calendar;
}
for(const mode of ['hours','work']){
 test('calendario '+mode+': dipendente gestisce solo orari propri del passato',async()=>{
  const calendar=fixture(mode);
  await calendar.refresh('co1');
  const html=calendar.markup();
  assert.match(html,/data-action="cal-delete-shift" data-id="s1"/);
  assert.match(html,/data-action="cal-edit-hours" data-id="r1"/);
  assert.match(html,/data-action="cal-delete-report" data-id="r1"/);
  assert.doesNotMatch(html,/data-action="cal-delete-shift" data-id="s2"/);
  assert.doesNotMatch(html,/data-action="cal-delete-report" data-id="r2"/);
 });
 test('calendario '+mode+': titolare vede i comandi per tutta la squadra',async()=>{
  const calendar=fixture(mode,true);
  await calendar.refresh('co1');
  const html=calendar.markup();
  assert.match(html,/data-action="cal-delete-shift" data-id="s2"/);
  assert.match(html,/data-action="cal-delete-report" data-id="r2"/);
 });
}

for(const mode of ['hours','work']){
 test('calendario '+mode+': titolare distingue ore personali, dipendente e squadra',async()=>{
  const calendar=fixture(mode,true);
  calendar.setSelection({year:2026,month:9,chosen:'2026-10-05',worker:'self'});
  await calendar.refresh('co1');
  let html=calendar.markup();
  assert.match(html,/value="self" selected/);
  assert.match(html,/data-id="s1"/);
  assert.doesNotMatch(html,/data-id="s2"/);
  assert.match(html,/6 h 00 min/);
  calendar.handleChange({id:'eg-calendar-worker',value:'u2'});
  html=calendar.markup();
  assert.match(html,/value="u2" selected/);
  assert.match(html,/data-id="s2"/);
  assert.doesNotMatch(html,/data-id="s1"/);
  assert.match(html,/3 h 00 min/);
  calendar.handleChange({id:'eg-calendar-worker',value:'all'});
  html=calendar.markup();
  assert.match(html,/value="all" selected/);
  assert.match(html,/data-id="s1"/);
  assert.match(html,/data-id="s2"/);
  assert.match(html,/9 h 00 min/);
  calendar.setSelection({...calendar.getSelection(),worker:'unknown'});
  assert.equal(calendar.getSelection().worker,'self');
 });
 test('calendario '+mode+': dipendente non può cambiare persona',async()=>{
  const calendar=fixture(mode);
  calendar.setSelection({...calendar.getSelection(),worker:'u2'});
  await calendar.refresh('co1');
  assert.equal(calendar.getSelection().worker,'self');
  assert.doesNotMatch(calendar.markup(),/data-id="s2"/);
 });
}
test('la selezione personale si conserva passando tra calendari',()=>{
 const hours=fixture('hours',true),work=fixture('work',true);
 hours.handleChange({id:'eg-calendar-worker',value:'self'});
 work.setSelection(hours.getSelection());
 assert.equal(work.getSelection().worker,'self');
 hours.reset();
 assert.equal(hours.getSelection().worker,'self');
});
