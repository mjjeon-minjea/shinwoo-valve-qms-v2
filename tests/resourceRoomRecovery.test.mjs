import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceFiles, buildResourceStoragePath, validateResourceFile } from '../src/lib/resourceFiles.js';
const draft={module:'ncr',moduleLabel:'부적합',category:'form',categoryLabel:'양식',docKey:'test',title:'test'};
const file={name:'한글.pdf',size:1,type:'application/pdf'};
const hash='a'.repeat(64);
function harness(){let uploads=0,rpcs=0;const state={error:true};const adapter=createResourceFiles({apiClient:{rpc:async()=>{rpcs++;return{id:'id'};}},supabaseClient:{storage:{from:()=>({upload:async()=>{uploads++;return{error:state.error?{message:'transient upload failure'}:null};},download:async()=>({error:{message:'not found'},data:null})})}},createId:()=> 'id',hashFile:async()=>hash});return{adapter,state,get uploads(){return uploads;},get rpcs(){return rpcs;}};}
test('failed upload retry retries upload rather than publishing missing object',async()=>{const h=harness();let receipt;try{await h.adapter.publish({draft,file,isAdmin:true});}catch(e){receipt=e.receipt;}assert(receipt);h.state.error=false;await h.adapter.publish({draft,file,isAdmin:true,receipt});assert.equal(h.uploads,2);assert.equal(h.rpcs,1);});
test('immutable retry mismatch preserves the original receipt',async()=>{const h=harness();h.state.error=false;const broken=createResourceFiles({apiClient:{rpc:async()=>{throw new Error('fail');}},supabaseClient:{storage:{from:()=>({upload:async()=>({error:null})})}},createId:()=> 'id',hashFile:async()=>hash});let receipt;try{await broken.publish({draft,file,isAdmin:true});}catch(e){receipt=e.receipt;}assert(receipt);await assert.rejects(()=>broken.publish({draft:{...draft,title:'different'},file,isAdmin:true,receipt}),e=>e.receipt===receipt);});
test('lost upload response recovers only when exact-path bytes match',async()=>{
 for(const matches of [true,false]){
  let calls=0;
  const adapter=createResourceFiles({apiClient:{rpc:async()=>{calls++;return{};}},supabaseClient:{storage:{from:()=>({upload:async()=>({error:{message:'lost response'}}),download:async()=>({data:{existing:true},error:null})})}},createId:()=> 'id',hashFile:async f=>f.existing&&!matches?'b'.repeat(64):hash});
  if(matches)await adapter.publish({draft,file,isAdmin:true});
  else await assert.rejects(()=>adapter.publish({draft,file,isAdmin:true}),e=>e.code==='RESOURCE_STORAGE_UPLOAD_FAILED'&&e.receipt.uploaded===false);
  assert.equal(calls,matches?1:0);
 }
});
test('original filename is not Unicode-normalized; object leaf stays ASCII',()=>{const original='가'.normalize('NFD')+'.pdf';assert.equal(validateResourceFile({...file,name:original}).originalName,original);const path=buildResourceStoragePath({id:'id',module:'ncr',category:'form',docKey:'test',originalName:'한글.pdf'});assert.match(path,/^[\x20-\x7e]+$/);});
