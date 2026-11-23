/* EasyGart Cloud: screenshot -> reviewed drafts (owner only).
 * OCR on the device; screenshots are never sent to Supabase or the app server.
 * Third-party OCR code/language resources are downloaded on demand.
 */
'use strict';
window.createEasyGartImport=function({client,getContext,esc,onImported,rerender}){
  const parser=window.EASYGART_IMPORT_PARSER;
  const ctx=()=>getContext();
  const tr=(it,de)=>ctx().locale==='de'?de:it;
  const safe=v=>esc(String(v??''));
  let mode='hours',sourceFile=null,objectURL='',raw='',rows=[],busy=false;
  let progress='',error='',message='',lastAdded=0,openCompany='';
  const canUse=()=>!!ctx().isOwner&&!!ctx().companyId&&!!ctx().user;
  const siteOpts=(value)=>'<option value="">'+tr('Scegli cantiere','Einsatzort wählen')+'</option>'+
    (ctx().sites||[]).map(s=>'<option value="'+safe(s.id)+'"'+(s.id===value?' selected':'')+'>'+safe(s.name)+'</option>').join('');
  const workerOpts=value=>'<option value="">'+tr('Scegli dipendente','Mitarbeiter wählen')+'</option>'+
    (ctx().members||[]).filter(m=>m.active).map(m=>'<option value="'+safe(m.user_id)+'"'+(m.user_id===value?' selected':'')+'>'+
      safe(m.full_name||tr('Operatore','Mitarbeiter'))+'</option>').join('');
  function closeImage(){if(objectURL&&typeof URL!=='undefined')URL.revokeObjectURL(objectURL);objectURL='';sourceFile=null}
  function reset(){closeImage();raw='';rows=[];progress='';busy=false;error='';message='';lastAdded=0}
  function open(nextMode='hours'){
    if(!canUse())return false;
    if(openCompany!==ctx().companyId){reset();openCompany=ctx().companyId}
    mode=nextMode==='clients'?'clients':'hours';message='';error='';
    // Clear entries when changing data categories to avoid cross-type imports.
    rows=[];return true;
  }
  function setMode(next){
    if(busy||!['hours','clients'].includes(next))return;
    mode=next;rows=[];error='';message='';lastAdded=0;
    if(raw.trim())analyse();
  }
  function analyse(){
    if(!canUse()||busy)return;
    const c=ctx();
    rows=mode==='hours'?parser.hours(raw,{
      members:c.members||[],sites:c.sites||[],year:new Date().getFullYear()
    }):parser.clients(raw);
    error='';message=rows.length?tr('Controlla e correggi ogni riga prima del salvataggio.',
      'Bitte jede Zeile vor dem Speichern prüfen.'):
      tr('Nessuna riga riconosciuta. Correggi il testo riconosciuto e riprova.',
        'Keine Zeile erkannt. Bitte den erkannten Text korrigieren und erneut versuchen.');
    lastAdded=0;
  }
  function setRaw(value){if(!busy)raw=String(value||'').slice(0,20000)}
  function setField(i,key,value){
    const row=rows[i];if(!row||row.status==='saved'||busy)return;
    const allowed=mode==='hours'?
      ['include','work_date','worker_id','site_id','start_time','end_time','break_minutes','work_summary']:
      ['include','name','phone','email','address'];
    if(!allowed.includes(key))return;
    row[key]=key==='include'?!!value:
      key==='break_minutes'?Number(value):String(value||'').slice(0,500);
    row.error='';row.status='pending';
  }
  const fileSize=10*1024*1024;
  async function readScreenshot(file){
    if(!canUse())throw Error(tr('Solo il titolare può importare screenshot.','Nur der Inhaber kann Screenshots importieren.'));
    if(busy)return;
    if(!file)throw Error(tr('Seleziona uno screenshot.','Bitte Screenshot auswählen.'));
    if(!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.type)&&
       !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name||''))
      throw Error(tr('Usa uno screenshot PNG, JPEG o WebP.','Bitte PNG, JPEG oder WebP verwenden.'));
    if(file.size>fileSize)throw Error(tr('Immagine troppo grande (massimo 10 MB).','Bild zu groß (maximal 10 MB).'));
    busy=true;error='';message='';progress=tr('Lettura dello screenshot…','Screenshot wird gelesen…');
    closeImage();sourceFile=file;objectURL=URL.createObjectURL(file);
    const processId=document.getElementById('eg-import-progress');
    const announce=value=>{progress=value;const el=document.getElementById('eg-import-progress');if(el)el.textContent=value};
    let worker=null;
    try{
      // The OCR runtime fetches its own JS/WASM and language files. Image bytes remain on the device.
      const mod=await import('https://esm.sh/tesseract.js@6.0.1?bundle');
      if(typeof mod.createWorker!=='function')throw Error('OCR module unavailable');
      announce(tr('Preparazione del riconoscimento…','Texterkennung wird vorbereitet…'));
      worker=await mod.createWorker(['ita','eng'],1,{
        workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
        corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2',
        langPath:'https://tessdata.projectnaptha.com/4.0.0',
        workerBlobURL:true,
        cacheMethod:'readOnly',
        logger:info=>{
          if(info?.status==='recognizing text'){
            const n=Math.round(Math.max(0,Math.min(1,Number(info.progress)||0))*100);
            announce(tr('Riconoscimento testo','Texterkennung')+' '+n+'%');
          }
        }
      });
      const result=await worker.recognize(file);
      raw=String(result?.data?.text||'').slice(0,20000);
      if(!raw.trim())throw Error(tr('Nessun testo leggibile. Prova con uno screenshot più nitido o incolla il testo delle Note.',
        'Kein lesbarer Text. Bitte ein schärferes Bild verwenden oder den Notiztext einfügen.'));
      busy=false;progress='';analyse();
      return raw;
    }catch(err){
      error=tr('Riconoscimento automatico non riuscito. Puoi incollare il testo delle Note qui sotto. Dettaglio: ',
        'Automatische Texterkennung fehlgeschlagen. Notiztext kann unten eingefügt werden. Details: ')+
        String(err?.message||err).slice(0,220);
      busy=false;progress='';
      return null;
    }finally{try{await worker?.terminate()}catch{}}
  }
  function rowMarkup(row,i){
    const disabled=row.status==='saved'?' disabled':'';
    const input=(key,type,value,extra='')=>'<input data-import-row="'+i+'" data-import-key="'+key+'" type="'+type+'" value="'+safe(value)+'" '+extra+disabled+'>';
    const field=(label,body)=>'<label class="field">'+safe(label)+body+'</label>';
    const title=mode==='hours'?safe(row.work_date||tr('Orario','Arbeitszeit')):safe(row.name||tr('Cliente','Kunde'));
    const included='<label class="eg-import-check"><input type="checkbox" data-import-row="'+i+
      '" data-import-key="include"'+(row.include?' checked':'')+disabled+'><span>'+
      tr('Includi','Einbeziehen')+'</span></label>';
    const warning=row.year_guessed?'<p class="eg-import-warning">'+tr('Anno dedotto: verifica la data.',
      'Jahr angenommen: Datum prüfen.')+'</p>':'';
    const feedback=row.error?'<p class="eg-import-error" role="alert">'+safe(row.error)+'</p>':
      row.status==='saved'?'<p class="eg-import-saved">'+tr('Salvato','Gespeichert')+'</p>':'';
    if(mode==='hours')return '<section class="card eg-import-row"><div class="eg-import-row-head">'+
      '<strong>'+safe(i+1)+'. '+title+'</strong>'+included+'</div>'+
      '<div class="eg-import-fields">'+
      field(tr('Data','Datum'),input('work_date','date',row.work_date||'', 'required'))+
      field(tr('Dipendente','Mitarbeiter'),'<select data-import-row="'+i+'" data-import-key="worker_id"'+disabled+'>'+workerOpts(row.worker_id)+'</select>')+
      field(tr('Cantiere','Einsatzort'),'<select data-import-row="'+i+'" data-import-key="site_id"'+disabled+'>'+siteOpts(row.site_id)+'</select>')+
      field(tr('Inizio','Beginn'),input('start_time','time',row.start_time,'required'))+
      field(tr('Fine','Ende'),input('end_time','time',row.end_time,'required'))+
      field(tr('Pausa (min)','Pause (Min.)'),input('break_minutes','number',row.break_minutes,'min="0" max="600" step="1"'))+
      '</div>'+
      field(tr('Descrizione lavori (facoltativa)','Beschreibung der Arbeiten (optional)'),
        '<textarea data-import-row="'+i+'" data-import-key="work_summary" rows="2"'+disabled+'>'+
         safe(row.work_summary||'')+'</textarea>')+
      '<p class="eg-import-origin">'+tr('Letto da','Erkannt aus')+': '+safe(row.source_line)+'</p>'+warning+feedback+'</section>';
    return '<section class="card eg-import-row"><div class="eg-import-row-head"><strong>'+
      safe(i+1)+'. '+title+'</strong>'+included+'</div><div class="eg-import-fields">'+
      field(tr('Cliente / azienda','Kunde / Firma'),input('name','text',row.name,'maxlength="150" required'))+
      field(tr('Telefono','Telefon'),input('phone','tel',row.phone||'','maxlength="80"'))+
      field('Email',input('email','email',row.email||'','maxlength="200"'))+
      field(tr('Indirizzo','Adresse'),input('address','text',row.address||'','maxlength="300"'))+
      '</div>'+feedback+'</section>';
  }
  function markup(){
    if(!canUse())return '<div class="alert warn">'+tr('Funzione riservata al titolare.','Nur für den Inhaber.')+'</div>';
    return '<section class="eg-import-page">'+
      '<div class="view-head"><div><div class="eyebrow">'+tr('Importazione assistita','Unterstützter Import')+'</div>'+
      '<h2>'+tr('Importa da screenshot','Aus Screenshot importieren')+'</h2>'+
      '<p class="muted">'+tr('Da Note o da una schermata con clienti. Nessun dato viene salvato senza conferma.',
        'Aus Notizen oder Kundenlisten. Ohne Bestätigung werden keine Daten gespeichert.')+'</p></div>'+
      '<button type="button" class="ghost" data-action="import-close">'+tr('Chiudi','Schließen')+'</button></div>'+
      '<div class="eg-import-tabs" role="group" aria-label="'+tr('Tipo importazione','Importart')+'">'+
      '<button type="button" data-action="import-kind" data-kind="hours" aria-pressed="'+(mode==='hours')+'" class="'+(mode==='hours'?'active':'')+'">'+tr('Orari e rapporti','Zeiten und Berichte')+'</button>'+
      '<button type="button" data-action="import-kind" data-kind="clients" aria-pressed="'+(mode==='clients')+'" class="'+(mode==='clients'?'active':'')+'">'+tr('Clienti','Kunden')+'</button></div>'+
      '<div class="card eg-import-upload"><h3>'+tr('1. Scegli uno screenshot delle Note','1. Screenshot der Notizen wählen')+'</h3>'+
      '<label class="field"><span>'+tr('Immagine dalla galleria','Bild aus der Galerie')+'</span>'+
      '<input type="file" id="eg-import-image" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"></label>'+
      (objectURL?'<img class="eg-import-preview" src="'+safe(objectURL)+'" alt="'+tr('Anteprima screenshot','Screenshot Vorschau')+'">':'')+
      '<p class="muted">'+tr('Il riconoscimento avviene sul dispositivo, scaricando il motore OCR. Le immagini non vengono caricate nel database.',
        'Die Erkennung läuft auf dem Gerät mit einer heruntergeladenen OCR-Bibliothek. Bilder werden nicht in die Datenbank hochgeladen.')+'</p>'+
      '<p id="eg-import-progress" class="eg-import-progress" role="status">'+safe(progress)+'</p></div>'+
      '<div class="card eg-import-text"><h3>'+tr('2. Controlla il testo riconosciuto','2. Erkannten Text prüfen')+'</h3>'+
      '<label class="field"><span>'+tr('Correggi il testo oppure incollalo direttamente dalle Note','Text korrigieren oder direkt aus Notizen einfügen')+'</span>'+
      '<textarea id="eg-import-raw" rows="6" maxlength="20000" placeholder="'+
        safe(mode==='hours'?tr('15/11/2026 Marco Rossi 08:00-16:30 pausa 30 Cantiere Rossi',
        '15.11.2026 Marco Rossi 08:00-16:30 Pause 30 Einsatzort Rossi'):
        tr('Nome: Mario Rossi\nTelefono: +39 ...\nIndirizzo: ...',
           'Name: Mario Rossi\nTelefon: +39 ...\nAdresse: ...'))+'">'+safe(raw)+'</textarea></label>'+
      '<button class="secondary" type="button" data-action="import-analyse">'+tr('Analizza testo','Text analysieren')+'</button></div>'+
      '<div class="eg-import-review"><h3>'+tr('3. Verifica e importa','3. Prüfen und importieren')+'</h3>'+
      '<p class="muted">'+(mode==='hours'?tr('Vengono create bozze di rapporto con gli orari dichiarati. Non vengono create timbrature reali. Le attività non descritte restano vuote.',
       'Es werden Berichtsentwürfe mit gemeldeten Zeiten angelegt, keine echten Stempelzeiten. Unbeschriebene Tätigkeiten bleiben leer.'):
       tr('Vengono importati nomi e, se disponibili, recapiti. I duplicati vengono bloccati.',
       'Namen und vorhandene Kontaktdaten werden importiert. Duplikate werden verhindert.'))+'</p>'+
      (rows.length?rows.map(rowMarkup).join(''):
        '<div class="card"><p class="muted">'+tr('Nessuna riga da importare. Seleziona uno screenshot o incolla il testo.',
          'Keine Zeilen zum Importieren. Screenshot auswählen oder Text einfügen.')+'</p></div>')+
      (error?'<div class="alert error" role="alert">'+safe(error)+'</div>':'')+
      (message?'<div class="alert" role="status">'+safe(message)+'</div>':'')+
      (rows.some(r=>r.include&&r.status!=='saved')?
        '<button class="primary eg-import-save" type="button" data-action="import-save"'+(busy?' disabled':'')+'>'+
         tr('Conferma e importa le righe selezionate','Ausgewählte Zeilen bestätigen und importieren')+'</button>':'')+
      '</div></section>';
  }
  async function save(){
    if(!canUse()||busy)throw Error(tr('Operazione non consentita.','Aktion nicht erlaubt.'));
    if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error(tr('Serve Internet per salvare.','Zum Speichern ist Internet erforderlich.'));
    const c=ctx(),companyId=c.companyId;
    const selected=rows.filter(r=>r.include&&r.status!=='saved');
    if(!selected.length)return;
    busy=true;error='';message='';lastAdded=0;
    try{
      let existing=[],supportsContacts=false;
      if(mode==='hours'){
        const res=await client.from('eg_daily_reports')
          .select('id,created_by,site_id,work_date,work_start_time,work_end_time,deleted_at')
          .eq('company_id',companyId).order('work_date',{ascending:false}).limit(2000);
        if(res.error)throw res.error;
        existing=res.data||[];
      }else{
        const res=await client.from('eg_clients').select('id,name').eq('company_id',companyId).limit(2000);
        if(res.error)throw res.error;
        existing=res.data||[];
        const check=await client.from('eg_clients').select('phone,email,address').eq('company_id',companyId).limit(1);
        supportsContacts=!check.error;
      }
      const known=new Set();
      for(const r of existing){
        const key=mode==='hours'?
          [r.created_by,r.site_id,r.work_date,r.work_start_time?.slice(0,5),r.work_end_time?.slice(0,5)].join('|'):
          parser.norm(r.name);
        if(mode==='hours'&&r.deleted_at)continue;
        known.add(key);
      }
      for(const row of selected){
        row.error='';row.status='pending';
        try{
          let key;
          if(mode==='hours'){
            const date=parser.isoDate(row.work_date);
            if(!date||date.date!==row.work_date)throw Error(tr('Data non valida.','Ungültiges Datum.'));
            if(!(c.members||[]).some(x=>x.user_id===row.worker_id&&x.active))
              throw Error(tr('Seleziona un dipendente attivo.','Aktiven Mitarbeiter wählen.'));
            if(!(c.sites||[]).some(x=>x.id===row.site_id))
              throw Error(tr('Seleziona un cantiere.','Einsatzort wählen.'));
            const total=parser.duration(row.start_time,row.end_time,Number(row.break_minutes));
            if(total===null)throw Error(tr('Controlla inizio, fine e pausa (turno massimo 16 ore).',
              'Beginn, Ende und Pause prüfen (maximal 16 Stunden).'));
            key=[row.worker_id,row.site_id,row.work_date,row.start_time,row.end_time].join('|');
            if(known.has(key))throw Error(tr('Orario già presente: possibile duplicato.','Zeit bereits vorhanden: mögliches Duplikat.'));
            const result=await client.rpc('eg_save_daily_report_v5',{
              p_report_id:null,p_company_id:companyId,p_worker_id:row.worker_id,
              p_site_id:row.site_id,p_task_id:null,p_work_date:row.work_date,
              p_start_time:row.start_time,p_end_time:row.end_time,
              p_break_minutes:Number(row.break_minutes),
              p_work_summary:String(row.work_summary||'').slice(0,6000),
              p_materials_used:'',p_issues:'',p_materials:[],p_send:false
            });
            if(result.error)throw result.error;
          }else{
            const name=String(row.name||'').trim();
            if(name.length<2||name.length>150)throw Error(tr('Nome cliente non valido.','Ungültiger Kundenname.'));
            if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
              throw Error(tr('Indirizzo email non valido.','Ungültige E-Mail-Adresse.'));
            key=parser.norm(name);
            if(known.has(key))throw Error(tr('Cliente già presente: possibile duplicato.','Kunde bereits vorhanden: mögliches Duplikat.'));
            if(!supportsContacts&&(row.phone||row.email||row.address))
              throw Error(tr('Per salvare telefono, email e indirizzo serve la migrazione dei contatti del cliente. Nessun dato è stato scartato.',
                'Zum Speichern der Kontaktdaten ist eine Datenbankmigration erforderlich. Keine Daten verworfen.'));
            const payload={company_id:companyId,name};
            if(supportsContacts){
              payload.phone=String(row.phone||'').trim().slice(0,80);
              payload.email=String(row.email||'').trim().slice(0,200);
              payload.address=String(row.address||'').trim().slice(0,300);
            }
            const result=await client.from('eg_clients').insert(payload).select('id').single();
            if(result.error)throw result.error;
          }
          row.status='saved';known.add(key);lastAdded++;
        }catch(e){row.status='error';row.error=String(e?.message||e).slice(0,220)}
      }
      if(lastAdded)await onImported(mode,lastAdded);
      const failed=selected.filter(r=>r.status==='error').length;
      message=tr('Importati','Importiert')+' '+lastAdded+' · '+tr('Da correggere','Zu korrigieren')+' '+failed+
       '. '+tr('Le righe con errore restano disponibili.','Fehlerhafte Zeilen bleiben verfügbar.');
    }finally{busy=false;rerender()}
  }
  return {open,reset,markup,setMode,setRaw,analyse,readScreenshot,setField,save,getMode:()=>mode,isBusy:()=>busy,
    getRows:()=>rows,getRaw:()=>raw};
};
