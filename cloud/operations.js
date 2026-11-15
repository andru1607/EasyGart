/* EasyGart Cloud operations: private photos, customer sign-off and server-stamped attendance.
   Only worker/owner authorized by Supabase RLS can see private business data. */
'use strict';
window.createEasyGartOperations = function createEasyGartOperations({client,getContext,t,tr,esc,onSuccess,rerender}) {
  const BUCKET='eg-report-media';
  const PHOTO_LIMIT=3;
  const MAX_IMAGE_SIZE=5242880;
  const API_SIGNED_URL_TTL=120; // Short-lived preview links. Never use getPublicUrl.
  let shifts=[],media=[],shiftsReady=false,mediaReady=false;
  let shiftError='',mediaError='',selectedWorker='all',signingReportId=null;
  let signatureDrawn=false,drawing=false,lastPoint=null,mediaUrls=new Map();
  const context=()=>getContext();
  const ownReport=report=>{
    const c=context();
    return !!c.user && !!report && report.created_by===c.user.id &&
      ['draft','changes_requested'].includes(report.status) && !c.isOwner;
  };
  const safeText=(s)=>esc(s);
  const sectionName=s=>t(s);
  const showMissing=(kind)=>'<div class="alert warn">'+t(
    kind==='attendance'
      ? 'Le timbrature non sono ancora attive. Applica la migrazione SQL delle presenze.'
      : 'Le foto e le firme non sono ancora attive. Applica la migrazione SQL dei media privati.'
  )+' <a href="https://github.com/andru1607/EasyGart/blob/main/supabase/'+
    (kind==='attendance'?'easygart_attendance_v1.sql':'easygart_private_media_v1.sql')+
    '" target="_blank" rel="noopener noreferrer">'+t('Apri lo script SQL')+'</a></div>';
  const labelOption=(value,label,chosen=false)=>'<option value="'+safeText(value)+'"'+(chosen?' selected':'')+'>'+safeText(label)+'</option>';
  function dateTime(value) {
    if(!value)return '—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat(context().locale==='de'?'de-DE':'it-IT',
      {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  function duration(seconds){
    const n=Math.max(0,Math.floor(seconds||0));
    return Math.floor(n/3600)+' h '+String(Math.floor((n%3600)/60)).padStart(2,'0')+' min';
  }
  function elapsed(shift){
    const end=shift.ended_at?new Date(shift.ended_at).getTime():Date.now();
    const start=new Date(shift.started_at).getTime();
    const runningBreak=shift.break_started_at?Math.max(0,(Date.now()-new Date(shift.break_started_at).getTime())/1000):0;
    return duration(Math.max(0,(end-start)/1000-(shift.break_seconds||0)-runningBreak));
  }
  function isOwner(){return !!context().isOwner}
  function currentWorker(){return context().user?.id}
  function canClock(){return !isOwner()&&!!currentWorker()}
  function ownShift(){return shifts.find(s=>s.user_id===currentWorker()&&s.status!=='closed')}
  const workerName=(id)=>context().members.find(m=>m.user_id===id)?.full_name||tr('Dipendente');
  async function refresh(companyId){
    if(!companyId){shifts=[];media=[];shiftsReady=false;mediaReady=false;mediaUrls.clear();return}
    const [rs,rm]=await Promise.all([
      client.from('eg_shifts').select('id,company_id,user_id,site_id,started_at,ended_at,break_started_at,break_seconds,status')
        .eq('company_id',companyId).order('started_at',{ascending:false}).limit(200),
      client.from('eg_report_media').select('id,company_id,report_id,author_id,kind,mime_type,storage_path,status,signer_name,uploaded_at,created_at')
        .eq('company_id',companyId).eq('status','uploaded')
        .order('created_at',{ascending:false}).limit(180)
    ]);
    shiftsReady=!rs.error;shiftError=rs.error?.message||'';
    shifts=rs.data||[];
    mediaReady=!rm.error;mediaError=rm.error?.message||'';
    media=rm.data||[];
    if(!mediaReady){mediaUrls.clear();return}
    // Each authorized caller receives only short-lived signed URLs; never public bucket links.
    const current=new Set(media.map(m=>m.storage_path));
    for(const key of mediaUrls.keys())if(!current.has(key))mediaUrls.delete(key);
    const now=Date.now();
    const pending=media.filter(m=>!mediaUrls.has(m.storage_path)||mediaUrls.get(m.storage_path).expiry<now+20000);
    await Promise.all(pending.map(async m=>{
      try{
        const {data,error}=await client.storage.from(BUCKET).createSignedUrl(m.storage_path,API_SIGNED_URL_TTL);
        if(!error&&data?.signedUrl)mediaUrls.set(m.storage_path,{
          url:data.signedUrl,expiry:Date.now()+(API_SIGNED_URL_TTL*1000)
        });
      }catch{}
    }));
  }
  function activeWorkerShifts(){
    const c=context();
    return shifts.filter(s=>c.isOwner||(s.user_id===c.user?.id));
  }
  function clockMarkup(){
    if(!shiftsReady)return '<div class="view-head"><h2>'+t('Timbrature')+'</h2></div>'+showMissing('attendance');
    const c=context(),owner=c.isOwner;
    let list=activeWorkerShifts();
    if(owner&&selectedWorker!=='all')list=list.filter(s=>s.user_id===selectedWorker);
    const open=ownShift();
    const closed=list.filter(s=>s.status==='closed').length;
    const worked=list.filter(s=>s.status==='closed').reduce((sum,s)=>{
      const delta=(new Date(s.ended_at)-new Date(s.started_at))/1000-(s.break_seconds||0);
      return sum+Math.max(0,delta);
    },0);
    const head='<div class="view-head"><div><h2>'+t(owner?'Timbrature della squadra':'Le mie timbrature')+'</h2><p class="muted">'+
      t('Gli orari vengono registrati dal server, non dal telefono.')+'</p></div></div>';
    const metric='<div class="grid" style="margin-bottom:17px">'+
      '<div class="card metric"><span>'+t('Turni conclusi')+'</span><strong>'+closed+'</strong></div>'+
      '<div class="card metric"><span>'+t('Ore lavorate registrate')+'</span><strong style="font-size:25px">'+duration(worked)+'</strong></div>'+
      '<div class="card metric"><span>'+t('Turni aperti')+'</span><strong>'+list.filter(s=>s.status!=='closed').length+'</strong></div></div>';
    const choose=owner?'<div class="card" style="margin-bottom:17px"><label class="field">'+t('Dipendente')+
      '<select data-ops-filter="worker">'+labelOption('all',tr('Tutti i dipendenti'),selectedWorker==='all')+
      c.members.filter(m=>m.role==='worker').map(m=>labelOption(m.user_id,m.full_name,m.user_id===selectedWorker)).join('')+'</select></label></div>':'';
    let controls='';
    if(!owner){
      const siteOptions=labelOption('',tr('Non specificato'))+c.sites.map(x=>labelOption(x.id,x.name)).join('');
      controls='<div class="card stacked" style="margin-bottom:18px"><div class="cardhead"><div><h2>'+t('Turno attuale')+'</h2>'+
        '<p class="muted">'+(open?t(open.status==='break'?'Pausa in corso':'Turno in corso'):t('Non hai un turno aperto.'))+'</p></div>'+
        (open?'<span class="pill">'+t(open.status==='break'?'In pausa':'Al lavoro')+'</span>':'')+'</div>'+
        (open?'<div class="two"><div><strong>'+t('Entrata')+': </strong>'+dateTime(open.started_at)+'</div>'+
        '<div><strong>'+t('Tempo lavorato')+': </strong>'+elapsed(open)+'</div></div>':
        '<label class="field">'+t('Cantiere (facoltativo)')+'<select id="ops-clock-site">'+siteOptions+'</select></label>')+
        '<div class="actions">'+(!open?'<button class="primary" data-action="ops-clock" data-ops-type="clock_in">'+t('Entra')+'</button>':
          (open.status==='working'?'<button class="secondary" data-action="ops-clock" data-ops-type="break_start">'+t('Inizia pausa')+'</button>':
          '<button class="secondary" data-action="ops-clock" data-ops-type="break_end">'+t('Termina pausa')+'</button>')+
          '<button class="primary" data-action="ops-clock" data-ops-type="clock_out">'+t('Esci dal turno')+'</button>')+
        '</div></div>';
    }
    const row=shift=>'<div class="taskrow"><div><div class="task-title">'+safeText(workerName(shift.user_id))+'</div>'+
      '<div class="task-meta"><span>'+t('Entrata')+': '+dateTime(shift.started_at)+'</span>'+
      '<span>'+t('Uscita')+': '+(shift.ended_at?dateTime(shift.ended_at):'—')+'</span>'+
      '<span>'+t('Cantiere')+': '+safeText(c.sites.find(x=>x.id===shift.site_id)?.name||tr('Non specificato'))+'</span></div>'+
      '<div class="task-meta"><span>'+t('Pause')+': '+duration(shift.break_seconds||0)+'</span>'+
      '<span>'+t('Tempo lavorato')+': '+elapsed(shift)+'</span></div></div>'+
      '<span class="pill '+(shift.status==='break'?'amber':'')+'">'+t(shift.status==='closed'?'Concluso':shift.status==='break'?'In pausa':'In corso')+'</span></div>';
    return head+metric+choose+controls+'<section class="card"><h2 style="margin-bottom:16px">'+t('Storico timbrature')+'</h2>'+
      (list.length?list.slice(0,60).map(row).join(''):'<p class="muted">'+t('Nessuna timbratura registrata.')+'</p>')+
      '<p class="muted" style="font-size:12px;margin-top:17px">'+t('Le ore sono indicative per il riepilogo operativo, non sostituiscono il cedolino o le registrazioni obbligatorie.')+'</p></section>';
  }
  function mediaMarkup(report){
    if(!report||!report.id)return '';
    if(!mediaReady)return '<div style="margin-top:12px">'+showMissing('media')+'</div>';
    const files=media.filter(m=>m.report_id===report.id);
    const editable=ownReport(report);
    const photos=phase=>{
      const found=files.filter(m=>m.kind===phase);
      return '<div><h3 style="margin-bottom:9px">'+t(phase==='before'?'Foto prima':'Foto dopo')+
        ' <span class="pill">'+found.length+'/'+PHOTO_LIMIT+'</span></h3>'+
        '<div class="eg-media-grid">'+found.map(m=>mediaTile(m,editable)).join('')+'</div>'+
        (editable&&found.length<PHOTO_LIMIT?
          '<label class="field eg-upload">'+t('Aggiungi foto')+
          '<input type="file" data-ops-input="'+phase+'" data-report-id="'+safeText(report.id)+'" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple></label>':'')+
        '</div>';
    };
    const signature=files.find(m=>m.kind==='signature');
    const signatureHtml='<div><h3>'+t('Firma cliente')+'</h3>'+
      (signature?'<p class="muted" style="font-size:12px">'+safeText(signature.signer_name||'')+' · '+dateTime(signature.uploaded_at)+'</p>'+
        '<div class="eg-signature-preview">'+mediaTile(signature,editable)+'</div>':
        editable?'<button class="secondary small" data-action="ops-sign-open" data-report-id="'+safeText(report.id)+'">'+t('Raccogli firma sullo schermo')+'</button>':
        '<p class="muted">'+t('Nessuna firma registrata.')+'</p>')+
      (editable&&signingReportId===report.id?signFormMarkup(report.id):'')+
      '<p class="muted" style="font-size:12px;margin-top:10px">'+t('La firma documenta la presa visione sul posto: non è una firma elettronica qualificata.')+'</p></div>';
    return '<div class="eg-media-section"><h3 style="margin-bottom:13px">'+t('Foto e firme')+'</h3>'+
      '<div class="two">'+photos('before')+photos('after')+'</div>'+signatureHtml+'</div>';
  }
  function mediaTile(m,editable){
    const signed=mediaUrls.get(m.storage_path)?.url;
    return '<div class="eg-photo-tile">'+
      (signed?'<a href="'+safeText(signed)+'" target="_blank" rel="noopener noreferrer">'+
        '<img src="'+safeText(signed)+'" loading="lazy" alt="'+t(m.kind==='signature'?'Firma cliente':m.kind==='before'?'Foto prima':'Foto dopo')+'"></a>':
        '<div class="muted">'+t('Anteprima non disponibile. Ricarica la pagina.')+'</div>')+
      (editable?'<button class="ghost small" data-action="ops-media-delete" data-media-id="'+safeText(m.id)+'">'+t('Elimina allegato')+'</button>':'')+
      '</div>';
  }
  function signFormMarkup(reportId){
    return '<form data-form="ops-signature" data-report-id="'+safeText(reportId)+'" class="stacked eg-signature-form">'+
      '<label class="field">'+t('Nome e cognome del firmatario')+
      '<input name="signer_name" type="text" minlength="2" maxlength="120" autocomplete="name" required></label>'+
      '<p class="muted">'+t('Il cliente firma direttamente sullo schermo del dispositivo.')+'</p>'+
      '<canvas data-ops-signature="true" width="900" height="280" aria-label="'+t('Area firma')+'"></canvas>'+
      '<div class="actions"><button type="button" class="ghost small" data-action="ops-sign-clear">'+t('Cancella tratto')+'</button></div>'+
      '<label class="eg-check"><input type="checkbox" name="consent" required>'+
      '<span>'+t('Confermo che il firmatario è presente e acconsente alla registrazione della propria firma sul rapporto.')+'</span></label>'+
      '<div class="actions"><button class="primary" type="submit">'+t('Salva firma')+'</button>'+
      '<button class="ghost" type="button" data-action="ops-sign-cancel">'+t('Annulla')+'</button></div></form>';
  }
  async function clock(action) {
    if(!canClock())throw Error(tr('Solo i dipendenti possono timbrare.'));
    if(!shiftsReady)throw Error(tr('Attiva prima la migrazione delle presenze su Supabase.'));
    const ctx=context();
    const site=action==='clock_in'?document.getElementById('ops-clock-site')?.value||null:null;
    const {error}=await client.rpc('eg_shift_action',{
      p_company_id:ctx.companyId,p_action:action,p_site_id:site
    });
    if(error)throw error;
    await ctx.reload();
    onSuccess(tr('Timbratura registrata.'));
  }
  async function normalizeImage(file){
    const accepted=new Set(['image/jpeg','image/png','image/webp']);
    if(accepted.has(file.type)&&file.size<=MAX_IMAGE_SIZE)return file;
    if(!file.type.startsWith('image/') || /svg|gif/i.test(file.type))
      throw Error(tr('Formato immagine non supportato.'));
    // Converte HEIC/HEIF e foto grandi in JPEG limitato; Safari deve poter leggere il file.
    const bitmap=await createImageBitmap(file);
    const ratio=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8));
    if(!blob||blob.size>MAX_IMAGE_SIZE)throw Error(tr('Immagine troppo grande. Scegli una foto più piccola.'));
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  }
  async function reserveUpload({reportId,kind,file,signerName=null,consent=false}){
    const {data,error}=await client.rpc('eg_media_reserve',{
      p_report_id:reportId,p_kind:kind,p_mime:file.type,p_bytes:file.size,
      p_signer_name:signerName,p_consent:consent
    });
    if(error)throw error;
    if(!data?.id||!data?.path)throw Error(tr('Impossibile prenotare il caricamento.'));
    return data;
  }
  async function uploadFile({reportId,kind,file,signerName=null,consent=false}){
    const r=await reserveUpload({reportId,kind,file,signerName,consent});
    try{
      const {error}=await client.storage.from(BUCKET).upload(r.path,file,{
        contentType:file.type,cacheControl:'120',upsert:false
      });
      if(error)throw error;
      const done=await client.rpc('eg_media_finalize',{p_media_id:r.id});
      if(done.error)throw done.error;
    }catch(e){
      try{
        // Cleanup best effort; never silently claim an incomplete upload succeeded.
        await client.storage.from(BUCKET).remove([r.path]);
        await client.rpc('eg_media_release',{p_media_id:r.id});
      }catch{}
      throw e;
    }
  }
  async function uploadPhotos(input){
    const reportId=input.dataset.reportId,kind=input.dataset.opsInput;
    if(!['before','after'].includes(kind))return;
    const ctx=context(),r=ctx.reports.find(x=>x.id===reportId);
    if(!ownReport(r))throw Error(tr('Rapporto non modificabile.'));
    const selected=[...(input.files||[])];
    if(!selected.length)return;
    const current=media.filter(m=>m.report_id===reportId&&m.kind===kind).length;
    if(current+selected.length>PHOTO_LIMIT)throw Error(tr('Massimo tre fotografie per fase.'));
    for(const f of selected){
      const normalized=await normalizeImage(f);
      await uploadFile({reportId,kind,file:normalized});
    }
    input.value='';
    await ctx.reload();
    onSuccess(tr('Fotografie caricate nel deposito privato.'));
  }
  function point(canvas,e){
    const rect=canvas.getBoundingClientRect();
    return {
      x:(e.clientX-rect.left)*(canvas.width/rect.width),
      y:(e.clientY-rect.top)*(canvas.height/rect.height)
    };
  }
  function pointerStart(e){
    if(!e.target?.matches?.('canvas[data-ops-signature]'))return;
    e.preventDefault();
    const c=e.target,ctx=c.getContext('2d');
    ctx.strokeStyle='#193f2f';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
    drawing=true;lastPoint=point(c,e);
    ctx.beginPath();ctx.arc(lastPoint.x,lastPoint.y,1.9,0,Math.PI*2);ctx.fillStyle='#193f2f';ctx.fill();
    signatureDrawn=true;
    c.setPointerCapture?.(e.pointerId);
  }
  function pointerMove(e){
    if(!drawing||!e.target?.matches?.('canvas[data-ops-signature]'))return;
    e.preventDefault();
    const c=e.target,ctx=c.getContext('2d'),next=point(c,e);
    ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(next.x,next.y);ctx.stroke();
    lastPoint=next;
  }
  function pointerEnd(){drawing=false;lastPoint=null}
  async function saveSignature(form){
    const ctx=context(),reportId=form.dataset.reportId;
    const report=ctx.reports.find(x=>x.id===reportId);
    if(!ownReport(report))throw Error(tr('Rapporto non modificabile.'));
    if(!signatureDrawn)throw Error(tr('Il cliente deve firmare nell’area dedicata.'));
    const name=String(form.querySelector('[name="signer_name"]')?.value||'').trim();
    const consent=!!form.querySelector('[name="consent"]')?.checked;
    if(name.length<2||!consent)throw Error(tr('Nome e consenso del firmatario obbligatori.'));
    const canvas=form.querySelector('canvas[data-ops-signature]');
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob||blob.size>MAX_IMAGE_SIZE)throw Error(tr('Impossibile salvare la firma.'));
    await uploadFile({reportId,kind:'signature',file:blob,signerName:name,consent:true});
    signingReportId=null;signatureDrawn=false;
    await ctx.reload();
    onSuccess(tr('Firma salvata in archivio privato.'));
  }
  async function deleteMedia(id) {
    const m=media.find(x=>x.id===id),ctx=context(),report=ctx.reports.find(x=>x.id===m?.report_id);
    if(!m||!ownReport(report))throw Error(tr('Allegato non modificabile.'));
    if(!confirm(tr('Eliminare definitivamente questo allegato?')))return;
    const removed=await client.storage.from(BUCKET).remove([m.storage_path]);
    if(removed.error)throw removed.error;
    const result=await client.rpc('eg_media_release',{p_media_id:m.id});
    if(result.error)throw result.error;
    mediaUrls.delete(m.storage_path);
    await ctx.reload();
    onSuccess(tr('Allegato eliminato.'));
  }
  async function handleAction(b){
    const a=b.dataset.action;
    if(a==='ops-clock')return clock(b.dataset.opsType);
    if(a==='ops-media-delete')return deleteMedia(b.dataset.mediaId);
    if(a==='ops-sign-open'){
      const report=context().reports.find(x=>x.id===b.dataset.reportId);
      if(!ownReport(report))throw Error(tr('Rapporto non modificabile.'));
      signingReportId=report.id;signatureDrawn=false;rerender();
      document.querySelector?.('form[data-form="ops-signature"]')?.scrollIntoView?.({behavior:'smooth'});
      return;
    }
    if(a==='ops-sign-cancel'){signingReportId=null;signatureDrawn=false;rerender();return}
    if(a==='ops-sign-clear'){
      const canvas=document.querySelector('canvas[data-ops-signature]');
      canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
      signatureDrawn=false;return;
    }
  }
  function handleChange(el){
    if(el.dataset.opsFilter==='worker'){selectedWorker=el.value;rerender();return true}
    return false;
  }
  return {
    refresh,clockMarkup,mediaMarkup,uploadPhotos,saveSignature,handleAction,handleChange,
    pointerStart,pointerMove,pointerEnd,
    reset:()=>{shifts=[];media=[];shiftsReady=false;mediaReady=false;mediaUrls.clear();signingReportId=null}
  };
};