import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';

const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const eod=readFileSync(new URL('../cloud/eod.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const sourceWithoutBoot=app.replace(/\brender\(\);\s*boot\(\);\s*$/,'');
assert.notEqual(sourceWithoutBoot,app,'Remove automatic boot for isolated translation tests');

function makeHarness(){
  const elements={app:{innerHTML:''},'top-right':{innerHTML:''}};
  const header={textContent:''},footer={textContent:''};
  const document={
    documentElement:{lang:'it'},
    getElementById:id=>elements[id]||null,
    querySelector:selector=>selector==='.top-sub'?header:selector==='footer.footer'?footer:null,
    querySelectorAll:()=>[],
    addEventListener:()=>{},
    visibilityState:'visible',
    activeElement:null,
  };
  const context=createContext({
    window:{EASYGART_SUPABASE_CONFIG:{url:'https://example.supabase.co',publishableKey:'sb_publishable_testing'}},
    document,localStorage:{getItem:()=>null,setItem:()=>{}},
    location:{origin:'https://easygarte.vercel.app',pathname:'/cloud/',href:'https://easygarte.vercel.app/cloud/'},
    Date,Intl,Number,String,Math,Array,Set,Map,console
  });
  new Script(sourceWithoutBoot).runInContext(context,{timeout:2000});
  const exec=(str)=>runInContext(str,context,{timeout:2000});
  exec("locale='de'");
  exec([
    "user={id:'owner',email:'owner@example.test'}",
    "memberships=[{company_id:'org-1',role:'owner',active:true}]",
    "selectedCompanyId='org-1'",
    "companies=[{id:'org-1',name:'Musterbetrieb'}]",
    "members=[{user_id:'owner',role:'owner',active:true,full_name:'Betriebsleitung'},{user_id:'worker',role:'worker',active:true,full_name:'Max Muster'}]",
    "clients=[{id:'client-1',name:'Beispielkunde'}]",
    "sites=[{id:'site-1',client_id:'client-1',name:'Testgelände'}]",
    "tasks=[{id:'task-1',assignee_id:'worker',client_id:'client-1',site_id:'site-1',title:'Rasenpflege',due_date:'2026-11-15',priority:'media',status:'assigned',instructions:'Gras pflegen',created_at:'2026-11-15T12:00:00Z'}]",
    "dailyReports=[{id:'report-1',company_id:'org-1',task_id:'task-1',created_by:'worker',work_date:'2026-11-15',minutes_worked:120,work_summary:'Rasen vollständig gepflegt',materials_used:'Grasgeräte',issues:'',status:'submitted',manager_feedback:'',created_at:'2026-11-15T12:00:00Z'}]",
    "reportsReady=true;reportsSetupError='';currentView='tasks';"
  ].join(';\n'));
  return {exec,elements,header,footer,document};
}

test('every literal t()/tr() UI label has a German translation',()=>{
  const h=makeHarness();
  const german=h.exec('german');
  const code=app.slice(app.indexOf('const tr = s =>'));
  const found=[...code.matchAll(/\b(?:t|tr)\((?:'([^']+)'|"([^"]+)")\)/g)]
    .map(m=>m[1]??m[2]);
  const missing=[...new Set(found)].filter(k=>!Object.hasOwn(german,k));
  assert.deepEqual(missing,[],'Missing translations: '+missing.join(', '));
  assert.ok(Object.keys(german).length>=180,'Dictionary must cover all app sections');
});

test('German user-facing copy is translated in every major view',()=>{
  const h=makeHarness();
  const scenarios=[
    ['Anmeldung',"user=null;memberships=[];authMode='signin';render();"],
    ['Registrierung',"authMode='signup';render();"],
    ['Onboarding',"user={id:'owner',email:'owner@example.test'};memberships=[];render();"],
    ['Aufgaben',"memberships=[{company_id:'org-1',role:'owner',active:true}];currentView='tasks';render();"],
    ['Aufgabe zuweisen',"editingTaskId='new';render();"],
    ['Tagesberichte Leitung',"editingTaskId=null;currentView='reports';render();"],
    ['Kunden',"currentView='clients';render();"],
    ['Team',"currentView='team';render();"],
    ['Tagesberichte Mitarbeiter',"user={id:'worker',email:'worker@example.test'};memberships=[{company_id:'org-1',role:'worker',active:true}];currentView='reports';render();"],
    ['Tagesbericht erstellen',"reportEditingId='new';render();"],
  ];
  const missing=[];
  const german=h.exec('german');
  const terms=Object.keys(german).filter(k=>k.length>=8 && k!==german[k] && !/^(?:EasyGart|Report-ID)/i.test(k));
  for(const [name,command] of scenarios){
    h.exec(command);
    const markup=h.elements.app.innerHTML;
    const text=markup.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
    const leaked=terms.filter(term=>text.includes(term));
    if(leaked.length)missing.push({name,leaked});
  }
  assert.deepEqual(missing,[],'Italian UI leaks: '+JSON.stringify(missing));
});

test('specific formerly mixed-language copy is fully translated',()=>{
  const h=makeHarness();
  h.exec("currentView='reports';render()");
  assert.match(h.elements.app.innerHTML,/Prüfe die ausgeführten Arbeiten vor Ort/);
  assert.doesNotMatch(h.elements.app.innerHTML,/Controlla quanto svolto/);
  h.exec("currentView='team';render()");
  assert.match(h.elements.app.innerHTML,/Gib die E-Mail-Adresse des Mitarbeiters ein/);
  assert.match(h.elements.app.innerHTML,/Zugangslink:/);
  assert.match(h.elements.app.innerHTML,/Betriebsinhaber/);
  assert.doesNotMatch(h.elements.app.innerHTML,/Inserisci l’email/);
  assert.doesNotMatch(h.elements.app.innerHTML,/>Titolare</);
});

test('editable placeholders and status labels are localized',()=>{
  const h=makeHarness();
  const sandbox=createContext({window:{},Date,Intl});
  new Script(eod).runInContext(sandbox);
  const model=sandbox.window.createEasyGartEndOfDay({client:{},esc:x=>String(x??''),getContext:()=>({locale:'de',user:{id:'worker'},isOwner:false,members:[],sites:[{id:'s',name:'Garten'}],clients:[],tasks:[],reports:[]})});
  const x=model.markup();
  assert.match(x,/Hecken geschnitten/);
  assert.match(x,/Verwendete Materialien/);
  assert.match(x,/name="issues"/);
  assert.match(x,/Bericht senden/);
  assert.doesNotMatch(x,/placeholder="(?:Descrivi|Tipi e quantità|Anomalie)/);
});

test('language switch updates header/footer, HTML lang and preserves user data',()=>{
  const h=makeHarness();
  h.exec("currentView='tasks';render()");
  assert.equal(h.document.documentElement.lang,'de');
  assert.match(h.header.textContent,/Benutzerkonten und Aufgaben/);
  assert.match(h.footer.textContent,/keine Echtdaten/);
  h.exec("tasks[0].title='Cantiere';render()");
  assert.match(h.elements.app.innerHTML,/>Cantiere</);
  h.exec("locale='it';render()");
  assert.equal(h.document.documentElement.lang,'it');
  assert.match(h.header.textContent,/account e incarichi/);
});

test('date labels adapt to German conventions without modifying date input values',()=>{
  const h=makeHarness();
  assert.equal(h.exec("displayDate('2026-11-15')"),'15.11.2026');
  h.exec("currentView='tasks';render()");
  assert.match(h.elements.app.innerHTML,/15\.11\.2026/);
  h.exec("locale='it'");
  assert.equal(h.exec("displayDate('2026-11-15')"),'15/11/2026');
  assert.equal(h.exec("dateToday().length"),10);
});

test('German missing-migration error avoids untranslated database details',()=>{
  const h=makeHarness();
  h.exec("currentView='reports';reportsReady=false;reportsSetupError='Could not find eg_daily_reports in the schema cache';render()");
  const output=h.elements.app.innerHTML;
  assert.match(output,/Die Tagesberichte sind in der Datenbank noch nicht aktiviert/);
  assert.match(output,/Tabellen für Tagesberichte nicht verfügbar/);
  assert.doesNotMatch(output,/La funzione rapporti|Could not find/);
});

test('errors and success messages are mapped to German',()=>{
  const h=makeHarness();
  assert.equal(h.exec("tr('Invito registrato. Condividi il link del portale con il dipendente.')"),
    'Einladung gespeichert. Teile den Portal-Link mit dem Mitarbeiter.');
  assert.equal(h.exec("tr(errorMessage({message:'Invalid login credentials'}))"),
    'Ungültige E-Mail-Adresse oder ungültiges Passwort.');
  assert.equal(h.exec("tr(errorMessage({message:'Unrecognized server issue'}))"),
    'Der Vorgang konnte nicht abgeschlossen werden. Bitte versuche es erneut oder lade die Seite neu.');
});

test('unfinished daily report survives a failed server operation',()=>{
  const h=makeHarness();
  const oldInput={name:'work_summary',value:'Wichtige Arbeit, noch nicht gespeichert',type:'textarea',checked:false};
  const newInput={name:'work_summary',value:'',type:'textarea',checked:false};
  const makeForm=input=>({
    dataset:{form:'daily-report'},
    querySelectorAll:()=>[input]
  });
  let current=makeForm(oldInput);
  const next=makeForm(newInput);
  h.document.querySelectorAll=selector=>selector==='form[data-form]'?[current]:[];
  let html='';
  Object.defineProperty(h.elements.app,'innerHTML',{
    get(){return html},
    set(value){html=value;current=next}
  });
  h.exec("fail({message:'Invalid login credentials'})");
  assert.equal(newInput.value,oldInput.value);
  assert.match(html,/Ungültige E-Mail-Adresse/);
});

test('responsive CSS supports longer German labels and avoids single-line nav',()=>{
  assert.match(html,/@media\(max-width:760px\)/);
  assert.match(html,/\.nav\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html,/overflow-wrap:anywhere;white-space:normal/);
  assert.match(html,/#top-right\{display:grid;grid-template-columns:76px minmax\(0,1fr\) auto/);
  assert.match(app,/function renderPreservingForms\(/);
  assert.match(app,/if\(e\.target\.id==='locale'\).*renderPreservingForms\(\)/);
});

test('translated labels are escaped and user data remain separated',()=>{
  assert.match(app,/const t = s => esc\(tr\(s\)\)/);
  assert.match(app,/esc\(task\.title\)/);
  assert.match(app,/esc\(report\.work_summary/);
  assert.match(app,/esc\(m\.full_name/);
});
