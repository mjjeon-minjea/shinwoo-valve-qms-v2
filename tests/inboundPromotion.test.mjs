import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../src/lib/spcCore.js';
import {createHash} from 'node:crypto';
const source=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
function stats(api,fetch=()=>{throw new Error('network forbidden in offline tests');}) {
    const code=source('src/lib/inboundStats.js').replace(/^import .*;$/m,'').replace('export default','const defaultExports =').replaceAll('export ','');
    return new Function('api','LOCAL_API_URL','supabase','fetch',`${code}\nreturn {summarize,monthly,bySupplier,ppm,filterByPeriod,rangeFilter,loadInspections,loadMeasurements,clearInboundStatsCache,runSheetSync};`)(api,'http://offline.invalid',{auth:{getSession:async()=>({data:{session:{access_token:'offline-fixture'}}})}},fetch);
}
const rows=[{id:'a',date:'2026-01-01',supplier:'S1',totalQuantity:100,inspectionQuantity:5,defectQuantity:2,result:'불합격',inspectionReportNo:'RI-260101-1'},
    {id:'b',date:'2026-02-01',supplier:'S2',totalQuantity:100,inspectionQuantity:10,defectQuantity:0,result:'합격',inspectionReportNo:'RI-260201-1'}];
test('inbound exact denominator/quantity/count/month/provider aggregates + null zero denominator',()=>{
    const s=stats({});const a=s.summarize(rows);assert.equal(a.count,2);assert.equal(a.inQty,200);assert.equal(a.inspQty,15);assert.equal(a.ngCount,1);assert.equal(a.ngQty,2);assert.equal(a.defectRate,1);assert.equal(a.ppm,10000);
    assert.equal(s.summarize([]).defectRate,null);assert.equal(s.ppm(1,0),null);
    assert.equal(s.monthly(rows).length,2);assert.equal(s.bySupplier(rows).length,2);
    assert.equal(s.rangeFilter(rows,{start:'2026-01-01',end:'2026-01-31'}).length,1);
    assert.equal(s.filterByPeriod(rows,'month',new Date(2026,0,15)).length,1);
});
test('inbound loader is cached per table; failure not cached; >20k truncation never presented as ALL',async()=>{
    let calls=0;let mode='ok';const s=stats({fetch:async()=>{calls++;if(mode==='error')throw new Error('offline failure');return {ok:true,truncated:mode==='truncated',json:async()=>rows};}});
    await Promise.all([s.loadInspections(),s.loadInspections()]);assert.equal(calls,1);await s.loadInspections();assert.equal(calls,1);
    mode='error';s.clearInboundStatsCache();await assert.rejects(s.loadInspections());mode='ok';assert.equal((await s.loadInspections()).length,2);assert.equal(calls,3);
    mode='truncated';s.clearInboundStatsCache();await assert.rejects(s.loadMeasurements(),/20,000행 조회 상한/);
});
test('SPC known bad/missing/nonnumeric rows do not turn missing into numeric zero',()=>{
    const code=source('src/lib/inboundSpc.js').replace(/^import .*;$/gm,'').replace('export default','const defaultExports =').replaceAll('export ','');
    const keys=['buildD','normPct','pyRound','pyMean','pyStdev','grade'];
    const spc=new Function(...keys,'loadInspections','loadMeasurements','ymd',`${code}\nreturn {buildRows,riYmd,rowsInRange};`)(...keys.map(k=>core[k]),()=>{},()=>{},v=>v);
    const base={ri_no:'RI-260101-1',part_no:'P',item_name:'Synthetic',inspect_point:'x',kind:'수치',nominal:10,tol_upper:1,tol_lower:-1,x1:'0',x2:'10',x3:'',x4:'n/a',x5:null,source_row:1};
    const m=[base,{...base,source_row:2,nominal:''},{...base,source_row:3,kind:'문자'},{...base,source_row:4,missing_since:'2020-01-01',missing_seen:20},{...base,source_row:5,missing_confirmed_at:'2026-01-02'},{...base,source_row:6,review_reason:'정정 확인 대상'}];
    const {rows:actual,stat}=spc.buildRows(m,rows);assert.equal(actual.length,3);assert.deepEqual(actual[0].xs,[0,10]);assert.equal(actual[0].usl,11);assert.equal(actual[0].lsl,9);assert.equal(stat.dropMissing,1);
});
test('manual sync unit path: explicit token POST, confirmed failure propagates (network stub only)',async()=>{
    let calls=0;const s=stats({},async(url,opts)=>{calls++;assert.equal(url,'/api/sync-sheets');assert.equal(opts.method,'POST');assert.equal(opts.headers.Authorization,'Bearer offline-fixture');return {ok:false,status:401};});
    await assert.rejects(s.runSheetSync({timeoutMs:1000}));assert.equal(calls,1);
});
test('selected routes only and sync mock fallback absent; cron disabled',()=>{
    const d=source('src/components/Dashboard.jsx');for(const name of ['inbound_overview','inbound_suppliers','inbound_items','inbound_records'])assert.match(d,new RegExp(`case '${name}'`));
    assert.match(d,/case 'inbound_status': return <InboundItems initialTab="ncr"/);assert.doesNotMatch(d,/NcrInbox|NcrRecords|NcrDetail|qms_test_account/);
    assert.doesNotMatch(source('api/sync-sheets.js'),/MOCK_CSV|가상 Mock/);assert.equal(JSON.parse(source('vercel.json')).crons,undefined);
});
const ledgerUrl='https://docs.google.com/spreadsheets/d/offline-old/export?gid=0&format=csv';
const rawRow=(date='2026-07-13')=>({'업체명':'동일업체접두길게-가상','제품명':'Synthetic','입고일':date,'입고':'100','검사(함수)':'5','부적합':'0','인수검사 보고서 번호':`RI-${date.replaceAll('-','').slice(2)}-1`});
const csv=row=>Object.keys(row).join(',')+'\n'+Object.values(row).join(',');
function syncFixture({main=false,measurementMissing=false,existing=[]}={}) {
    const calls={fetch:0,auth:0,businessWrites:0,monitorWrites:0};
    const client={auth:{getUser:async()=>{calls.auth++;return {data:{user:{id:'offline-actor'}},error:null};}},from:table=>{
        const q={verb:'select',start:0,end:999,select(){return this;},order(){return this;},eq(){return this;},limit(){return this;},range(a,b){this.start=a;this.end=b;return this;},insert(){this.verb='insert';return this;},update(){this.verb='update';return this;},upsert(){this.verb='upsert';return this;},single(){return this.run(true);},then(resolve,reject){return this.run().then(resolve,reject);},async run(single){
            if(this.verb!=='select'){if(table==='sync_logs')calls.monitorWrites++;else{calls.businessWrites++;throw new Error('business writes forbidden in bad-source fixtures');}}
            return {data:single?{id:'offline-log'}:table==='inspections'?existing.slice(this.start,this.end+1):[],error:null};
        }};return q;
    }};
    const env={VITE_SUPABASE_URL:main?'https://zuahpjdsypovxdplxryw.supabase.co':'https://offline.invalid',VITE_SUPABASE_ANON_KEY:'public-placeholder',SUPABASE_SERVICE_ROLE_KEY:'synthetic-noncredential',GOOGLE_SHEETS_CSV_URL:ledgerUrl};
    const fetch=async url=>{calls.fetch++;return String(url).includes('gid=40080222')
        ? {ok:!measurementMissing,status:measurementMissing?400:200,text:async()=>',품번,제품명,검사포인트,측정유형,기준치수,공차상,공차하,X1\nRI-260714-1,P,Synthetic,point,수치,10,1,-1,10'}
        : {ok:true,status:200,text:async()=>csv(rawRow('2026-07-14'))};};
    const code=source('api/sync-sheets.js').replace(/^import .*;$/gm,'').replace('export default','').replaceAll('export ','');
    const mod=new Function('dotenv','fetch','createClient','createHash','process',`${code}\nreturn {handler,buildLedgerRecord,planLedgerSync,prepareMeasurementSnapshot};`)({config(){}},fetch,()=>client,createHash,{env});
    return {...mod,calls,async request(){const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};await mod.handler({method:'POST',headers:{authorization:'Bearer offline-fixture'}},res);return res;}};
}
test('MAIN unconditional source HOLD executes before any Auth/Sheets/DB write',async()=>{
    const f=syncFixture({main:true});assert.equal((await f.request()).statusCode,503);assert.deepEqual(f.calls,{fetch:0,auth:0,businessWrites:0,monitorWrites:0});
});
test('missing measurement tab(400) executes before ledger/cache/business writes',async()=>{
    const f=syncFixture({measurementMissing:true});assert.ok((await f.request()).statusCode>=400);assert.equal(f.calls.businessWrites,0);assert.equal(f.calls.fetch,2);
});
test('legacy source collision / unapproved corrections execute before ledger/cache writes',async()=>{
    const factory=syncFixture();const before=factory.buildLedgerRecord(rawRow(),0);const after=factory.buildLedgerRecord(rawRow('2026-07-14'),0);
    assert.equal(before.id,after.id);assert.throws(()=>factory.planLedgerSync([after],[before],ledgerUrl),/HOLD/);
    const f=syncFixture({existing:[before]});assert.ok((await f.request()).statusCode>=400);assert.equal(f.calls.businessWrites,0);
    assert.throws(()=>factory.planLedgerSync([{...before,inspectionQuantity:7}],[before],ledgerUrl),/HOLD/);
});
test('local source-namespace candidate preserves legacy IDs, full hash separates sources, repeat adds zero',()=>{
    const f=syncFixture();const old=f.buildLedgerRecord(rawRow(),0);assert.equal(f.planLedgerSync([old],[old],ledgerUrl)[0].id,old.id);
    const incoming=f.buildLedgerRecord(rawRow('2026-07-14'),0);const newUrl=ledgerUrl.replace('offline-old','offline-new');
    const planned=f.planLedgerSync([incoming],[old],newUrl,'source');assert.notEqual(planned[0].id,old.id);assert.match(planned[0].id,/^sheet_[a-f0-9]{64}$/);
    const db=new Map([[old.id,old],...planned.map(r=>[r.id,r])]);for(const r of f.planLedgerSync([incoming],[...db.values()],newUrl,'source'))db.set(r.id,r);assert.equal(db.size,2);assert.deepEqual(db.get(old.id),old);
    assert.notEqual(f.planLedgerSync([incoming],[],ledgerUrl,'source')[0].id,planned[0].id);
    assert.throws(()=>f.planLedgerSync([{...incoming,inspectionQuantity:7}],[...db.values()],newUrl,'source'),/HOLD/);
});
