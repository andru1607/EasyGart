import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../cloud/import_parser.js',import.meta.url),'utf8');
const sandbox={window:{},Date};
runInNewContext(source,sandbox);
const parser=sandbox.window.EASYGART_IMPORT_PARSER;
const members=[{user_id:'worker-1',full_name:'Mario Rossi'},{user_id:'worker-2',full_name:'Luca Bianchi'}];
const sites=[{id:'site-1',name:'Villa Garda'}];

test('split shifts in Notes become one reviewed workday with gap as pause',()=>{
  const rows=parser.hours('12/11/2026\nMario Rossi 08:00-12:00 13:00-17:00 Villa Garda',{members,sites,year:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].work_date,'2026-11-12');
  assert.equal(rows[0].worker_id,'worker-1');
  assert.equal(rows[0].site_id,'site-1');
  assert.equal(rows[0].start_time,'08:00');
  assert.equal(rows[0].end_time,'17:00');
  assert.equal(rows[0].break_minutes,60);
});

test('date, worker, site on separate lines are carried to the hours row',()=>{
  const rows=parser.hours('15/11/2026\nMario Rossi\nVilla Garda\n8-12 13-17',{members,sites,year:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].work_date,'2026-11-15');
  assert.equal(rows[0].worker_id,'worker-1');
  assert.equal(rows[0].site_id,'site-1');
  assert.equal(rows[0].break_minutes,60);
});

test('8-12 is not silently interpreted as 8 December',()=>{
  assert.equal(parser.isoDate('8-12 13-17',2026),null);
  assert.equal(parser.hours('Mario Rossi 8-12 13-17',{members,sites,year:2026}).length,0);
});

test('explicit pause on single shift is retained',()=>{
  const rows=parser.hours('Luca Bianchi 12/11/2026 08:30-16:30 pausa 30',{members,sites,year:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].break_minutes,30);
});

test('conflicting pause in split shift requires visible warning',()=>{
  const rows=parser.hours('Mario Rossi 12/11/2026 08:00-12:00 13:00-17:00 pausa 30',{members,sites,year:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].pause_warning,true);
});

test('clients in a screenshot without blank separators are split correctly',()=>{
  const text='Mario Rossi\nVia Roma 12, Garda\nTel: 3331234567\nLuca Bianchi\nVia Verdi 9\nTel: 3456789012';
  const rows=parser.clients(text);
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,'Mario Rossi');
  assert.equal(rows[0].address,'Via Roma 12, Garda');
  assert.equal(rows[1].name,'Luca Bianchi');
  assert.equal(rows[1].address,'Via Verdi 9');
});

test('multiple structured client blocks retain phone and address',()=>{
  const rows=parser.clients('Nome: Mario Rossi\nTelefono: +39 3331234567\nIndirizzo: Via Roma 12\n\nNome: Luca Bianchi\nTelefono: +39 3456789012');
  assert.equal(rows.length,2);
  assert.equal(rows[0].phone,'+39 3331234567');
  assert.equal(rows[0].address,'Via Roma 12');
});

test('invalid calendar dates are rejected rather than silently corrected',()=>{
  assert.equal(parser.isoDate('31/02/2026',2026),null);
  assert.equal(parser.isoDate('2026-13-05',2026),null);
});
