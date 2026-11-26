import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('site labels are enriched without changing raw site names',()=>{
 const app=read('cloud/app.js');
 assert.ok(app.includes("client.rpc('eg_site_customer_names'"));
 assert.ok(app.includes("display_name:customer?s.name+' · '+customer:s.name"));
 for(const p of ['calendar','monthly','sites_history','eod','search','business','operations','import'])assert.ok(read('cloud/'+p+'.js').includes('display_name'),p);
});
test('name-only RPC is scoped to current company membership',()=>{
 const sql=read('supabase/easygart_site_customer_names_v1.sql');
 assert.ok(sql.includes('private.eg_is_member(p_company_id)'));
 assert.ok(sql.includes('where s.company_id=p_company_id'));
 assert.ok(sql.includes('jsonb_object_agg(s.id::text,c.name)'));
 assert.ok(sql.includes('security invoker'));
});
