import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://localhost:5173';
const ids=[];
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/piloto`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local sign-in cookie');
async function call(path,{method='GET',body,auth=true,origin=base}={}){
 const response=await fetch(`${base}${path}`,{method,headers:{...(auth?{Cookie:cookie}:{}),...(method!=='GET'?{'Content-Type':'application/json',Origin:origin}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:response.status,data};
}
const marks=[];
try{
 assert.equal((await call('/api/pilot',{auth:false})).status,401);marks.push('anonymous_read_blocked');
 assert.equal((await call('/api/pilot',{method:'POST',origin:'https://example.com',body:{mode:'demo',url:'https://geraew.ai/'}})).status,403);marks.push('cross_origin_write_blocked');
 for(const url of ['http://localhost','https://127.0.0.1/','https://user:password@example.com/','javascript:alert(1)'])assert.equal((await call('/api/pilot',{method:'POST',body:{url}})).status,400);marks.push('invalid_and_private_urls_rejected');
 const first=await call('/api/pilot',{method:'POST',body:{mode:'demo',url:'https://geraew.ai/'}});assert.equal(first.status,201);let run=first.data.run;ids.push(run.id);assert.equal(run.phase,'context');assert.equal(run.pieces.length,0);
 assert.equal((await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'prepare',revision:run.revision}})).status,400);marks.push('context_required_before_batch');
 const context=await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'context',revision:run.revision,context:{...run.context,name:'QA descartável · GERAEW'}}});assert.equal(context.status,200);run=context.data.run;
 const batch=await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'prepare',revision:run.revision}});assert.equal(batch.status,200);run=batch.data.run;assert.equal(run.pieces.length,3);marks.push('context_and_three_piece_batch_persisted');
 const revision=run.revision;
 const badFeedback=await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'review',revision,pieceId:run.pieces[0].id,caption:run.pieces[0].caption,feedback:'',status:'changes',seconds:10}});assert.equal(badFeedback.status,400);marks.push('rejection_reason_required');
 const reviewed=await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'review',revision,pieceId:run.pieces[0].id,caption:'Legenda editada exclusivamente pelo teste local.',feedback:'Teste de persistência, não aprovação editorial.',status:'approved',seconds:12}});assert.equal(reviewed.status,200);run=reviewed.data.run;
 const restored=await call(`/api/pilot/${run.id}`);assert.equal(restored.data.run.pieces[0].caption,'Legenda editada exclusivamente pelo teste local.');assert.equal(restored.data.run.pieces[0].status,'approved');assert.equal(restored.data.run.pieces[0].reviewSeconds,12);marks.push('edited_caption_decision_and_time_persisted');
 assert.equal((await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'review',revision,pieceId:run.pieces[0].id,caption:'Conflito',feedback:'',status:'pending',seconds:0}})).status,409);marks.push('stale_revision_rejected');
 const draft=await call(`/api/pilot/${run.id}`,{method:'PATCH',body:{action:'review',revision:run.revision,pieceId:run.pieces[0].id,caption:'Nova edição requer nova aprovação.',feedback:'',status:'pending',seconds:0}});assert.equal(draft.status,200);assert.equal(draft.data.run.pieces[0].status,'pending');marks.push('draft_clears_approval');
 for(const p of run.pieces)for(const asset of p.assets){const res=await fetch(base+asset.url,{method:'HEAD'});assert.equal(res.status,200)}marks.push('all_seven_assets_available');
 const other=await call('/api/pilot',{method:'POST',body:{mode:'demo',url:'https://example.com/launchwing-qa'}});assert.equal(other.status,201);ids.push(other.data.run.id);assert.equal(other.data.run.phase,'queued');assert.equal(other.data.run.pieces.length,0);assert.equal(other.data.run.caseId,null);marks.push('unknown_product_queued_without_fake_content');
 assert.equal((await call(`/api/pilot/${run.id}`,{auth:false})).status,401);marks.push('anonymous_detail_blocked');
 await writeFile('outputs/pilot-smoke-results.json',JSON.stringify({passed:marks,qaRunIds:ids,testedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({passed:marks,qaRunIds:ids}));
}finally{
 await writeFile('outputs/pilot-smoke-cleanup.sql',ids.map(id=>{assert.match(id,/^[0-9a-f-]{36}$/);return `DELETE FROM pilot_runs WHERE id='${id}' AND owner_id='local_seedy';`}).join('\n'));
}
