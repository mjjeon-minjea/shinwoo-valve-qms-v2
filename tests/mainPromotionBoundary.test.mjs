import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const jsonServer = createRequire(import.meta.url)('json-server');
const source = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
import { isFullOperator } from '../src/lib/operatorIdentity.js';
// Offline handler contracts only. No real GoTrue/DB/network clients.
function fixture(options={}) {
    const rows=[{id:'admin',email:'admin@example.test',auth_id:uuid(1),is_admin:true,status:'Active',legacy_post_manager:true,role:'manager',rank:'차장',name:'Synthetic',company:'생산부'},
        {id:'target',email:'target@example.test',auth_id:uuid(2),is_admin:false,status:'Active',role:'employee',rank:'사원',name:'Before',company:'생산부'}];
    const calls={auth:0,updates:[],selects:[]};
    const client={auth:{getUser:async()=>({data:{user:{id:options.actor===false?uuid(2):uuid(1)}},error:options.invalidToken?{}:null}),admin:{updateUserById:async(id)=>{calls.auth++;if(options.throwAuth)throw new Error('offline transport');return options.authError?{error:options.authError}:{data:{user:{id}}};}}},from:()=>{
        const q={filters:[],payload:null,eq(k,v){this.filters.push([k,v]);return this;},is(k,v){return this.eq(k,v);},update(v){calls.updates.push({...v});this.payload=v;return this;},select(c){calls.selects.push(c);assert.ok(!c.split(',').includes('password'));return this;},single(){return this.run(true);},then(resolve,reject){return this.run(false).then(resolve,reject);},async run(single){
            const hits=rows.filter(r=>this.filters.every(([k,v])=>r[k]===v));
            if(this.payload && options.dbError) {
                if(options.commitBeforeError) for(const r of hits) Object.assign(r,this.payload);
                if(options.throwDb) throw new Error('offline response loss');
                return {data:null,error:options.dbError};
            }
            if(this.payload && options.casMiss) return {data:[],error:null};
            if(this.payload) for(const r of hits) Object.assign(r,this.payload);
            return {data:single?(hits[0]?{...hits[0]}:null):hits.map(r=>({...r})),error:single&&hits.length!==1?{code:'PGRST116'}:null};
        }};return q;
    }};
    const env={VITE_SUPABASE_URL:'https://offline.invalid',VITE_SUPABASE_ANON_KEY:'public-placeholder',SUPABASE_SERVICE_ROLE_KEY:'synthetic-noncredential',QMS_USERS_MAINTENANCE:options.maintenance?'on':'off'};
    const text=source('api/admin-update-member.js').replace(/^import .*;\n/,'').replace('export async function','async function').replace('export default async function','async function');
    const handler=new Function('createClient','process',`${text}\nreturn handler;`)(()=>client,{env});
    return {calls,rows,async request(body={auth_id:uuid(2)},headers={authorization:'Bearer offline-fixture'}){
        const res={statusCode:0,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
        await handler({method:'POST',headers,body},res);return res;
    }};
}
test('admin blank password: profile update readback, Auth zero, no public password',async()=>{
    const f=fixture();assert.equal((await f.request({auth_id:uuid(2),name:'After',password:'   '})).statusCode,200);
    assert.equal(f.calls.auth,0);assert.equal(f.rows[1].name,'After');assert.deepEqual(f.calls.updates,[{name:'After'}]);
});
test('verified site-admin only: rank/role cannot grant admin API access',async()=>{
    for(const opts of [{actor:false},{invalidToken:true},{maintenance:true}]){
        const f=fixture(opts);assert.ok([401,403,503].includes((await f.request({auth_id:uuid(2),password:'fixture-only'})).statusCode));assert.equal(f.calls.auth,0);assert.equal(f.calls.updates.length,0);
    }
    assert.equal((await fixture().request(undefined,{})).statusCode,401);
});
test('immutable identity/capability/unknown fields, invalid role and sole-admin status deny',async()=>{
    for(const body of [{email:'attack@example.test'},{is_admin:true},{weekly_review_enabled:true},{legacy_post_manager:true},{id:'attack'},{role:'owner'},{password:'short'}]){
        const f=fixture();assert.equal((await f.request({auth_id:uuid(2),...body})).statusCode,400);assert.equal(f.calls.auth,0);assert.equal(f.calls.updates.length,0);
    }
    assert.equal((await fixture().request({auth_id:uuid(1),status:'Inactive'})).statusCode,409);
    assert.equal((await fixture().request({auth_id:uuid(99)})).statusCode,409);
});
test('DB rejection/missing CAS readback => no Auth mutation',async()=>{
    for(const code of ['42501','22P02','23505','42703']) {
        const f=fixture({dbError:{code}});assert.equal((await f.request({auth_id:uuid(2),name:'After',password:'fixture-only'})).statusCode,409);assert.equal(f.calls.auth,0);assert.equal(f.rows[1].name,'Before');
    }
    const g=fixture({casMiss:true});assert.equal((await g.request({auth_id:uuid(2),name:'After',password:'fixture-only'})).statusCode,503);assert.equal(g.calls.auth,0);
});
test('completion-unknown DB/transport errors HOLD after commit, without Auth/retry/compensation',async()=>{
    for(const options of [...['08007','40003','XX000','PGRST204','PGRST503',undefined].map(code=>({dbError:{code}})),{dbError:{},throwDb:true}]) {
        const f=fixture({...options,commitBeforeError:true});
        const res=await f.request({auth_id:uuid(2),name:'After',password:'fixture-only'});
        assert.equal(res.statusCode,503);assert.match(res.body.error,/HOLD/);assert.doesNotMatch(res.body.error,/변경 없음/);
        assert.equal(f.rows[1].name,'After');assert.equal(f.calls.auth,0);assert.deepEqual(f.calls.updates,[{name:'After'}]);
    }
});
test('explicit Auth success, confirmed Auth failure restores profile and readback',async()=>{
    const f=fixture();assert.equal((await f.request({auth_id:uuid(2),name:'After',password:'fixture-only'})).statusCode,200);assert.equal(f.calls.auth,1);
    const g=fixture({authError:{status:422,name:'AuthApiError'}});assert.equal((await g.request({auth_id:uuid(2),name:'After',password:'fixture-only'})).statusCode,409);assert.equal(g.rows[1].name,'Before');assert.equal(g.calls.updates.length,2);
});
test('unknown Auth outcome => HOLD, never compensates an unknown credential result',async()=>{
    for(const opts of [{throwAuth:true},{authError:{status:503,name:'AuthRetryableFetchError'}}]){
        const f=fixture(opts);assert.equal((await f.request({auth_id:uuid(2),name:'After',password:'fixture-only'})).statusCode,503);assert.equal(f.rows[1].name,'After');assert.equal(f.calls.updates.length,1);
    }
});
test('general API uses safe users projection and denies write/password filter',async()=>{
    const calls=[];
    const q={select(p){calls.push(p);return this;},order(){return this;},range(){return this;},eq(){return this;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};
    const code=source('src/lib/api.js').replace(/^import .*;\n/,'').replaceAll('import.meta.env','env').replaceAll('export const ','const ');
    const api=new Function('createClient','env',`${code}\nreturn api;`)(()=>({from:()=>q}),{});
    await api.fetch('/users');assert.equal(calls.length,1);assert.ok(!calls[0].split(',').includes('password'));
    await assert.rejects(api.fetch('/users?password=eq.x'));await assert.rejects(api.fetch('/users',{method:'PUT',body:{password:'x'}}));assert.equal(calls.length,1);
});
test('source integration: shared local/serverless handler and no users raw CRUD/legacy login',()=>{
    const server=source('server.js');assert.match(server,/import\('\.\/api\/admin-update-member\.js'\)/);assert.match(server,/verifiedProfile/);
    assert.match(server,/legacy_post_manager/);assert.match(server,/users/);
    const ctx=source('src/contexts/UserContext.jsx');assert.doesNotMatch(ctx,/check_legacy_password|migrateUser|\.select\(['"]\*['"]\)/);
    assert.match(ctx,/profileId: profile.id/);assert.match(ctx,/profile.status !== 'Active'/);
    const dashboard=source('src/components/Dashboard.jsx');assert.doesNotMatch(dashboard,/NcrInbox|NcrDetail|qms_test_account|ncr_inbox|ncr_records/);
});
test('real in-memory json-server: canonical paths, raw DB/nested/expansion denial, safe reads and frozen manager',async()=>{
    const fn=source('server.js').match(/export async function localIdentityBoundary[\s\S]*?(?=\nserver.use\(localIdentityBoundary\))/)[0]
        .replace('export ','').replace("const { verifiedProfile } = await import('./api/admin-update-member.js');",'');
    const data={users:[{id:'u1',name:'Synthetic',role:'employee',password:null,taskId:'t1'}],
        dev_notes:[{id:'d1',status:'draft',taskId:'t1'},{id:'p1',status:'published',taskId:'t1'}],tasks:[{id:'t1',userId:'u1'}]};
    const router=jsonServer.router(data);let actor=null;
    const boundary=new Function('verifiedProfile','router','isFullOperator',`${fn};return localIdentityBoundary;`)(async()=>actor,router,isFullOperator);
    const app=jsonServer.create();app.use(jsonServer.bodyParser);app.use(boundary);app.use(router);
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    async function request(path,method='GET',body){
        const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
        const payload=await res.json();assert.ok(!JSON.stringify(payload).includes('"password":'),path);
        return {status:res.status,body:payload};
    }
    try {
        for(const path of ['/users','/USERS','/Users/','/USERS/u1/','/dev_notes','/DEV_NOTES/d1/']) assert.equal((await request(path)).status,401,path);
        for(const path of ['/db','/DB','/db/','/DB///','/']) assert.equal((await request(path)).status,403,path);
        for(const current of [null,{status:'Active',legacy_post_manager:false},{status:'Active',legacy_post_manager:true}]) {
            actor=current;
            for(const path of ['/tasks?_expand=user','/tasks/t1?_expand=user','/tasks?_expand[]=user','/tasks?_embed=users&_embed=dev_notes',
                '/tasks/t1/users','/tasks/t1/DEV_NOTES/','/tasks/t1/%75sers','/tasks/t1/%64b','/tasks/t1/db%3Fcallback=x','/users/u1/tasks?_expand=user']) {
                assert.equal((await request(path)).status,403,path);
                assert.equal((await request(path,'POST',{role:'director'})).status,403,path);
            }
            for(const path of ['/users/u1','/USERS/u1/']) for(const method of ['POST','PATCH','PUT','DELETE']) assert.ok([401,403].includes((await request(path,method,{role:'director'})).status));
        }
        assert.equal(router.db.get('users').find({id:'u1'}).value().role,'employee');
        actor={status:'Active',legacy_post_manager:false};
        assert.deepEqual((await request('/USERS/')).body,[{id:'u1',name:'Synthetic',role:'employee'}]);
        assert.deepEqual((await request('/users/%75%31/')).body,{id:'u1',name:'Synthetic',role:'employee'});
        assert.equal((await request('/users?password=x')).status,400);
        assert.deepEqual((await request('/DEV_NOTES/')).body,[{id:'p1',status:'published',taskId:'t1'}]);
        assert.equal((await request('/DEV_NOTES/d1/')).body,null);
        assert.equal((await request('/DEV_NOTES/d1/','PATCH',{status:'published'})).status,403);
        actor={status:'Active',legacy_post_manager:true};
        assert.equal((await request('/DEV_NOTES/d1/')).body.status,'draft');
        assert.equal((await request('/DEV_NOTES/d1/','PATCH',{status:'published'})).status,200);
        assert.equal(router.db.get('dev_notes').find({id:'d1'}).value().status,'published');
        assert.deepEqual((await request('/tasks/t1')).body,{id:'t1',userId:'u1'});
    } finally { await new Promise(resolve=>server.close(resolve)); }
});
