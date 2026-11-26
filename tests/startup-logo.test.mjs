import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../cloud/sw.js',import.meta.url),'utf8');
test('startup uses standalone transparent logo, not app icon',()=>{
 const img=html.match(/<img class="eg-startup-logo"[^>]*>/)?.[0];
 assert.ok(img);
 assert.match(img,/src="\.\/logo\.png"/);
 assert.doesNotMatch(img,/icon-512/);
 const style=html.match(/\.eg-startup-logo\{([^}]+)\}/)?.[1];
 assert.match(style,/background:transparent/);
 assert.doesNotMatch(style,/mix-blend-mode/);
 assert.ok(sw.includes("'/cloud/logo.png'"));
 const splash=html.match(/#eg-startup\{[^}]*background:(#[a-f0-9]+)/)?.[1];
 const body=html.match(/body\.eg-starting\{[^}]*background:(#[a-f0-9]+)/)?.[1];
 assert.ok(splash);
 assert.equal(body,splash);
});
