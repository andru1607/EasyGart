'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const raw=fs.readFileSync(path.join(__dirname,'../cloud/import_parser.js'),'utf8');
const sandbox={window:{}};
vm.runInNewContext(raw,sandbox);
const p=sandbox.window.EASYGART_IMPORT_PARSER;
const staff=[{user_id:'u1',full_name:'Marco Rossi'},{user_id:'u2',full_name:'Luca Bianchi'}];
const sites=[{id:'s1',name:'Giardino Rossi'},{id:'s2',name:'Villa Arco'}];
const parse=text=>p.hours(text,{members:staff,sites,year:2026});
test('converts multiple old-day entries with workers and sites',()=>{
 const rows=parse('15/11/2026\nMarco Rossi 08:00 16:30 pausa 30 Giardino Rossi\nLuca Bianchi 07:30 14:30 Villa Arco');
 assert.equal(rows.length,2);assert.equal(rows[0].worker_id,'u1');
 assert.equal(rows[0].work_date,'2026-11-15');assert.equal(rows[0].break_minutes,30);
 assert.equal(rows[1].site_id,'s2');
});
test('dotted dates are not mistaken for an hour',()=>{
 const rows=parse('15.11.2026 Luca Bianchi 9.00 - 17.00 pausa 45 Villa Arco');
 assert.equal(rows.length,1);assert.equal(rows[0].start_time,'09:00');
 assert.equal(rows[0].end_time,'17:00');
});
test('missing year is flagged, invalid times ignored',()=>{
 assert.equal(parse('15/11 Marco Rossi 08:00 16:00 Giardino Rossi')[0].year_guessed,true);
 assert.equal(parse('15/11/2026 Marco Rossi 08:00 19:00 pausa 900 Giardino Rossi').length,0);
 assert.equal(parse('32/11/2026 Marco Rossi 08:00 16:00').length,0);
});
test('client contacts de-duplicate and keep details',()=>{
 const rows=p.clients('Nome: Mario Rossi\nTelefono: +39 349 123 4567\nEmail: mario@example.it\nIndirizzo: Via Roma 12\n\nNome: Mario Rossi');
 assert.equal(rows.length,1);
 assert.equal(rows[0].email,'mario@example.it');
 assert.equal(rows[0].address,'Via Roma 12');
});
test('simple client name lists become multiple rows',()=>{
 const rows=p.clients('Mario Rossi\nLuigi Verdi\nSilvia Grandi');
 assert.deepEqual(Array.from(rows,x=>x.name),['Mario Rossi','Luigi Verdi','Silvia Grandi']);
});
