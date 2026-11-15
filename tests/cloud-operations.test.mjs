import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';

const operations=readFileSync(new URL('../cloud/operations.js',import.meta.url),'utf8');
const attendanceSQL=readFileSync(new URL('../supabase/easygart_attendance_v1.sql',import.meta.url),'utf8');
const mediaSQL=readFileSync(new URL('../supabase/easygart_private_media_v1.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../cloud/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
test('operations JavaScript parses and loads before app',()=>{
  new Script(operations);
  assert.match(html,/<script src="\.\/operations\.js\?v=/);
  assert.ok(html.indexOf('operations.js')<html.indexOf('app.js?'));
  assert.match(app,/window\.createEasyGartOperations/);
});
test('all operations UI literals have dedicated German translations',()=>{
  const code=app.slice(app.indexOf('const german ='),app.indexOf('const tr ='));
  const dict=new Function(code+';return german')();
  const found=[...operations.matchAll(/\b(?:t|tr)\((?:'([^']+)'|"([^"]+)")\)/g)]
    .map(x=>x[1]??x[2]);
  const missing=[...new Set(found)].filter(x=>!Object.hasOwn(dict,x));
  assert.deepEqual(missing,[],'Missing German operations strings: '+missing.join(', '));
  for(const phrase of ['Zeiterfassung','Vorher-Fotos','Nachher-Fotos','Kundenunterschrift']){
    assert.ok(Object.values(dict).includes(phrase),phrase);
  }
});

test('attendance migration uses tenant RLS, audit events, server time and atomic actions',()=>{
  assert.match(attendanceSQL,/^begin;/m);
  assert.match(attendanceSQL,/^commit;/m);
  assert.match(attendanceSQL,/alter table public\.eg_shifts enable row level security/);
  assert.match(attendanceSQL,/alter table public\.eg_shift_events enable row level security/);
  assert.match(attendanceSQL,/revoke all on public\.eg_shifts,public\.eg_shift_events from public,anon,authenticated/);
  assert.match(attendanceSQL,/grant select on public\.eg_shifts,public\.eg_shift_events to authenticated/);
  assert.match(attendanceSQL,/private\.eg_is_owner\(company_id\)/);
  assert.match(attendanceSQL,/user_id=\(select auth\.uid\(\)\)/);
  assert.match(attendanceSQL,/create unique index if not exists eg_shifts_one_open_per_worker/);
  assert.match(attendanceSQL,/v_time timestamptz := clock_timestamp\(\)/);
  assert.match(attendanceSQL,/pg_advisory_xact_lock/);
  assert.match(attendanceSQL,/function public\.eg_shift_action/);
  assert.match(attendanceSQL,/p_action='clock_in'/);
  assert.match(attendanceSQL,/p_action='break_start'/);
  assert.match(attendanceSQL,/p_action='break_end'/);
  assert.match(attendanceSQL,/p_action='clock_out'/);
  assert.doesNotMatch(attendanceSQL,/grant (insert|update|delete) on public\.eg_shifts to authenticated/);
});
test('private media migrations restrict Storage to authorized bucket, reports and roles',()=>{
  assert.match(mediaSQL,/^begin;/m);
  assert.match(mediaSQL,/^commit;/m);
  assert.match(mediaSQL,/values\('eg-report-media','eg-report-media',false,5242880/);
  assert.match(mediaSQL,/allowed_mime_types/);
  assert.match(mediaSQL,/alter table public\.eg_report_media enable row level security/);
  assert.match(mediaSQL,/grant select on public\.eg_report_media to authenticated/);
  assert.match(mediaSQL,/status='uploaded'/);
  assert.match(mediaSQL,/r\.status in \('draft','changes_requested'\)/);
  assert.match(mediaSQL,/m\.author_id=auth\.uid\(\)/);
  assert.match(mediaSQL,/bucket_id='eg-report-media' and private\.eg_media_can_read\(name\)/);
  assert.match(mediaSQL,/bucket_id='eg-report-media' and private\.eg_media_can_upload\(name\)/);
  assert.match(mediaSQL,/bucket_id='eg-report-media' and private\.eg_media_can_delete\(name\)/);
  assert.match(mediaSQL,/create unique index if not exists eg_report_one_signature/);
  assert.match(mediaSQL,/v_count >= \(case when p_kind='signature' then 1 else 3 end\)/);
  assert.match(mediaSQL,/not exists \(\s*select 1 from storage\.objects/m);
  assert.match(mediaSQL,/function public\.eg_media_reserve/);
  assert.match(mediaSQL,/function public\.eg_media_finalize/);
  assert.match(mediaSQL,/function public\.eg_media_release/);
  assert.doesNotMatch(mediaSQL.replace(/^--[^\n]*/gm,''),/getPublicUrl|service_role|sb_secret_/);
  for(const tag of ['eg_check','eg_read','eg_upload','eg_delete','eg_reserve','eg_finalize','eg_release']){
    assert.equal(mediaSQL.split('$'+tag+'$').length-1,2,'SQL tag '+tag+' must be paired');
  }
});
function fakeContext(opts={}){
  const data={
    shifts:opts.shifts||[],
    media:opts.media||[],
    calls:[],
  };
  let user={id:opts.userId||'worker-1'};
  let owner=!!opts.owner;
  const members=[
    {user_id:'worker-1',full_name:'Anna',role:'worker',active:true},
    {user_id:'worker-2',full_name:'Marco',role:'worker',active:true},
    {user_id:'owner-1',full_name:'Capo',role:'owner',active:true},
  ];
  const reports=[
    {id:'report-1',created_by:'worker-1',company_id:'org-1',status:'draft'},
    {id:'report-2',created_by:'worker-2',company_id:'org-1',status:'approved'}
  ];
  const q=(table)=>({
    select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({
      data:table==='eg_shifts'?data.shifts:table==='eg_report_media'?data.media:[],error:null
    })},
  });
  const client={
    from:table=>q(table),
    rpc:async (name,args)=>{
      data.calls.push({name,args});
      if(name==='eg_media_reserve')return {data:{id:'media-new',path:'org-1/report-1/before/media-new.jpg'},error:null};
      return {data:'ok',error:null};
    },
    storage:{from:bucket=>{
      assert.equal(bucket,'eg-report-media');
      return {
        createSignedUrl:async path=>({data:{signedUrl:'https://private.test/signed?path='+encodeURIComponent(path)},error:null}),
        upload:async (path,file,options)=>{data.calls.push({name:'upload',path,mime:file.type,options});return {data:{path},error:null}},
        remove:async paths=>{data.calls.push({name:'remove',paths});return {data:[],error:null}}
      };
    }}
  };
  const body={
    document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null,
      addEventListener:()=>{},},
    window:{},confirm:()=>true,Date,Intl,Math,Number,String,Array,Object,Map,Set,Promise,console,
  };
  const ctx=createContext(body);
  new Script(operations).runInContext(ctx,{timeout:1000});
  let renders=0,loads=0,messages=[];
  const bridge={
    client,
    getContext:()=>({user,companyId:'org-1',isOwner:owner,
      members,sites:[{id:'site-1',name:'Giardino'}],reports,tasks:[],locale:'it',
      reload:async()=>{loads++}}),
    t:s=>s,tr:s=>s,esc:s=>String(s??'').replaceAll('<','&lt;'),
    onSuccess:message=>messages.push(message),
    rerender:()=>{renders++},
  };
  const ops=ctx.window.createEasyGartOperations(bridge);
  return {ops,data,bridge,setUser:u=>user={id:u},setOwner:x=>owner=x,
    get messages(){return messages},get renders(){return renders},get loads(){return loads}};
}
test('worker clock displays personal shifts and owner sees team history',async()=>{
  const h=fakeContext({shifts:[
    {id:'shift-1',company_id:'org-1',user_id:'worker-1',site_id:'site-1',started_at:'2026-11-15T08:00:00Z',
      ended_at:'2026-11-15T12:00:00Z',break_seconds:600,status:'closed'},
    {id:'shift-2',company_id:'org-1',user_id:'worker-2',site_id:'site-1',started_at:'2026-11-15T10:00:00Z',
      ended_at:'2026-11-15T11:00:00Z',break_seconds:0,status:'closed'}
  ]});
  await h.ops.refresh('org-1');
  assert.match(h.ops.clockMarkup(),/Anna/);
  assert.doesNotMatch(h.ops.clockMarkup(),/Marco/);
  h.setOwner(true);
  assert.match(h.ops.clockMarkup(),/Marco/);
  assert.match(h.ops.clockMarkup(),/Turni conclusi/);
});
test('clock action calls server RPC without accepting client-supplied timestamp',async()=>{
  const h=fakeContext();
  await h.ops.refresh('org-1');
  await h.ops.handleAction({dataset:{action:'ops-clock',opsType:'clock_in'}});
  const call=h.data.calls.find(x=>x.name==='eg_shift_action');
  assert.equal(call.args.p_company_id,'org-1');
  assert.equal(call.args.p_action,'clock_in');
  assert.equal(Object.keys(call.args).includes('timestamp'),false);
  assert.equal(h.loads,1);
  h.setOwner(true);
  await assert.rejects(h.ops.handleAction({dataset:{action:'ops-clock',opsType:'clock_in'}}),/dipendenti/);
});
test('photo uploads use private bucket, authorized report and server reservation, max 3 per phase',async()=>{
  const h=fakeContext();
  await h.ops.refresh('org-1');
  const report={id:'report-1',status:'draft',created_by:'worker-1'};
  assert.match(h.ops.mediaMarkup(report),/data-ops-input="before"/);
  assert.match(h.ops.mediaMarkup(report),/data-ops-input="after"/);
  const input={dataset:{reportId:'report-1',opsInput:'before'},
    files:[{type:'image/jpeg',size:120,name:'foto.jpg'}],value:'fake'};
  await h.ops.uploadPhotos(input);
  assert.ok(h.data.calls.find(x=>x.name==='eg_media_reserve'));
  const upload=h.data.calls.find(x=>x.name==='upload');
  assert.equal(upload.options.upsert,false);
  assert.equal(upload.mime,'image/jpeg');
  assert.ok(h.data.calls.find(x=>x.name==='eg_media_finalize'));
  assert.equal(h.loads,1);
  const tooMany={dataset:{reportId:'report-1',opsInput:'after'},
    files:new Array(4).fill({type:'image/jpeg',size:120,name:'foto.jpg'}),value:'fake'};
  await assert.rejects(h.ops.uploadPhotos(tooMany),/tre fotografie/);
});
test('submitted reports never expose photo uploads or signature editing',async()=>{
  const h=fakeContext({media:[{id:'m1',report_id:'report-1',kind:'before',
    storage_path:'org-1/report-1/before/m1.jpg',status:'uploaded'}]});
  await h.ops.refresh('org-1');
  const html=h.ops.mediaMarkup({id:'report-1',created_by:'worker-1',status:'submitted'});
  assert.match(html,/signed\?path/);
  assert.doesNotMatch(html,/data-ops-input/);
  assert.doesNotMatch(html,/ops-sign-open/);
  assert.doesNotMatch(html,/getPublicUrl/);
});
test('missing migrations are visible without crashing the remaining modules',async()=>{
  const h=fakeContext();
  await h.ops.refresh('org-1');
  h.ops.reset();
  assert.match(h.ops.clockMarkup(),/migrazione SQL/);
  assert.match(h.ops.mediaMarkup({id:'report-1'}),/migrazione SQL/);
});
test('signature panel asks for consent and explains limits of on-site signature',async()=>{
  const h=fakeContext();
  await h.ops.refresh('org-1');
  await h.ops.handleAction({dataset:{action:'ops-sign-open',reportId:'report-1'}});
  const html=h.ops.mediaMarkup({id:'report-1',created_by:'worker-1',status:'draft'});
  assert.match(html,/canvas data-ops-signature/);
  assert.match(html,/type="checkbox" name="consent" required/);
  assert.match(html,/non è una firma elettronica qualificata/);
  assert.match(html,/data-form="ops-signature"/);
});
test('signature drawing requires a real stroke, consent and the signatory name',async()=>{
  const h=fakeContext();
  await h.ops.refresh('org-1');
  await h.ops.handleAction({dataset:{action:'ops-sign-open',reportId:'report-1'}});
  const fakeCanvas={
    width:900,height:280,
    getBoundingClientRect:()=>({left:0,top:0,width:900,height:280}),
    setPointerCapture(){},
    getContext:()=>({
      beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},drawImage(){},
    }),
    toBlob(callback){callback({type:'image/png',size:1024})},
    toDataURL:()=> 'data:image/png;base64,fake',
  };
  const inputName={value:'Kunde Muster'},consent={checked:true};
  const form={
    dataset:{reportId:'report-1'},
    querySelector:selector=>{
      if(selector==='[name="signer_name"]')return inputName;
      if(selector==='[name="consent"]')return consent;
      if(selector==='canvas[data-ops-signature]')return fakeCanvas;
      return null;
    }
  };
  await assert.rejects(h.ops.saveSignature(form),/deve firmare/);
  h.ops.pointerStart({
    target:{matches:x=>x==='canvas[data-ops-signature]',...fakeCanvas},
    pointerId:1,clientX:15,clientY:20,preventDefault(){}
  });
  h.ops.pointerEnd();
  await h.ops.saveSignature(form);
  const reserved=h.data.calls.find(x=>x.name==='eg_media_reserve');
  assert.equal(reserved.args.p_kind,'signature');
  assert.equal(reserved.args.p_mime,'image/png');
  assert.equal(reserved.args.p_signer_name,'Kunde Muster');
  assert.equal(reserved.args.p_consent,true);
  assert.ok(h.data.calls.some(x=>x.name==='eg_media_finalize'));
  assert.equal(h.loads,1);
});

test('signature is never auto-refreshed during drawing, even if the form loses focus',()=>{
  assert.match(app,/!operations\?\.isSigning\?\.\(\)/);
  assert.match(app,/operations\?\.captureSignature\?\.\(\)/);
  assert.match(app,/operations\?\.restoreSignature\?\.\(signature\)/);
  assert.match(operations,/touch-action:none|pointerStart/);
});

test('client never uses public URL, admin API or browser-supplied attendance times',()=>{
  assert.doesNotMatch(operations.replace(/\/\/[^\n]*/g,''),/getPublicUrl|service_role|sb_secret_|auth\.admin/);
  assert.match(operations,/createSignedUrl\(m\.storage_path,API_SIGNED_URL_TTL\)/);
  assert.match(operations,/p_action:action,p_site_id:site/);
});
