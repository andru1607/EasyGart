/* EasyGart Cloud installability and network status for iOS Safari / Android Chromium. */
'use strict';
(()=> {
 const supports=typeof window!=='undefined'&&typeof document!=='undefined';
 if(!supports)return;
 let installEvent=null;
 const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)')?.matches||
   window.navigator?.standalone===true;
 function showNetwork(){
   const offline=!navigator.onLine;
   document.body.classList.toggle('eg-offline',offline);
   let bar=document.getElementById('eg-network-banner');
   if(!bar){
     bar=document.createElement('div');
     bar.id='eg-network-banner';bar.setAttribute('role','status');
     bar.setAttribute('aria-live','polite');document.body.prepend(bar);
   }
   bar.hidden=!offline;
   bar.textContent=(document.documentElement.lang==='de'?
     'Keine Internetverbindung. Änderungen können derzeit nicht gespeichert werden.':
     'Connessione assente. Non è possibile salvare modifiche fino al ripristino della rete.');
 }
 window.addEventListener('online',showNetwork);
 window.addEventListener('offline',showNetwork);
 window.addEventListener('beforeinstallprompt',e=>{
   e.preventDefault();installEvent=e;
   const button=document.getElementById('eg-install');
   if(button)button.hidden=false;
 });
 window.EASYGART_INSTALL={
   canPrompt:()=>!!installEvent&&!isStandalone(),
   install:async()=>{
     if(!installEvent)return false;
     const current=installEvent;installEvent=null;
     await current.prompt();await current.userChoice;
     return true;
   },
   isStandalone
 };
 document.addEventListener('DOMContentLoaded',()=>{
   showNetwork();
   if(!('serviceWorker' in navigator)||!location.protocol.startsWith('https'))return;
   navigator.serviceWorker.register('/cloud/sw.js',{scope:'/cloud/'})
     .catch(()=>{/* App continues online when service worker is unavailable */});
 });
})();
