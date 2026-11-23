/* EasyGart: screenshot import, on-device OCR and mandatory human review. */
'use strict';
(function(){
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const pad=n=>String(n).padStart(2,'0');
 const validDate=(y,m,d)=>Number.isInteger(y)&&y>=2020&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31&&
   new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===y+'-'+pad(m)+'-'+pad(d);
 const months={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,
   settembre:9,ottobre:10,novembre:11,dicembre:12,januar:1,februar:2,maerz:3,marz:3,
   april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
 function dateIn(text,year){
   let m=text.match(/(?:^|[^\d])(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
   if(m){const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);return validDate(y,mo,d)?{date:y+'-'+pad(mo)+'-'+pad(d),inferred:false}:null}
   m=text.match(/(?:^|[^\d])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?!\d)/);
   if(m){
     const d=Number(m[1]),mo=Number(m[2]),y=m[3]?(m[3].length===2?2000+Number(m[3]):Number(m[3])):year;
     return validDate(y,mo,d)?{date:y+'-'+pad(mo)+'-'+pad(d),inferred:!m[3]}:null;
   }
   m=norm(text).match(/(?:^|\s)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|januar|februar|maerz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+(20\d{2}))?(?:\s|$)/);
   if(m){const d=Number(m[1]),mo=months[m[2]],y=m[3]?Number(m[3]):year;
     return validDate(y,mo,d)?{date:y+'-'+pad(mo)+'-'+pad(d),inferred:!m[3]}:null}
   return null;
 }
 const toMinutes=t=>{const a=String(t||'').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return a?Number(a[1])*60+Number(a[2]):null};
 const toTime=t=>{const n=toMinutes(t);return n===null?'':pad(Math.floor(n/60))+':'+pad(n%60)};
 function intervals(line){
   const pairs=[],used=[];
   const regex=/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:-|–|—|bis|alle|fino\s+a|a|to)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/gi;
   for(const m of line.matchAll(regex)){
     pairs.push([pad(m[1])+':'+m[2],pad(m[3])+':'+m[4]]);
     used.push([m.index,m.index+m[0].length]);
   }
   if(pairs.length)return pairs;
   const tokens=[...line.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)]
     .filter(m=>!used.some(([a,b])=>m.index>=a&&m.index<b))
     .map(m=>pad(m[1])+':'+m[2]);
   if(tokens.length>=2&&tokens.length%2===0&&tokens.length<=8){
     for(let i=0;i<tokens.length;i+=2)pairs.push([tokens[i],tokens[i+1]]);
     return pairs;
   }
   // Simple 8-12 / 13-17 format, only when the line clearly looks like hours.
   const short=[...line.matchAll(/\b([01]?\d|2[0-3])\s*[-–]\s*([01]?\d|2[0-3])\b/g)];
   if(short.length&&short.length<=4&&!/^\s*\d{4}[-/.]/.test(line)){
     return short.map(m=>[pad(m[1])+':00',pad(m[2])+':00']);
   }
   return [];
 }
 function matchKnown(line,items,field){
   const n=norm(line);
   const matches=items.filter(x=>{const name=norm(x[field]);return name.length>=3&&
     (' '+n+' ').includes(' '+name+' ')});
   return matches.length===1?matches[0].id||matches[0].user_id:'';
 }
 function parseHours(text,members,sites,year){
   const rows=[];let currentDate='',currentWorker='',currentSite='',dateInferred=false;
   for(const raw of String(text||'').split(/\r?\n/)){
     const line=raw.trim().replace(/^[•*]\s*/,'');
     if(!line)continue;
     const d=dateIn(line,year);if(d){currentDate=d.date;dateInferred=d.inferred}
     const worker=matchKnown(line,members,'full_name');
     const site=matchKnown(line,sites,'name');
     if(worker)currentWorker=worker;
     if(site)currentSite=site;
     const spans=intervals(line);
     if(!spans.length)continue;
     let start=toMinutes(spans[0][0]),end=toMinutes(spans[spans.length-1][1]),worked=0,valid=true;
     let previousEnd=null;
     for(const [a,b] of spans){
       const st=toMinutes(a),en=toMinutes(b),duration=(en-st+1440)%1440;
       if(duration===0||duration>960){valid=false;break}
       if(previousEnd!==null&&st<previousEnd){valid=false;break}
       worked+=duration;previousEnd=en;
     }
     const elapsed=(end-start+1440)%1440;
     if(!valid||!elapsed||worked>elapsed)continue;
     const pauseMatch=line.match(/(?:pausa|pause|interruzione)\s*[:=]?\s*(\d{1,3})\s*(?:min(?:uti|uten)?|m\b)?/i);
     const explicitPause=pauseMatch?Number(pauseMatch[1]):0;
     const pause=spans.length>1?elapsed-worked:explicitPause;
     const warnings=[];
     if(!currentDate)warnings.push('data mancante');
     if(dateInferred)warnings.push('anno dedotto');
     if(!currentWorker)warnings.push('dipendente da scegliere');
     if(!currentSite)warnings.push('cantiere da scegliere');
     if(spans.length>1&&pauseMatch&&explicitPause!==pause)warnings.push('pausa ricavata dagli intervalli');
     if(pause>=elapsed)warnings.push('pausa da correggere');
     rows.push({date:currentDate,worker_id:currentWorker,site_id:currentSite,
       start_time:spans[0][0],end_time:spans[spans.length-1][1],break_minutes:pause,
       source:line,warnings});
   }
   return rows.slice(0,80);
 }
 const isContactDetail=s=>/^(?:via|viale|vicolo|piazza|piazzale|corso|strada|loc\.?|localit[aà]|indirizzo|adresse|straße|strasse|tel(?:efono)?|cell(?:ulare)?|mobil|phone|email|e-mail|mail|contatto|note)\b/i.test(s)||
   /^[+(\d][\d\s()+.-]{6,}$/.test(s)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
 function parseClients(text){
   const rows=[];let current=null;
   const push=()=>{if(current&&current.name)rows.push(current);current=null};
   for(const raw of String(text||'').split(/\r?\n/)){
     let line=raw.trim().replace(/^\s*(?:[•*-]|\d{1,3}[.)])\s*/,'').trim();
     if(!line){continue}
     if(/^(?:clienti|kunden|lista clienti|rubrica|note|appunti|contatti|contacts)\s*:?$/i.test(line))continue;
     if(isContactDetail(line)){
       if(current)current.notes.push(line);
       continue;
     }
     const parts=line.split(/\s+[|;]\s+|\s+[-–]\s+(?=(?:via|viale|piazza|corso|tel|cell|email|\+?\d))/i);
     let name=parts.shift().replace(/^(?:cliente|kunde|nome)\s*:\s*/i,'').trim();
     if(!name||name.length<2||name.length>150||/^\d+$/.test(name))continue;
     push();current={name,notes:parts.filter(Boolean),source:raw.trim()};
   }
   push();return rows.slice(0,100).map(r=>({...r,notes:r.notes.join('\n')}));
 }
 window.EasyGartImportParser={parseHours,parseClients,toMinutes,validDate};
 window.createEasyGartImporter=function({client,getContext,esc,rerender}){
   let mode='',returnView='calendar-hours',rawText='',rows=[],error='',loading=false,progress='',quality=null;
   const ctx=()=>getContext();
   const tr=(it,de)=>ctx().locale==='de'?de:it;
   const opt=(value,label,selected)=>'<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
   function reset(){mode='';returnView='calendar-hours';rawText='';rows=[];error='';loading=false;progress='';quality=null}
   function open(next,from){
     if(!ctx().isOwner||!['hours','clients'].includes(next))return false;
     reset();mode=next;returnView=from|| (next==='hours'?'calendar-hours':'clients');return true;
   }
   function getReturnView(){return returnView}
   function getMode(){return mode}
   function setText(v){rawText=String(v||'').slice(0,24000)}
   function analyze(){
     error='';quality=null;
     if(!rawText.trim()){error=tr('Incolla il testo oppure seleziona uno screenshot.','Text einfügen oder Screenshot auswählen.');rows=[];rerender();return}
     const c=ctx();
     rows=mode==='hours'?parseHours(rawText,c.members.filter(x=>x.active),c.sites,new Date().getFullYear()):parseClients(rawText);
     if(!rows.length)error=tr('Non ho riconosciuto dati completi. Correggi il testo o inserisci i dati manualmente.','Keine vollständigen Angaben erkannt. Text korrigieren oder manuell eingeben.');
     rerender();
   }
   function loadOCR(){
     if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);
     if(window.__egTesseractPromise)return window.__egTesseractPromise;
     window.__egTesseractPromise=new Promise((resolve,reject)=>{
       const script=document.createElement('script');
       script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
       script.async=true;script.crossOrigin='anonymous';
       script.onload=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(Error('OCR non disponibile'));
       script.onerror=()=>reject(Error('Impossibile caricare il riconoscimento del testo. Incolla il testo delle Note.'));
       document.head.appendChild(script);
     }).catch(e=>{window.__egTesseractPromise=null;throw e});
     return window.__egTesseractPromise;
   }
   async function fromFile(file){
     if(!ctx().isOwner)return;
     if(!file)return;
     if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)&&!/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name||''))
       throw Error(tr('Scegli uno screenshot JPG, PNG, WebP o HEIC.','Bitte JPG, PNG, WebP oder HEIC wählen.'));
     if(file.size>8*1024*1024)throw Error(tr('Screenshot troppo grande (massimo 8 MB).','Screenshot zu groß (maximal 8 MB).'));
     loading=true;progress=tr('Caricamento riconoscimento locale…','Lokale Texterkennung wird geladen…');error='';rerender();
     try{
       const OCR=await loadOCR();
       const result=await OCR.recognize(file,'ita+deu',{logger:m=>{
         if(m.status==='recognizing text'){
           progress=tr('Lettura screenshot','Screenshot wird gelesen')+' '+Math.round((m.progress||0)*100)+'%';
           const label=document.getElementById('eg-import-progress');
           if(label)label.textContent=progress;
         }
       }});
       const recognized=String(result?.data?.text||'').trim();
       quality=Number.isFinite(result?.data?.confidence)?result.data.confidence:null;
       if(!recognized)throw Error(tr('Nessun testo leggibile. Prova uno screenshot più nitido o incolla il testo.','Kein lesbarer Text. Besseres Bild oder Text einfügen.'));
       rawText=(rawText?rawText+'\n':'')+recognized;
       rawText=rawText.slice(0,24000);
       rows=mode==='hours'?parseHours(rawText,ctx().members.filter(x=>x.active),ctx().sites,new Date().getFullYear()):parseClients(rawText);
       if(!rows.length)error=tr('Testo letto, ma nessuna riga riconosciuta: controlla e modifica il testo.','Text gelesen, aber keine Einträge erkannt: Text prüfen und bearbeiten.');
     }catch(e){error=String(e?.message||e)}
     finally{loading=false;progress='';rerender()}
   }
   function hoursRow(r,i){
     const c=ctx(),people=c.members.filter(m=>m.active&&['worker','owner'].includes(m.role));
     return '<div class="eg-import-row" data-import-row>'+
       '<label class="eg-import-check"><input type="checkbox" name="include" checked> '+tr('Importa riga','Eintrag übernehmen')+' '+(i+1)+'</label>'+
       '<small class="muted">'+esc(r.source)+'</small>'+
       (r.warnings.length?'<p class="eg-import-warn">'+esc(r.warnings.join(' · '))+'</p>':'')+
       '<div class="eg-import-fields">'+
       '<label class="field"><span>'+tr('Dipendente','Mitarbeiter')+'</span><select name="worker" required>'+
         opt('',tr('Scegli','Wählen'),!r.worker_id)+people.map(m=>opt(m.user_id,m.full_name||tr('Dipendente','Mitarbeiter'),r.worker_id===m.user_id)).join('')+'</select></label>'+
       '<label class="field"><span>'+tr('Data','Datum')+'</span><input type="date" name="date" value="'+esc(r.date)+'" required></label>'+
       '<label class="field"><span>'+tr('Cantiere','Einsatzort')+'</span><select name="site" required>'+
         opt('',tr('Scegli','Wählen'),!r.site_id)+c.sites.map(s=>opt(s.id,s.name,r.site_id===s.id)).join('')+'</select></label>'+
       '<label class="field"><span>'+tr('Inizio','Beginn')+'</span><input type="time" name="start" value="'+esc(r.start_time)+'" required></label>'+
       '<label class="field"><span>'+tr('Fine','Ende')+'</span><input type="time" name="end" value="'+esc(r.end_time)+'" required></label>'+
       '<label class="field"><span>'+tr('Pausa (minuti)','Pause (Minuten)')+'</span><input type="number" name="pause" min="0" max="1439" step="1" value="'+esc(r.break_minutes)+'" required></label>'+
       '</div></div>';
   }
   function clientRow(r,i){
     const duplicate=ctx().clients.some(c=>norm(c.name)===norm(r.name));
     return '<div class="eg-import-row" data-import-row>'+
       '<label class="eg-import-check"><input type="checkbox" name="include" '+(duplicate?'':'checked')+'> '+tr('Importa cliente','Kunden übernehmen')+' '+(i+1)+'</label>'+
       (duplicate?'<p class="eg-import-warn">'+tr('Nome già presente in rubrica','Name bereits vorhanden')+'</p>':'')+
       '<div class="eg-import-fields"><label class="field"><span>'+tr('Nome cliente','Kundenname')+'</span>'+
         '<input name="name" maxlength="150" value="'+esc(r.name)+'" required></label>'+
       '<label class="field eg-import-wide"><span>'+tr('Recapiti, indirizzo e note','Kontaktdaten, Adresse und Notizen')+'</span>'+
         '<textarea name="notes" rows="2" maxlength="4000">'+esc(r.notes)+'</textarea></label></div></div>';
   }
   function markup(){
     const c=ctx();if(!c.isOwner||!mode)return '';
     const isHours=mode==='hours';
     return '<div class="eg-import-page"><div class="view-head"><div><div class="eyebrow">'+tr('Strumenti del titolare','Werkzeuge für Inhaber')+'</div>'+
       '<h2>'+tr(isHours?'Importa orari da screenshot':'Importa clienti da screenshot',
         isHours?'Arbeitszeiten aus Screenshot importieren':'Kunden aus Screenshot importieren')+'</h2>'+
       '<p class="muted">'+tr('Lettura locale sul dispositivo, senza inviare lo screenshot al database. I dati vengono salvati solo dopo la tua conferma.',
         'Lokale Erkennung auf dem Gerät, ohne den Screenshot in die Datenbank hochzuladen. Speicherung erst nach Bestätigung.')+'</p></div>'+
       '<button type="button" class="ghost small" data-action="import-back">'+tr('Indietro','Zurück')+'</button></div>'+
       '<section class="card eg-import-section"><h3>'+tr('1. Scegli uno screenshot delle Note','1. Screenshot aus Notizen wählen')+'</h3>'+
       '<p class="muted">'+tr('Seleziona dalla libreria Foto oppure incolla il testo. Puoi aggiungere più screenshot uno alla volta.',
         'Aus Fotos wählen oder Text einfügen. Mehrere Screenshots nacheinander möglich.')+'</p>'+
       '<input type="file" data-import-file accept="image/png,image/jpeg,image/webp,image/heic,image/heif" aria-label="'+tr('Scegli screenshot','Screenshot auswählen')+'" '+(loading?'disabled':'')+'>'+
       (loading?'<p class="eg-import-progress" id="eg-import-progress" role="status">'+esc(progress)+'</p>':'')+
       '<label class="field"><span>'+tr('Testo riconosciuto (modificabile)','Erkannter Text (bearbeitbar)')+'</span>'+
       '<textarea id="eg-import-text" rows="6" maxlength="24000" placeholder="'+esc(isHours?
         '12/11/2026\nMario Rossi 08:00-12:00 13:00-17:00':
         'Mario Rossi\nVia Roma 12, Garda\nTel. 333 1234567')+'">'+esc(rawText)+'</textarea></label>'+
       '<button type="button" class="secondary" data-action="import-analyze" '+(loading?'disabled':'')+'>'+
         tr('Analizza / aggiorna anteprima','Vorschau analysieren / aktualisieren')+'</button>'+
       (error?'<div class="alert warn" role="alert">'+esc(error)+'</div>':'')+
       (quality!==null&&quality<80?'<p class="eg-import-warn">'+tr('Testo poco nitido: controlla con attenzione tutti i numeri.','Unscharfer Text: Alle Zahlen sorgfältig prüfen.')+'</p>':'')+
       '</section>'+
       (rows.length?'<form data-form="import-review" class="card eg-import-section"><h3>'+
         tr('2. Controlla e correggi','2. Prüfen und korrigieren')+' · '+rows.length+'</h3>'+
         '<p class="muted">'+tr(isHours?
          'Le ore verranno salvate come rapporti in bozza, separati dalle timbrature. Compariranno nei due calendari. La descrizione del lavoro andrà completata.':
          'Controlla nomi e recapiti. I duplicati non verranno importati; i recapiti sono salvati nelle note del cliente.',
          isHours?
          'Arbeitszeiten werden als Berichtsentwürfe getrennt von Stempelzeiten gespeichert und in beiden Kalendern angezeigt. Tätigkeiten später ergänzen.':
          'Namen und Kontaktdaten prüfen. Duplikate werden übersprungen; Kontaktdaten stehen in den Kundennotizen.')+'</p>'+
         (isHours&&!c.sites.length?'<div class="alert warn">'+tr('Crea prima almeno un cantiere.','Zuerst einen Einsatzort anlegen.')+'</div>':'')+
         rows.map((r,i)=>isHours?hoursRow(r,i):clientRow(r,i)).join('')+
         '<button type="submit" class="primary" '+(loading||(isHours&&!c.sites.length)?'disabled':'')+'>'+
           tr(isHours?'Conferma e importa orari':'Conferma e importa clienti',
             isHours?'Arbeitszeiten bestätigen und importieren':'Kunden bestätigen und importieren')+'</button></form>':'')+
       '<p class="muted eg-import-foot">'+tr('Importante: il riconoscimento può sbagliare nomi, date e cifre. Nessun salvataggio senza verifica.',
         'Wichtig: Die Texterkennung kann Namen, Daten und Zahlen verwechseln. Keine Speicherung ohne Prüfung.')+'</p></div>';
   }
   async function save(form){
     const c=ctx();if(!c.isOwner||!c.companyId||!mode)throw Error(tr('Permesso negato.','Zugriff verweigert.'));
     const selected=[...form.querySelectorAll('[data-import-row]')].filter(node=>node.querySelector('[name="include"]')?.checked);
     if(!selected.length)throw Error(tr('Seleziona almeno una riga.','Mindestens einen Eintrag auswählen.'));
     if(selected.length>80)throw Error(tr('Massimo 80 righe per importazione.','Maximal 80 Einträge pro Import.'));
     let saved=0,skipped=0;
     if(mode==='clients'){
       const existing=new Set(c.clients.map(x=>norm(x.name)));
       const prepared=selected.map(node=>({name:node.querySelector('[name="name"]')?.value.trim()||'',
         notes:node.querySelector('[name="notes"]')?.value.trim()||''}));
       for(const r of prepared)if(r.name.length<2||r.name.length>150||r.notes.length>4000)
         throw Error(tr('Correggi i nomi e le note dei clienti.','Kundennamen und Notizen korrigieren.'));
       for(const r of prepared){
         const k=norm(r.name);
         if(existing.has(k)){skipped++;continue}
         const response=await client.from('eg_clients').insert({company_id:c.companyId,name:r.name,notes:r.notes});
         if(response.error)throw Error(tr('Importazione interrotta dopo ','Import nach ')+saved+
           tr(' clienti. ',' Kunden abgebrochen. ')+response.error.message);
         existing.add(k);saved++;
       }
     }else{
       const people=new Set(c.members.filter(x=>x.active).map(x=>x.user_id));
       const siteIds=new Set(c.sites.map(x=>x.id));
       const prepared=selected.map(node=>({
         worker_id:node.querySelector('[name="worker"]')?.value||'',
         site_id:node.querySelector('[name="site"]')?.value||'',
         date:node.querySelector('[name="date"]')?.value||'',
         start:node.querySelector('[name="start"]')?.value||'',
         end:node.querySelector('[name="end"]')?.value||'',
         pause:Number(node.querySelector('[name="pause"]')?.value)
       }));
       for(const r of prepared){
         const parts=r.date.split('-').map(Number),start=toMinutes(r.start),end=toMinutes(r.end);
         const elapsed=start===null||end===null?0:(end-start+1440)%1440;
         if(!people.has(r.worker_id)||!siteIds.has(r.site_id)||!validDate(parts[0],parts[1],parts[2])||
           start===null||end===null||!elapsed||!Number.isInteger(r.pause)||r.pause<0||r.pause>=elapsed)
           throw Error(tr('Controlla dipendente, cantiere, data, inizio, fine e pausa in ogni riga selezionata.',
             'Mitarbeiter, Einsatzort, Datum, Beginn, Ende und Pause jeder gewählten Zeile prüfen.'));
         if(r.date>new Date().toISOString().slice(0,10))
           throw Error(tr('Non puoi importare ore lavorate in una data futura.','Arbeitszeiten für zukünftige Tage können nicht importiert werden.'));
       }
       const dates=[...new Set(prepared.map(x=>x.date))];
       const existingResponse=await client.from('eg_daily_reports')
         .select('created_by,work_date,work_start_time,work_end_time,break_minutes,site_id,deleted_at')
         .eq('company_id',c.companyId).in('work_date',dates).limit(2000);
       if(existingResponse.error)throw existingResponse.error;
       if((existingResponse.data||[]).length>=2000)
         throw Error(tr('Troppi rapporti nel periodo: importa un gruppo di giorni più piccolo.','Zu viele Berichte: Weniger Tage importieren.'));
       const seen=new Set((existingResponse.data||[]).filter(x=>!x.deleted_at).map(x=>
         [x.created_by,x.work_date,String(x.work_start_time||'').slice(0,5),
          String(x.work_end_time||'').slice(0,5),Number(x.break_minutes||0),x.site_id].join('|')));
       for(const r of prepared){
         const k=[r.worker_id,r.date,r.start,r.end,r.pause,r.site_id].join('|');
         if(seen.has(k)){skipped++;continue}
         const response=await client.rpc('eg_save_daily_report_v5',{
           p_report_id:null,p_company_id:c.companyId,p_worker_id:r.worker_id,p_site_id:r.site_id,
           p_task_id:null,p_work_date:r.date,p_start_time:r.start,p_end_time:r.end,
           p_break_minutes:r.pause,
           p_work_summary:tr('Orari importati da screenshot. Attività da completare.',
             'Arbeitszeiten aus Screenshot importiert. Tätigkeiten noch ergänzen.'),
           p_materials_used:'',p_issues:'',p_materials:[],p_send:false
         });
         if(response.error)throw Error(tr('Importazione interrotta dopo ','Import nach ')+saved+
           tr(' rapporti. ',' Berichten abgebrochen. ')+response.error.message);
         seen.add(k);saved++;
       }
     }
     return {saved,skipped,mode};
   }
   return {open,reset,getMode,getReturnView,markup,setText,analyze,fromFile,save};
 };
})();