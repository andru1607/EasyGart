'use strict';
// Test isolati della ricerca globale EasyGart. Node >=18, senza dipendenze.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../cloud/search.js'),'utf8');
const browser={};
vm.runInNewContext(source,{window:browser});
const factory=browser.createEasyGartSearch;
const escape=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const setup=()=>{
 const context={companyId:'co1',user:{id:'u1'},isOwner:false,locale:'it',
   tasks:[{id:'task1',title:'Potatura ulivi',instructions:'Giardino nord',assignee_id:'u1',
      site_id:'site1',client_id:'client1',due_date:'2026-11-25'},
     {id:'task2',title:'Pulizia siepi',assignee_id:'u2',site_id:'site1',client_id:'client1'}],
   sites:[{id:'site1',name:'Giardino Verona',client_id:'client1'}],
   clients:[{id:'client1',name:'Cliente Rossi'}],
   members:[{user_id:'u1',full_name:'Mario'},{user_id:'u2',full_name:'Luca'}],
   reports:[{id:'report1',created_by:'u1',work_date:'2026-11-22',site_id:'site1',work_summary:'Potatura alberi'},
     {id:'report2',created_by:'u2',work_date:'2026-11-22',site_id:'site1',work_summary:'Lavoro collega'}]};
 return {context,search:factory({getContext:()=>context,esc:escape})};
};
const find=(search,q)=>{search.setQuery(q);return search.results().map(x=>x.id)};
test('la ricerca si apre solo con un account aziendale',()=>{
 const {context,search}=setup();assert.equal(search.open(),true);
 assert.match(search.markup(),/eg-search-input/);search.close();
 context.companyId='';assert.equal(search.open(),false);
});
test('un dipendente vede solo le proprie attività e rapporti',()=>{
 const {search}=setup();search.open();
 assert.ok(find(search,'potatura').includes('task:task1'));
 assert.ok(!find(search,'pulizia').includes('task:task2'));
 assert.ok(!find(search,'lavoro collega').includes('report:report2'));
 assert.ok(!find(search,'nuovo cliente').includes('cmd:new-client'));
 assert.ok(find(search,'cancella ore').includes('cmd:delete-shift'));
});
test('il titolare cerca attività, clienti e operazioni aziendali',()=>{
 const {context,search}=setup();context.isOwner=true;search.open();
 assert.ok(find(search,'pulizia').includes('task:task2'));
 assert.ok(find(search,'nuovo cliente').includes('cmd:new-client'));
 assert.ok(find(search,'cliente rossi').includes('client:client1'));
 assert.ok(find(search,'materiali').includes('cmd:materials'));
});
test('la ricerca è bilingue e protegge il testo restituito',()=>{
 const {context,search}=setup();context.locale='de';search.open();
 assert.ok(find(search,'Aufgabe').includes('cmd:tasks'));
 context.tasks[0].title='<img src=x onerror=alert(1)>';
 search.setQuery('img');
 const html=search.resultsMarkup();
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
});
