import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
const manifest=JSON.parse(readFileSync(new URL('../cloud/manifest.webmanifest',import.meta.url),'utf8'));
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../cloud/sw.js',import.meta.url),'utf8');
const mobile=readFileSync(new URL('../cloud/mobile.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
function parsePng(name,expected){
  const buf=readFileSync(new URL('../cloud/'+name,import.meta.url));
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG magic '+name);
  assert.equal(buf.readUInt32BE(16),expected,'Width of '+name);
  assert.equal(buf.readUInt32BE(20),expected,'Height of '+name);
  assert.equal(buf[24],8,'Indexed image expected');
  const data=[];
  for(let off=8;off<buf.length;){
    const len=buf.readUInt32BE(off),type=buf.subarray(off+4,off+8).toString();
    if(type==='IDAT')data.push(buf.subarray(off+8,off+8+len));
    off+=12+len;
  }
  const decoded=inflateSync(Buffer.concat(data));
  assert.equal(decoded.length,expected*(expected+1));
}
test('Home Screen icons are real, decodable PNGs for iOS and Android',()=>{
  parsePng('icon-192.png',192);
  parsePng('icon-512.png',512);
  parsePng('apple-touch-icon.png',180);
  assert.match(html,/apple-touch-icon" sizes="180x180"/);
});
test('PWA manifest is installable under the correct scope',()=>{
  assert.equal(manifest.id,'/cloud/');
  assert.equal(manifest.start_url,'/cloud/');
  assert.equal(manifest.scope,'/cloud/');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.theme_color,'#183d30');
  assert.ok(manifest.icons.some(x=>x.sizes==='192x192'&&x.type==='image/png'));
  assert.ok(manifest.icons.some(x=>x.sizes==='512x512'&&x.type==='image/png'));
  assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html,/apple-mobile-web-app-capable/);
});
test('offline service worker stores only a fixed, non-sensitive app shell',()=>{
  assert.match(sw,/const SHELL=\[/);
  assert.match(sw,/req\.method!=='GET'/);
  assert.match(sw,/url\.origin!==self\.location\.origin/);
  assert.match(sw,/!SHELL\.includes\(url\.pathname\)/);
  assert.doesNotMatch(sw,/supabase\.co|localStorage|eg_daily_reports|storage\/v1|rest\/v1|sessionStorage/);
  assert.match(sw,/caches\.open\(VERSION\)/);
});
test('network status and installation workflow support iPhone and Android',()=>{
  assert.match(mobile,/beforeinstallprompt/);
  assert.match(mobile,/navigator\.serviceWorker\.register\('\/cloud\/sw\.js'/);
  assert.match(mobile,/window\.addEventListener\('offline'/);
  assert.match(mobile,/window\.addEventListener\('online'/);
  assert.match(mobile,/display-mode: standalone/);
  assert.match(app,/data-action="install"/);
  assert.match(app,/Aggiungi alla schermata Home/);
  assert.match(app,/App installieren/);
});
test('automatic Cloud refresh pauses while offline',()=>{
 assert.match(app,/document\.visibilityState==='visible' && navigator\.onLine!==false/);
});
test('offline warning follows language changes while already offline',()=>{
 assert.match(mobile,/updateNetworkText:showNetwork/);
 assert.match(app,/window\.EASYGART_INSTALL\?\.updateNetworkText\?\.\(\)/);
 assert.match(mobile,/document\.documentElement\.lang==='de'/);
});
test('printing proforma hides private app UI and prints only draft body',()=>{
  assert.match(html,/@media print/);
  assert.match(html,/#eg-print-zone/);
  assert.match(html,/body>header,body>main,body>footer/);
  assert.match(html,/eg-invoice-total/);
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/input,select,textarea\{font-size:16px\}/);
});
test('session-only drafts exclude credentials, photo uploads and signatures',()=>{
  assert.match(app,/const DRAFT_FORMS=new Set/);
  assert.match(app,/const DRAFT_TTL=24\*60\*60\*1000/);
  assert.ok(app.includes("!['hidden','password','email','file','radio'].includes(el.type)"));
  assert.match(app,/sessionStorage\.setItem\(key/);
  assert.match(app,/restoreSessionDrafts\(\)/);
  assert.match(app,/clearAccountDrafts\(\)/);
  assert.doesNotMatch(app,/DRAFT_FORMS=new Set\(\[[^\]]*'auth'/);
});

test('offline mode prevents writes without dropping typed data',()=>{
 assert.match(app,/navigator\.onLine===false/);
 assert.match(app,/saveSessionDraft\(form\)/);
 assert.match(app,/Connessione assente\. Riprova quando torni online/);
 assert.match(app,/Keine Internetverbindung\. Bitte versuche es online erneut/);
 assert.match(app,/if\(a==='ops-clock'&&typeof navigator/);
 assert.match(app,/if\(e\.target\.dataset\.opsInput\)/);
 assert.match(app,/input\.type!=='file'&&input\.type!=='password'/);
});
