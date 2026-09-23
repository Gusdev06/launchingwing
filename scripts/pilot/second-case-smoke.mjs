import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://localhost:5173',ids=[],checks=[];
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/piloto`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
async function call(path,method='GET',body){const res=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()}}
await mkdir('outputs',{recursive:true});
try{
 const result=await call('/api/pilot','POST',{mode:'demo',url:'https://insta-radar-two.vercel.app/'});assert.equal(result.status,201);let run=result.data.run;ids.push(run.id);
 assert.equal(run.context.name,'Insta Radar');assert.equal(run.phase,'context');assert.match(run.caseId,/insta-radar/);assert.ok(!JSON.stringify(run.context).includes('GERAEW'));checks.push('radar_url_resolves_own_context');
 const confirmation=await call(`/api/pilot/${run.id}`,'PATCH',{action:'context',revision:run.revision,context:{...run.context,name:'QA descartável — Insta Radar'}});assert.equal(confirmation.status,200);run=confirmation.data.run;
 const prepared=await call(`/api/pilot/${run.id}`,'PATCH',{action:'prepare',revision:run.revision});assert.equal(prepared.status,200);run=prepared.data.run;assert.equal(run.pieces.length,3);assert.ok(run.pieces.every(p=>p.id.startsWith('insta-radar-')&&p.status==='pending'));checks.push('three_radar_pieces_no_cross_product_mix');
 assert.deepEqual(run.pieces.map(piece=>piece.assets.length),[1,6,6]);
 assert.deepEqual(run.pieces.map(piece=>piece.assets[0].kind),['video','image','image']);
 for(const piece of run.pieces){assert.match(piece.id,/^insta-radar-v2-/);assert.ok(piece.caption.length<=2200);for(const asset of piece.assets){assert.equal((await fetch(base+asset.url,{method:'HEAD'})).status,200)}}checks.push('v2_meme_and_twelve_slides_available');
 const reviewed=await call(`/api/pilot/${run.id}`,'PATCH',{action:'review',revision:run.revision,pieceId:run.pieces[0].id,caption:run.pieces[0].caption,feedback:'Teste técnico descartável; não representa avaliação de Gusta.',status:'changes',seconds:8});assert.equal(reviewed.status,200);
 const restored=await call(`/api/pilot/${run.id}`);assert.equal(restored.data.run.pieces[0].status,'changes');assert.equal(restored.data.run.pieces[0].reviewSeconds,8);checks.push('radar_review_persists');
 const geraew=await call('/api/pilot','POST',{mode:'demo',url:'https://geraew.ai/'});assert.equal(geraew.status,201);ids.push(geraew.data.run.id);assert.equal(geraew.data.run.context.name,'GERAEW');checks.push('geraew_catalog_preserved');
 const unknown=await call('/api/pilot','POST',{mode:'demo',url:'https://example.com/launchwing-radar-qa'});assert.equal(unknown.status,201);ids.push(unknown.data.run.id);assert.equal(unknown.data.run.phase,'queued');assert.equal(unknown.data.run.caseId,null);checks.push('unknown_product_still_queued');
 await writeFile('outputs/radar-smoke-results.json',JSON.stringify({testedAt:new Date().toISOString(),passed:checks,qaRunIds:ids},null,2));console.log(JSON.stringify({passed:checks,qaRunIds:ids}));
}finally{await writeFile('outputs/radar-smoke-cleanup.sql',ids.map(id=>{assert.match(id,/^[0-9a-f-]{36}$/);return `DELETE FROM pilot_runs WHERE id='${id}' AND owner_id='local_seedy';`}).join('\n'))}
