import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';

const archiveSource=readFileSync(new URL('../cloud/archive.js',import.meta.url),'utf8');
const businessSource=readFileSync(new URL('../cloud/business.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../cloud/index.html',import.meta.url),'utf8');
const context=createContext({window:{},TextEncoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob,Set,Promise,Number,String});
new Script(archiveSource).runInContext(context,{timeout:2000});
const archive=context.window.EASYGART_ARCHIVE;

function unpack(zip){
  const buffer=Buffer.from(zip);
  const entries={};
  let offset=0;
  while(offset+30<=buffer.length && buffer.readUInt32LE(offset)===0x04034b50){
    const crc=buffer.readUInt32LE(offset+14);
    const len=buffer.readUInt32LE(offset+18);
    const filenameLength=buffer.readUInt16LE(offset+26);
    const extraLength=buffer.readUInt16LE(offset+28);
    const name=buffer.toString('utf8',offset+30,offset+30+filenameLength);
    const start=offset+30+filenameLength+extraLength;
    const content=buffer.subarray(start,start+len);
    assert.equal(content.byteLength,len);
    assert.equal(crc32(content),crc,'CRC mismatch for '+name);
    entries[name]=content;
    offset=start+len;
  }
  assert.equal(buffer.readUInt32LE(buffer.length-22),0x06054b50,'ZIP end of central directory');
  assert.equal(buffer.readUInt16LE(buffer.length-22+10),Object.keys(entries).length);
  return entries;
}
function crc32(bytes){
  let c=0xffffffff;
  for(const byte of bytes){
    c^=byte;
    for(let i=0;i<8;i++)c=(c&1)?(c>>>1)^0xedb88320:c>>>1;
  }
  return (c^0xffffffff)>>>0;
}
test('ZIP archive contains valid central directory, UTF-8 filenames and original bytes',async()=>{
  const zipped=await archive.createZip([
    {name:'easygart-export.json',data:JSON.stringify({company:'demo',emoji:'🍃'})},
    {name:'allegati/111/222/before/333.png',data:new Blob([Uint8Array.from([137,80,78,71,0,1,2,255])])},
    {name:'allegati/111/222/signature/444.png',data:Uint8Array.from([1,2,3,4])}
  ]);
  assert.equal(zipped.type,'application/zip');
  const entries=unpack(await zipped.arrayBuffer());
  assert.equal(JSON.parse(entries['easygart-export.json'].toString('utf8')).company,'demo');
  assert.deepEqual([...entries['allegati/111/222/before/333.png']],[137,80,78,71,0,1,2,255]);
  assert.deepEqual([...entries['allegati/111/222/signature/444.png']],[1,2,3,4]);
});
test('ZIP rejects traversal paths, invalid separators, duplicate names and huge payloads',async()=>{
  const a=Uint8Array.from([1,2,3]);
  for(const path of ['../evil','/absolute','a/../b','a//b','a\\evil','a/<tag>']){
    await assert.rejects(archive.createZip([{name:path,data:a}]),/Unsafe or duplicate/);
  }
  await assert.rejects(archive.createZip([
    {name:'a.json',data:a},{name:'a.json',data:a}
  ]),/Unsafe or duplicate/);
  await assert.rejects(archive.createZip([{name:'a.bin',data:new Uint8Array(1200)}],{maxBytes:1024}),/memory limit/);
});
test('ZIP feature is loaded before business module, does not use third-party services or public media URLs',()=>{
  assert.ok(html.indexOf('archive.js')<html.indexOf('business.js'));
  assert.match(businessSource,/window\.EASYGART_ARCHIVE\.createZip\(entries\)/);
  assert.match(businessSource,/client\.storage\.from\('eg-report-media'\)\.download\(relative\)/);
  assert.match(businessSource,/m\.status==='uploaded'/);
  assert.match(businessSource,/if\(!owner\(\)\|\|ctx\(\)\.companyId!==selectedCompany\)/);
  assert.match(businessSource,/Prepara ZIP con foto e firme/);
  assert.doesNotMatch(archiveSource,/fetch\(|getPublicUrl|XMLHttpRequest|service_role|localStorage/);
});
