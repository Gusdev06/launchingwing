// Prova da geração de imagem com uma OpenAI falsa em 127.0.0.1:8790. O dev precisa rodar com
// OPENAI_BASE_URL=http://127.0.0.1:8790 e OPENAI_API_KEY=chave-falsa-local em .dev.vars.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const base='http://localhost:5173';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
let runs=0;const inputs=[];
const fake=createServer((req,res)=>{
 const auth=req.headers.authorization;if(auth!=='Bearer chave-falsa-local'){res.writeHead(401);res.end('{"error":"sem chave"}');return}
 const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(req.method!=='POST'||(req.url!=='/images/generations'&&req.url!=='/images/edits')){send(404,{error:'rota'});return}
 const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
  const raw=Buffer.concat(chunks);runs++;
  const edit=req.url==='/images/edits';const text=raw.toString('latin1');
  const prompt=edit?text.match(/name="prompt"\r\n\r\n([^\r]*)/)?.[1]:JSON.parse(raw.toString()).prompt;
  const size=edit?text.match(/name="size"\r\n\r\n([^\r]*)/)?.[1]:JSON.parse(raw.toString()).size;
  inputs.push({edit,prompt,size,raw});
  if(prompt?.includes('FALHAR')){send(500,{error:{message:'boom'}});return}
  send(200,{data:[{b64_json:PNG.toString('base64')}]});
 });
});
await new Promise(r=>fake.listen(8790,'127.0.0.1',r));
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/painel`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local sign-in cookie');
async function call(path,{method='GET',body,auth=true,origin=base,raw}={}){
 const response=await fetch(`${base}${path}`,{method,headers:{...(auth?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(raw)return {status:response.status,bytes:Buffer.from(await response.arrayBuffer()),type:response.headers.get('content-type')};
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:response.status,data};
}
const chave=`arte-${crypto.randomUUID()}`;const marks=[];
try{
 assert.equal((await call('/api/painel/arte',{auth:false})).status,401);marks.push('anonymous_blocked');
 const info=await call('/api/painel/arte');assert.equal(info.status,200);assert.equal(info.data.conectado,true);assert.equal(info.data.video,false);marks.push('connected_and_video_off');
 assert.equal((await call('/api/painel/arte',{method:'POST',origin:'https://example.com',body:{chave,prompt:'gato'}})).status,403);marks.push('cross_origin_blocked');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'ab'}})).status,400);marks.push('short_prompt_rejected');
 const started=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'um gato astronauta na lua',tamanho:'9:16'}});assert.equal(started.status,201);assert.equal(started.data.job.status,'pronto');assert.match(started.data.job.url,/^\/api\/painel\/arquivo\//);
 assert.equal(inputs.at(-1).edit,false);assert.equal(inputs.at(-1).size,'768x1344');marks.push('generated_and_stored');
 const served=await call(started.data.job.url,{raw:true});assert.equal(served.status,200);assert.equal(served.type,'image/png');assert.ok(served.bytes.equals(PNG));marks.push('image_bytes_identical');
 const again=await call(`/api/painel/arte/${started.data.job.id}`);assert.equal(again.data.job.status,'pronto');assert.equal(again.data.job.url,started.data.job.url);marks.push('status_route_returns_done');
 assert.equal((await call(`/api/painel/arte/${started.data.job.id}`,{auth:false})).status,401);marks.push('anonymous_status_blocked');
 const failing=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'isto vai FALHAR'}});assert.equal(failing.status,503);assert.ok(failing.data.error);marks.push('failure_reported_in_portuguese');
 assert.equal((await call('/api/painel/arte/00000000-0000-4000-8000-000000000000')).status,404);marks.push('unknown_job_404');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'foto externa',imagemUrl:'https://evil.example/x.png'}})).status,400);marks.push('external_source_rejected');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'foto publica direto',imagemUrl:'/workspace/01-celular-cafe-cama.jpg'}})).status,400);marks.push('public_library_url_rejected_server_side');
 assert.equal((await fetch(`${base}/api/painel/arquivo?chave=${chave}`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png','X-Nome':'%E0%A4%A'},body:PNG})).status,400);marks.push('malformed_name_header_400');
 const {readFileSync}=await import('node:fs');const jpg=readFileSync('public/workspace/01-celular-cafe-cama.jpg');
 const pubFile=await fetch(`${base}/api/painel/arquivo?chave=${chave}`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/jpeg','X-Nome':'01-celular-cafe-cama.jpg'},body:jpg});assert.equal(pubFile.status,201);const pubUrl=(await pubFile.json()).url;
 const fromPhoto=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'a mesma cena ao entardecer',imagemUrl:pubUrl}});assert.equal(fromPhoto.status,201);
 const sent=inputs.at(-1);assert.equal(sent.edit,true);assert.equal(sent.size,'1024x1024');assert.ok(sent.raw.includes(jpg),'foto enviada byte a byte');marks.push('edit_sends_photo');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,tipo:'video',prompt:'dog running on the beach'}})).status,503);marks.push('video_off');
 assert.equal((await call(`/api/painel?chave=${chave}`,{method:'DELETE'})).status,200);assert.equal((await call(started.data.job.url,{raw:true})).status,404);marks.push('delete_removes_generated_files');
 console.log(JSON.stringify({passed:marks,openaiRuns:runs}));
}catch(error){console.error(JSON.stringify({passed:marks}));await call(`/api/painel?chave=${chave}`,{method:'DELETE'}).catch(()=>{});throw error}
finally{fake.close()}
