import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://localhost:5173';
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/piloto`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
async function call(path,method='GET',body){const response=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...(method==='GET'?{}:{Origin:base})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(JSON.stringify({status:response.status,...data}));return data}
const file='outputs/api-live-run.json';
const action=process.argv[2]||'status';
if(action==='create'){
 const health=await call('/api/pilot/engine');assert.equal(health.ready,true,JSON.stringify(health));
 const {run}=await call('/api/pilot','POST',{url:'https://insta-radar-two.vercel.app/',mode:'api'});assert.equal(run.mode,'api');assert.equal(run.caseId,null);await writeFile(file,JSON.stringify(run,null,2));console.log(JSON.stringify({id:run.id,phase:run.phase,generation:run.generation}));
}else{
 let run=JSON.parse(await readFile(file,'utf8'));run=(await call(`/api/pilot/${run.id}`)).run;
 if(action==='confirm'){assert.equal(run.phase,'context');run=(await call(`/api/pilot/${run.id}`,'PATCH',{action:'context',revision:run.revision,context:{name:'Insta Radar',description:'Mostra quem um perfil público do Instagram seguiu recentemente. A função vigia avisa por email quando entra uma conta nova. Não pede senha do Instagram e não acessa mensagens ou perfis privados.',audience:'Mulheres adultas que ficam na dúvida sobre mudanças na lista de seguindo de uma pessoa com quem se relacionam. Recorte editorial para o teste privado.',situations:'Abrir a lista de seguindo e não lembrar quem já estava lá. Perceber um perfil novo e querer entender se houve uma mudança. Ter um registro com data sem tratar um follow como prova de intenção ou traição.'}})).run}
 if(action==='produce'){assert.equal(run.phase,'ready');run=(await call(`/api/pilot/${run.id}`,'PATCH',{action:'prepare',revision:run.revision})).run}
 if(action==='retry'){run=(await call(`/api/pilot/${run.id}`,'PATCH',{action:'retry',revision:run.revision})).run}
 if(action==='status'){run=(await call(`/api/pilot/${run.id}/progress`,'POST',{})).run}
 if(action==='assets'){
  assert.equal(run.phase,'review');assert.deepEqual(run.pieces.map(p=>p.assets.length),[1,6,6]);assert.ok(run.pieces.every(p=>p.status==='pending'));
  for(const piece of run.pieces)for(const asset of piece.assets){const response=await fetch(base+asset.url,{headers:{Cookie:cookie}});assert.equal(response.status,200);const bytes=(await response.arrayBuffer()).byteLength;assert.ok(bytes>1000);assert.ok(response.headers.get('content-type').startsWith(asset.kind));const blocked=await fetch(base+asset.url);assert.equal(blocked.status,401);console.log(JSON.stringify({asset:asset.url,bytes,anonymous:blocked.status}))}
 }
 await writeFile(file,JSON.stringify(run,null,2));console.log(JSON.stringify({id:run.id,revision:run.revision,phase:run.phase,generation:run.generation,...(run.phase==='context'?{context:{name:'Insta Radar',description:'Mostra quem um perfil público do Instagram seguiu recentemente. A função vigia avisa por email quando entra uma conta nova. Não pede senha do Instagram e não acessa mensagens ou perfis privados.',audience:'Mulheres adultas que ficam na dúvida sobre mudanças na lista de seguindo de uma pessoa com quem se relacionam. Recorte editorial para o teste privado.',situations:'Abrir a lista de seguindo e não lembrar quem já estava lá. Perceber um perfil novo e querer entender se houve uma mudança. Ter um registro com data sem tratar um follow como prova de intenção ou traição.'},facts:run.facts}:{}),pieces:run.pieces.map(p=>({id:p.id,hook:p.hook,assets:p.assets.length,status:p.status}))}));
}
