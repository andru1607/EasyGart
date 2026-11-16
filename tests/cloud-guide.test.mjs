import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const guide=readFileSync(new URL('../cloud/guide.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../cloud/guide.css',import.meta.url),'utf8');
const shell=readFileSync(new URL('../cloud/sw.js',import.meta.url),'utf8');

function harness(){
  const listeners={},storage=new Map(),classes=new Set();
  const focus={isConnected:true,focus(){}};
  const root={
    innerHTML:'',
    contains:()=>true,
    querySelector:()=>focus,
    querySelectorAll:()=>[focus]
  };
  const document={
    activeElement:focus,
    body:{classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}},
    getElementById:id=>id==='eg-guide-root'?root:null,
    addEventListener:(type,fn)=>{listeners[type]=fn}
  };
  const localStorage={
    getItem:key=>storage.has(key)?storage.get(key):null,
    setItem:(key,value)=>{storage.set(key,value)}
  };
  const window={};
  new Script(guide).runInContext(createContext({window,document,localStorage}),{timeout:1500});
  const fire=(action,data={})=>{
    const b={dataset:{egGuide:action,...data}};
    b.closest=()=>b;
    listeners.click({target:b});
  };
  return {window,root,storage,classes,fire,listeners};
}
const info=(userId,role,companyId='',extra={})=>({
  active:true,userId,role,companyId,locale:'it',...extra
});

test('guide and application JavaScript parse without syntax errors',()=>{
  new Script(guide);
  new Script(app);
});

test('new user sees a short first-login guide exactly once in the same browser',()=>{
  const h=harness();
  h.window.EASYGART_GUIDE.sync(info('user-1','setup'));
  assert.match(h.root.innerHTML,/Benvenuto in EasyGart/);
  assert.match(h.root.innerHTML,/1 \/ 3/);
  assert.match(h.root.innerHTML,/aria-modal="true"/);
  h.fire('skip');
  assert.equal(h.storage.get('easygart-guide-v1:user-1:setup'),'done');
  assert.equal(h.root.innerHTML,'');
  h.window.EASYGART_GUIDE.sync({active:false,userId:''});
  h.window.EASYGART_GUIDE.sync(info('user-1','setup'));
  assert.equal(h.root.innerHTML,'','completed guide must not re-open');
  h.window.EASYGART_GUIDE.open();
  assert.match(h.root.innerHTML,/Benvenuto in EasyGart/,'manual replay remains available');
});

test('company creation triggers the owner tour even after generic onboarding was skipped',()=>{
  const h=harness();
  h.window.EASYGART_GUIDE.sync(info('user-2','setup'));
  h.fire('skip');
  h.window.EASYGART_GUIDE.sync(info('user-2','owner','company-a'));
  assert.match(h.root.innerHTML,/Il pannello del titolare/);
  assert.match(h.root.innerHTML,/1 \/ 16/);
  assert.match(h.root.innerHTML,/Clienti e cantieri/);
  assert.match(h.root.innerHTML,/Bozze proforma/);
  h.fire('finish');
  assert.equal(h.storage.get('easygart-guide-v1:user-2:company-a'),'done');
  h.window.EASYGART_GUIDE.sync(info('user-2','owner','company-b'));
  assert.match(h.root.innerHTML,/Il pannello del titolare/,'new company has its own first-run guide');
});

test('worker tour is shorter and does not expose owner-only sections',()=>{
  const h=harness();
  h.window.EASYGART_GUIDE.sync(info('worker-1','worker','company-a'));
  assert.match(h.root.innerHTML,/1 \/ 11/);
  assert.match(h.root.innerHTML,/Timbrature e pause/);
  assert.doesNotMatch(h.root.innerHTML,/Bozze proforma|Catalogo dei materiali|Squadra e inviti/);
  assert.match(h.root.innerHTML,/Registrare il materiale usato/);
});

test('language switching changes guide text and delegates app locale update',()=>{
  const h=harness();
  let newLocale='';
  h.window.EASYGART_GUIDE.sync(info('user-3','worker','company-a',{
    onLocale:locale=>{newLocale=locale}
  }));
  h.fire('locale',{language:'de'});
  assert.equal(newLocale,'de');
  assert.match(h.root.innerHTML,/Funktionsanleitung/);
  assert.match(h.root.innerHTML,/Dein Arbeitsbereich/);
  assert.doesNotMatch(h.root.innerHTML,/Il tuo spazio di lavoro/);
});

test('navigation only links to authorized chapters and marks viewed guide complete',()=>{
  const h=harness();
  const destinations=[];
  h.window.EASYGART_GUIDE.sync(info('user-4','owner','company-a',{
    onNavigate:view=>destinations.push(view)
  }));
  h.fire('goto',{index:'2'});
  assert.match(h.root.innerHTML,/Squadra e inviti/);
  h.fire('visit',{guideView:'team'});
  assert.deepEqual(destinations,['team']);
  assert.equal(h.root.innerHTML,'');
  assert.equal(h.storage.get('easygart-guide-v1:user-4:company-a'),'done');
  h.window.EASYGART_GUIDE.open();
  h.fire('visit',{guideView:'invoices'});
  assert.deepEqual(destinations,['team'],'unrelated destination must be rejected');
});

test('escape closes tour without locking scrolling',()=>{
  const h=harness();
  h.window.EASYGART_GUIDE.sync(info('user-5','worker','company-a'));
  assert.ok(h.classes.has('eg-guide-lock'));
  let prevented=false;
  h.listeners.keydown({key:'Escape',preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(h.root.innerHTML,'');
  assert.ok(!h.classes.has('eg-guide-lock'));
});

test('the cloud shell loads the guide before the app and offers a replay action',()=>{
  assert.match(html,/id="eg-guide-root"/);
  assert.ok(html.indexOf('guide.js')<html.indexOf('app.js'));
  assert.match(html,/guide\.css/);
  assert.match(app,/EASYGART_GUIDE\?\.sync/);
  assert.match(app,/data-action="guide-open"/);
  assert.match(app,/if\(a==='guide-open'\)/);
  assert.match(app,/localeKey/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(shell,/\/cloud\/guide\.js/);
  assert.match(shell,/\/cloud\/guide\.css/);
});
