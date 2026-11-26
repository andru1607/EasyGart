import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';

const source=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const noBoot=source.replace(/(?:\brender\(\);\s*)?\bboot\(\);\s*$/,'');
assert.notEqual(noBoot,source,'Expected removable app boot footer');
function harness(hash=''){
  const elements={app:{innerHTML:''},'top-right':{innerHTML:''}};
  const document={
    documentElement:{lang:'it'},getElementById:id=>elements[id]||null,
    querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener:()=>{},activeElement:null,visibilityState:'visible'
  };
  const events=[];
  const auth={
    resetPasswordForEmail:async(email,options)=>{
      events.push({action:'reset',email,options});return {data:{},error:null};
    },
    updateUser:async(payload)=>{events.push({action:'update',payload});return {data:{},error:null}},
    signOut:async(options)=>{events.push({action:'signout',options});return {data:{},error:null}}
  };
  class FakeFormData {
    constructor(form){return Object.entries(form.values||{})[Symbol.iterator]()}
  }
  const location={origin:'https://easygarte.vercel.app',pathname:'/cloud/',href:'https://easygarte.vercel.app/cloud/',
    hash,search:''};
  const context=createContext({window:{EASYGART_SUPABASE_CONFIG:{
    url:'https://example.supabase.co',publishableKey:'sb_publishable_test'}},
    document,location,localStorage:{getItem:()=>null,setItem:()=>{}},
    FormData:FakeFormData,Date,Intl,Number,String,Math,Array,Set,Map,console});
  new Script(noBoot).runInContext(context,{timeout:1500});
  const run=script=>runInContext(script,context,{timeout:1500});
  context.testAuth=auth;
  run('client={auth:testAuth}');
  return {run,context,elements,events};
}
test('forgot password is available without authentication, translated into German',()=>{
  const h=harness();
  h.run("authMode='forgot';locale='de';render()");
  const ui=h.elements.app.innerHTML;
  assert.match(ui,/Passwort zurücksetzen/);
  assert.match(ui,/data-form="password-request"/);
  assert.match(ui,/Wiederherstellungslink senden/);
  assert.doesNotMatch(ui,/name="password"/);
  assert.match(ui,/Zurück zur Anmeldung/);
});
test('password reset screen requires authenticated session and does not reveal company data',()=>{
  const h=harness();
  h.run("authMode='reset';user={id:'owner1',email:'owner@example.test'};render()");
  const ui=h.elements.app.innerHTML;
  assert.match(ui,/data-form="password-update"/);
  assert.match(ui,/autocomplete="new-password"/);
  assert.match(ui,/name="confirm_password"/);
  assert.doesNotMatch(ui,/data-view="tasks"|data-view="team"/);
});
test('password reset email uses fixed EasyGart redirect and generic response',async()=>{
  const h=harness();
  h.run("authMode='forgot'");
  h.context.testForm={dataset:{form:'password-request'},values:{email:' SOMEONE@EXAMPLE.TEST '}};
  await h.run('submitForm(testForm)');
  assert.deepEqual(JSON.parse(JSON.stringify(h.events[0])),{action:'reset',email:'someone@example.test',
    options:{redirectTo:'https://easygarte.vercel.app/cloud/'}});
  assert.equal(h.run('authMode'),'signin');
  assert.match(h.elements.app.innerHTML,/Se l’indirizzo è registrato/);
});
test('password update rejects short or mismatched passwords without contacting Supabase',async()=>{
  const h=harness();
  h.run("user={id:'owner1'};authMode='reset'");
  h.context.testForm={dataset:{form:'password-update'},values:{password:'short',confirm_password:'short'}};
  await assert.rejects(h.run('submitForm(testForm)'),/almeno 12/);
  h.context.testForm.values={password:'very-long-secret-password',confirm_password:'different-secret-password'};
  await assert.rejects(h.run('submitForm(testForm)'),/non coincidono/);
  assert.equal(h.events.length,0);
});
test('successful password change signs out locally and clears app state',async()=>{
  const h=harness();
  h.run("user={id:'owner1'};authMode='reset';memberships=[{company_id:'org',role:'owner'}];companies=[{id:'org',name:'Private'}]");
  h.context.testForm={dataset:{form:'password-update'},values:{
    password:'a-strong-password-1234',confirm_password:'a-strong-password-1234'}};
  await h.run('submitForm(testForm)');
  assert.deepEqual(h.events.map(x=>x.action),['update','signout']);
  assert.equal(h.events[1].options.scope,'global');
  assert.equal(h.run('user'),null);
  assert.equal(h.run('authMode'),'signin');
  assert.equal(h.run('companies.length'),0);
  assert.doesNotMatch(h.elements.app.innerHTML,/Private/);
  assert.match(h.elements.app.innerHTML,/Accedi/);
});
test('password recovery is recognized before Supabase clears URL fragment',()=>{
  const h=harness('#access_token=example&type=recovery');
  assert.equal(h.run('recoveryLinkOpened'),true);
  assert.match(source,/ev==='PASSWORD_RECOVERY'/);
  assert.match(source,/if\(user && authMode!=='reset' && document\.visibilityState/);
  assert.match(source,/if\(recoveryLinkOpened\)\{authMode='reset'/);
  assert.match(source,/client\.auth\.updateUser\(\{password\}\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^)]*password/);
});
