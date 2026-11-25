/* EasyGart Cloud offline shell only. Authenticated data and API responses NEVER cached. */
'use strict';
const VERSION='easygart-shell-v34-20261125-import-validation-v1';
const SHELL=[
  '/cloud/','/cloud/index.html','/cloud/app.js','/cloud/config.js',
  '/cloud/operations.js','/cloud/archive.js','/cloud/business.js','/cloud/mobile.js',
  '/cloud/guide.js','/cloud/guide.css','/cloud/calendar.js',
  '/cloud/eod.js','/cloud/eod.css','/cloud/premium.css','/cloud/monthly.js','/cloud/sites_history.js',
  '/cloud/search.js','/cloud/import_parser.js','/cloud/import.js',
  '/cloud/logo.png','/cloud/icon.svg','/cloud/icon-192.png','/cloud/icon-512.png','/cloud/apple-touch-icon.png','/cloud/manifest.webmanifest'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(
    SHELL.map(path=>cache.add(new Request(path,{cache:'reload'})))
  )).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith('easygart-shell-')&&k!==VERSION).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok&&response.type!=='opaque'){
      const copy=response.clone();
      event.waitUntil(caches.open(VERSION).then(cache=>cache.put(
        new Request(url.pathname,{method:'GET'}),copy
      )));
    }
    return response;
  }).catch(async()=>{
    const cache=await caches.open(VERSION);
    return (await cache.match(new Request(url.pathname,{method:'GET'})))||
      Response.error();
  }));
});
