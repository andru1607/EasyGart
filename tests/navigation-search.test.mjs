import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const searchScript=read('cloud/search.js');
const appScript=read('cloud/app.js');
const css=read('cloud/premium.css');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const searchFactory=()=>{
 const sandbox={window:{}};
 runInNewContext(searchScript,sandbox);
 return sandbox.window.createEasyGartSearch;
};
const fixture=owner=>{
 const ctx={
  user:{id:'u1'},companyId:'c1',locale:'it',isOwner:owner,
  members:[{user_id:'u1',full_name:'Anna'},{user_id:'u2',full_name:'Paolo'}],
  tasks:[{id:'t1',title:'Potatura siepi',assignee_id:'u1',site_id:'s1'},
   {id:'t2',title:'Sistemare cancello',assignee_id:'u2',site_id:'s2'}],
  sites:[{id:'s1',name:'Villa Garda',address:'Via Lago 20'},{id:'s2',name:'Cantiere Nuovo',address:''}],
  clients:[{id:'cl1',name:'Famiglia Rossi',phone:'3331234567'}],
  reports:[{id:'r1',created_by:'u1',site_id:'s1',work_date:'2026-11-12',status:'draft',work_summary:'Pulizia aiuole'},
   {id:'r2',created_by:'u2',site_id:'s2',work_date:'2026-11-13',status:'draft',work_summary:'Bozza privata'},
   {id:'r3',created_by:'u2',site_id:'s1',work_date:'2026-11-14',status:'submitted',work_summary:'Potatura effettuata'}],
  materials:[{id:'m1',name:'Terriccio',unit:'kg',active:true}]
 };
 return {ctx,model:searchFactory()({getContext:()=>ctx,esc})};
};

test('persistent global search dock exists before primary navigation',()=>{
 assert.match(appScript,/app\.innerHTML = alert \+searchDockMarkup\(\)/);
 assert.match(appScript,/primaryNavigationMarkup\(\)\+moreMenuMarkup\(\)/);
 assert.match(css,/\.eg-search-dock\s*\{[^}]*position:sticky;top:0/);
 assert.match(appScript,/data-action="search-open"/);
});

test('role-oriented tabs retain personal attendance for delegated worker admins',()=>{
 assert.match(appScript,/const delegatedWorker=memberships\.some/);
 assert.match(appScript,/const owner=memberIsPrimaryOwner\(\)/);
 assert.match(appScript,/const tabs=owner&&!delegatedWorker/);
 assert.match(appScript,/\['clock','clock','clock'\]/);
 assert.match(appScript,/\['team','team','team'\]/);
});

test('worker search contains daily actions and consultations, not admin operations',()=>{
 const {model}=fixture(false);
 model.setQuery('timbrature');
 assert.ok(model.results().some(x=>x.id==='cmd:clock'));
 model.setQuery('rapporto');
 assert.ok(model.results().some(x=>x.id==='cmd:new-report'));
 model.setQuery('admin');
 assert.ok(!model.results().some(x=>x.id==='cmd:admin-delegate'));
 model.setQuery('terr');
 assert.ok(!model.results().some(x=>x.kind==='material'));
 model.setQuery('cancello');
 assert.ok(!model.results().some(x=>x.id==='task:t2'));
 model.setQuery('bozza privata');
 assert.ok(!model.results().some(x=>x.id==='report:r2'));
 model.setQuery('potatura effettuata');
 assert.ok(model.results().some(x=>x.id==='report:r3'));
});

test('owner search can directly reach edit, screenshot and management flows',()=>{
 const {model}=fixture(true);
 for(const [query,id] of [
  ['importa orari','cmd:import-hours'],
  ['importa clienti','cmd:import-clients'],
  ['permessi admin','cmd:admin-delegate'],
  ['squadra','cmd:team'],
  ['proforma','cmd:invoices'],
  ['modifica cantiere','cmd:edit-site'],
  ['sicurezza password','cmd:account-security'],
  ['installare','cmd:install'],
  ['aggiorna dati','cmd:reload']
 ]){
  model.setQuery(query);
  assert.ok(model.results().some(x=>x.id===id),query);
 }
 model.setQuery('terriccio');
 assert.ok(model.results().some(x=>x.id==='material:m1'));
 model.setQuery('famiglia rossi');
 assert.ok(model.results().some(x=>x.id==='client-edit:cl1'));
 model.setQuery('villa garda');
 assert.ok(model.results().some(x=>x.id==='site:s1'));
});
