/* EasyGart export ZIP: dependency-free, STORE method, CRC32, browser compatible.
 * Locally prepared export; it is NOT a PostgreSQL or Supabase Storage restore.
 * No network requests, persistent storage or third-party compression services. */
'use strict';
window.EASYGART_ARCHIVE=(()=>{
  const encoder=new TextEncoder();
  const LIMIT=100*1024*1024;
  const MAX_ENTRIES=350;
  const crcTable=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    crcTable[n]=c>>>0;
  }
  const crc32=buf=>{
    let crc=0xffffffff;
    for(let i=0;i<buf.length;i++)crc=(crc>>>8)^crcTable[(crc^buf[i])&255];
    return (crc^0xffffffff)>>>0;
  };
  const makeHeader=(len,signature)=>{
    const buffer=new Uint8Array(len),view=new DataView(buffer.buffer);
    view.setUint32(0,signature,true);
    return {buffer,view};
  };
  const validName=name=>typeof name==='string'&&name.length>0&&name.length<=300&&
    !name.startsWith('/')&&!name.includes('\\')&&!name.includes('\0')&&
    !name.split('/').some(segment=>segment===''||segment==='.'||segment==='..')&&
    /^[\w./-]+$/.test(name);
  const bytesFrom=async(data)=>{
    if(typeof data==='string')return encoder.encode(data);
    if(data instanceof Uint8Array)return data;
    if(data instanceof ArrayBuffer)return new Uint8Array(data);
    if(data&&typeof data.arrayBuffer==='function')return new Uint8Array(await data.arrayBuffer());
    throw Error('Unsupported archive entry');
  };
  async function createZip(entries,{maxBytes=LIMIT}={}){
    if(!Array.isArray(entries)||!entries.length||entries.length>MAX_ENTRIES)
      throw Error('Invalid archive entry count');
    if(!Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>LIMIT)throw Error('Invalid archive limit');
    const fileParts=[],centralParts=[],names=new Set();
    let offset=0,totalData=0,centralSize=0;
    for(const item of entries){
      const name=item?.name;
      if(!validName(name)||names.has(name))throw Error('Unsafe or duplicate archive path');
      names.add(name);
      const filename=encoder.encode(name);
      if(filename.byteLength>65535)throw Error('Archive filename too long');
      const payload=await bytesFrom(item.data);
      totalData+=payload.byteLength;
      if(payload.byteLength>0xffffffff||totalData>maxBytes)
        throw Error('Archive exceeds safe browser memory limit');
      const checksum=crc32(payload);
      // ZIP "store": no compression, no external packages, no executable content.
      const local=makeHeader(30,0x04034b50);
      local.view.setUint16(4,20,true);
      local.view.setUint16(6,0x0800,true); // UTF-8 names
      local.view.setUint16(8,0,true); // store
      local.view.setUint32(14,checksum,true);
      local.view.setUint32(18,payload.byteLength,true);
      local.view.setUint32(22,payload.byteLength,true);
      local.view.setUint16(26,filename.byteLength,true);
      fileParts.push(local.buffer,filename,payload);
      const central=makeHeader(46,0x02014b50);
      central.view.setUint16(4,20,true); central.view.setUint16(6,20,true);
      central.view.setUint16(8,0x0800,true);central.view.setUint16(10,0,true);
      central.view.setUint32(16,checksum,true);
      central.view.setUint32(20,payload.byteLength,true);
      central.view.setUint32(24,payload.byteLength,true);
      central.view.setUint16(28,filename.byteLength,true);
      central.view.setUint32(42,offset,true);
      centralParts.push(central.buffer,filename);
      centralSize+=46+filename.byteLength;
      offset+=30+filename.byteLength+payload.byteLength;
      if(offset+centralSize+22>0xffffffff)throw Error('ZIP exceeds format limit');
    }
    const footer=makeHeader(22,0x06054b50);
    footer.view.setUint16(8,entries.length,true);
    footer.view.setUint16(10,entries.length,true);
    footer.view.setUint32(12,centralSize,true);
    footer.view.setUint32(16,offset,true);
    return new Blob([...fileParts,...centralParts,footer.buffer],{type:'application/zip'});
  }
  return {createZip,MAX_BYTES:LIMIT,MAX_ENTRIES};
})();