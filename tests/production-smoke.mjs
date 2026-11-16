// Read-only production smoke. No credentials, customer data or mutations.
import assert from 'node:assert/strict';
const origin=(process.env.EASYGART_URL||'https://easygarte.vercel.app').replace(/\/+$/,'');
assert.match(origin,/^https:\/\//,'Production smoke must use HTTPS');
const get=async(path)=>{
 const response=await fetch(origin+path,{
  redirect:'manual',headers:{'cache-control':'no-cache','user-agent':'EasyGart-Production-Smoke/1.0'},
  signal:AbortSignal.timeout(12000)
 });
 assert.equal(response.status,200,path+' returned HTTP '+response.status);
 return {response,text:await response.text()};
};
async function check(){
 const page=await get('/cloud/');
 const csp=page.response.headers.get('content-security-policy')||'';
 for(const directive of ["default-src 'self'","frame-ancestors 'none'",
  "object-src 'none'","script-src 'self' https://esm.sh",
  "connect-src 'self' https://xdwsqkteykjjpzogwocx.supabase.co"]){
   assert.ok(csp.includes(directive),'Missing deployed CSP directive: '+directive);
 }
 assert.equal(page.response.headers.get('x-frame-options'),'DENY');
 assert.equal(page.response.headers.get('referrer-policy'),'no-referrer');
 assert.match(page.text,/EasyGart Cloud/);
 assert.match(page.text,/app\.js\?v=20261116-rc2-auth/);
 const app=await get('/cloud/app.js');
 assert.match(app.text,/PASSWORD_RECOVERY/);
 assert.match(app.text,/resetPasswordForEmail/);
 const sw=await get('/cloud/sw.js');
 assert.match(sw.text,/easygart-shell-v5-20261116-rc2/);
 assert.doesNotMatch(sw.text,/rest\/v1|storage\/v1/);
 const manifest=JSON.parse((await get('/cloud/manifest.webmanifest')).text);
 assert.equal(manifest.scope,'/cloud/');
 assert.equal(manifest.start_url,'/cloud/');
 for(const icon of ['/cloud/icon-192.png','/cloud/icon-512.png']){
  const res=await fetch(origin+icon,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  assert.equal(res.status,200,'PWA icon unavailable: '+icon);
  assert.match(res.headers.get('content-type')||'',/image\/png/);
 }
 console.log('Production smoke OK: HTTPS, CSP, auth recovery, SW, manifest and mobile icons');
}
let last;
for(let attempt=1;attempt<=12;attempt++){
 try{await check();process.exit(0)}
 catch(e){
  last=e;console.error('Attempt '+attempt+'/12: '+e.message);
  if(attempt<12)await new Promise(resolve=>setTimeout(resolve,10000));
 }
}
throw last;
