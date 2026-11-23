/* EasyGart screenshot parser: conservative extraction. No network, no storage. */
'use strict';
(function(root){
  const tidy = v=>String(v||'').replace(/\u00a0/g,' ').trim();
  const norm = v=>tidy(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const isoDate = (value,defaultYear=new Date().getFullYear())=>{
    const s=tidy(value);
    let year,month,day,guessed=false;
    let m=s.match(/\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
    if(m){year=+m[1];month=+m[2];day=+m[3]}
    else {
      m=s.match(/\b(\d{1,2})([\/.-])(\d{1,2})(?:[\/.-](\d{2}|20\d{2}))?\b/);
      if(!m||m[2]==='-'&&!m[4])return null;
      day=+m[1];month=+m[3];
      guessed=!m[4];year=m[4]?(m[4].length===2?2000+(+m[4]):+m[4]):defaultYear;
    }
    if(year<2020||year>2099)return null;
    const dt=new Date(Date.UTC(year,month-1,day));
    if(dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)return null;
    return {date:[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-'),guessed};
  };
  const timeRegex=/(?:^|[^\d])([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?!\d)/g;
  const times = value=>[...tidy(value).matchAll(timeRegex)].map(m=>String(+m[1]).padStart(2,'0')+':'+m[2]);
  const pause = value=>{
    const m=tidy(value).match(/\b(?:pausa|pause|break|pausen?)\s*[:=]?\s*(\d{1,3})\s*(?:min(?:uti|uten)?)?\b/i);
    return m?Math.min(600,+m[1]):0;
  };
  const duration=(start,end,breakMinutes)=>{
    const toMinutes=v=>{if(!/^\d\d:\d\d$/.test(v))return NaN;const [h,m]=v.split(':').map(Number);return h*60+m;};
    const delta=(toMinutes(end)-toMinutes(start)+1440)%1440;
    return delta>0&&delta<=960&&Number.isInteger(breakMinutes)&&breakMinutes>=0&&breakMinutes<delta?delta-breakMinutes:null;
  };
  const matchName=(source,list,key)=>{
    const text=norm(source);
    const matches=(list||[]).filter(x=>{const name=norm(x[key]);return name.length>=3&&text.includes(name)});
    return matches.length===1?matches[0].id||matches[0].user_id||'':'';
  };
  function hours(source,{members=[],sites=[],year=new Date().getFullYear()}={}){
    const rows=[],seen=new Set();let headingDate=null,headingWorker='',headingSite='';
    const toM=v=>Number(v.slice(0,2))*60+Number(v.slice(3,5));
    for(const line of String(source||'').replace(/\r/g,'').split('\n').map(tidy).filter(Boolean)){
      const date=isoDate(line,year);
      if(date&&(!headingDate||date.date!==headingDate.date)){headingWorker='';headingSite=''}
      if(date)headingDate=date;
      const workerOnLine=matchName(line,members,'full_name');
      const siteOnLine=matchName(line,sites,'name');
      if(workerOnLine)headingWorker=workerOnLine;
      if(siteOnLine)headingSite=siteOnLine;
      const withoutDate=date?line.replace(/\b(?:20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/.-]\d{1,2}[\/.-](?:20\d{2}|\d{2})|\d{1,2}[\/.]\d{1,2})\b/,' '):line;
      let found=times(withoutDate);
      if(found.length<2){
        const short=[...withoutDate.matchAll(/\b([01]?\d|2[0-3])\s*[-–]\s*([01]?\d|2[0-3])\b/g)];
        if(short.length&&short.length<=4)found=short.flatMap(m=>
          [String(+m[1]).padStart(2,'0')+':00',String(+m[2]).padStart(2,'0')+':00']);
      }
      const when=date||headingDate;
      if(!when||found.length<2||found.length%2!==0||found.length>8)continue;
      let worked=0,valid=true,previousEnd=null;
      for(let i=0;i<found.length;i+=2){
        const part=duration(found[i],found[i+1],0);
        if(part===null||(previousEnd!==null&&toM(found[i])<previousEnd)){valid=false;break}
        worked+=part;previousEnd=toM(found[i+1]);
      }
      if(!valid)continue;
      const startTime=found[0],endTime=found[found.length-1];
      const elapsed=(toM(endTime)-toM(startTime)+1440)%1440;
      if(!elapsed||worked>elapsed)continue;
      const explicitPause=pause(line);
      const breakMinutes=found.length>2?elapsed-worked:explicitPause;
      const pause_warning=found.length>2&&explicitPause>0&&explicitPause!==breakMinutes;
      if(duration(startTime,endTime,breakMinutes)===null)continue;
      const workerId=workerOnLine||headingWorker,siteId=siteOnLine||headingSite;
      const row={include:true,work_date:when.date,worker_id:workerId,site_id:siteId,
        start_time:startTime,end_time:endTime,break_minutes:breakMinutes,
        work_summary:'',source_line:line.slice(0,300),year_guessed:when.guessed,pause_warning,
        confidence:workerId&&siteId&&!when.guessed?'review':'incomplete',
        status:'pending',error:''};
      const fingerprint=[row.work_date,row.worker_id,row.site_id,row.start_time,row.end_time,row.break_minutes].join('|');
      if(seen.has(fingerprint))continue;seen.add(fingerprint);
      rows.push(row);if(rows.length>=60)break;
    }
    return rows;
  }
  const safeEmail=s=>{const m=tidy(s).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);return m?m[0].toLowerCase():''};
  const safePhone=s=>{
    const m=tidy(s).match(/(?:(?:\+|00)\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*){2,5}\d{2,4}/);
    const p=m?m[0].trim():'';
    return p.replace(/\D/g,'').length>=7&&p.replace(/\D/g,'').length<=17?p:'';
  };
  function clients(source){
    const skip=/^(?:note|notizen|contatti|kontakte|modifica|bearbeiten|fine|fatto|done|cerca|ricerca|nuova nota|titolo|clienti|kunden|elenco|copia|paste|seleziona|selezionare)$/i;
    const lines=String(source||'').replace(/\r/g,'').split('\n');
    const blocks=[];let block=[];
    function flush(){if(block.length){blocks.push(block);block=[]}}
    for(const original of lines){
      const line=tidy(original);
      if(!line){flush();continue}
      const named=/^(?:cliente|kunde|nome|name|azienda|company)\s*:/i.test(line);
      const detail=/^(?:indirizzo|adresse|address|via|viale|vicolo|piazza|corso|strada|straße|strasse|tel|telefono|cell|cellulare|telefon|phone|handy|mobil|email|e-mail)\b/i.test(line)||
        /^[+\d][\d\s().-]{6,}$/.test(line)||line.includes('@');
      const hasName=block.some(x=>/^(?:cliente|kunde|nome|name|azienda|company)\s*:/i.test(x)||
        (!/^(?:indirizzo|adresse|address|via|viale|vicolo|piazza|corso|strada|straße|strasse|tel|telefono|cell|cellulare|telefon|phone|handy|mobil|email|e-mail)\b/i.test(x)&&
        !x.includes('@')&&!/^[+\d][\d\s().-]{6,}$/.test(x)));
      if(block.length&&hasName&&(named||!detail))flush();
      block.push(line);
    }
    flush();
    const rows=[],seen=new Set();
    for(const blk of blocks){
      const fields={name:'',phone:'',email:'',address:''};
      const labelRx=/^(nome|name|cliente|kunde|azienda|firma|company)\s*:\s*(.+)$/i;
      for(const line of blk){
        const n=line.match(labelRx);
        if(n&&!fields.name){fields.name=tidy(n[2]);continue}
        const address=line.match(/^(?:indirizzo|adresse|address)\s*:\s*(.+)$/i);
        const street=line.match(/^(?:via|viale|vicolo|piazza|corso|strada|straße|strasse)\b\s+(.+)$/i);
        if((address||street)&&!fields.address){fields.address=address?tidy(address[1]):line;continue}
        const em=safeEmail(line);if(em&&!fields.email)fields.email=em;
        const phone=line.match(/^(?:tel(?:efono)?|handy|mobil|phone)\s*:\s*(.+)$/i);
        if(phone&&!fields.phone)fields.phone=safePhone(phone[1])||tidy(phone[1]);
        else if(!fields.phone&&/\+\d{2}/.test(line))fields.phone=safePhone(line);
      }
      if(!fields.name){
        const possible=blk.filter(line=>!skip.test(line)&&
          !/^(?:tel|telefono|cell|cellulare|telefon|phone|email|e-mail|indirizzo|adresse|address|via|viale|vicolo|piazza|corso|strada|straße|strasse)\b/i.test(line)&&
          !line.includes('@')&&!/^(?:\+?\d[\d\s-]{6,})$/.test(line));
        if(possible.length===1)fields.name=possible[0];
        else if(possible.length===0)continue;
        else {
          // A list of names without contact lines can be one client per line.
          if(blk.every(x=>!x.includes(':')&&!x.includes('@')&&x.length<=100)){
            for(const item of possible){const key=norm(item);if(key.length>2&&!seen.has(key)){rows.push({
              include:true,name:item,phone:'',email:'',address:'',status:'pending',error:''
            });seen.add(key)}}
            continue;
          }
          fields.name=possible[0];
        }
      }
      fields.name=tidy(fields.name).slice(0,150);
      if(fields.name.length<2||skip.test(fields.name)||/^\d[\d\s/-]+$/.test(fields.name))continue;
      const key=norm(fields.name);if(seen.has(key))continue;seen.add(key);
      rows.push({include:true,name:fields.name,phone:fields.phone.slice(0,80),
        email:fields.email.slice(0,200),address:fields.address.slice(0,300),status:'pending',error:''});
      if(rows.length>=60)break;
    }
    return rows;
  }
  const api={hours,clients,isoDate,duration,norm};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.EASYGART_IMPORT_PARSER=api;
})(typeof window!=='undefined'?window:{});
