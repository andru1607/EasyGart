import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const cloud=config.headers.find(x=>x.source==='/cloud/(.*)');
const get=(route,key)=>config.headers.find(x=>x.source===route)?.headers.find(h=>h.key===key)?.value;
const h=key=>cloud.headers.find(x=>x.key===key)?.value;
test('Cloud security headers protect PWA without blocking private Supabase API',()=>{
 assert.ok(cloud);
 const csp=h('Content-Security-Policy');
 for(const directive of ["default-src 'self'","script-src 'self' https://esm.sh",
   "connect-src 'self' https://xdwsqkteykjjpzogwocx.supabase.co",
   "wss://xdwsqkteykjjpzogwocx.supabase.co","frame-ancestors 'none'",
   "object-src 'none'","worker-src 'self'","img-src 'self' blob: data:"]){
   assert.ok(csp.includes(directive),'CSP missing '+directive);
 }
 assert.ok(!csp.includes("'unsafe-eval'"));
 assert.ok(!csp.includes('https:;'));
 assert.equal(h('X-Content-Type-Options'),'nosniff');
 assert.equal(h('X-Frame-Options'),'DENY');
 assert.equal(h('Referrer-Policy'),'no-referrer');
 assert.match(h('Permissions-Policy'),/geolocation=\(\)/);
});
test('service worker and Cloud shell refresh without storing private responses',()=>{
 assert.match(get('/cloud/sw.js','Cache-Control'),/must-revalidate/);
 assert.match(get('/cloud/','Cache-Control'),/must-revalidate/);
 assert.match(get('/cloud/index.html','Cache-Control'),/must-revalidate/);
 assert.match(h('X-Robots-Tag'),/noindex/);
});
