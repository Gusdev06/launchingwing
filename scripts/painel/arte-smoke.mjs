// Prova da geração de imagem com um RunPod falso em 127.0.0.1:8790. O dev precisa rodar com
// RUNPOD_BASE_URL=http://127.0.0.1:8790 em .dev.vars (chave e endpoint podem ser qualquer texto).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const base='http://localhost:5173';
const MP4=Buffer.concat([Buffer.from('0000001c667479706d703432','hex'),Buffer.alloc(4000,7)]);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const jobs=new Map();let runs=0;const inputs=[];
const fake=createServer((req,res)=>{
 const auth=req.headers.authorization;if(auth!=='Bearer chave-falsa-local'){res.writeHead(401);res.end('{"error":"sem chave"}');return}
 const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(req.method==='POST'&&req.url==='/endpoint-video-falso/run'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const {input}=JSON.parse(body);const wf=input.workflow;if(!wf||wf['5'].class_type!=='MiniMaxH3ImageToVideo'||wf['14'].class_type!=='SaveVideo'||typeof wf['5'].inputs.length!=='number'){send(400,{error:'workflow de video inesperado'});return}inputs.push(input);const id=`fakev-${++runs}`;jobs.set(id,{polls:0,prompt:wf['5'].inputs.prompt,video:true});send(200,{id,status:'IN_QUEUE'})});return}
 if(req.method==='POST'&&req.url==='/endpoint-falso/run'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const {input}=JSON.parse(body);const wf=input.workflow;if(!wf||wf['4'].class_type!=='CLIPTextEncode'||typeof wf['4'].inputs.text!=='string'||(wf['6']??wf['14']).inputs.width!==1024){send(400,{error:'workflow inesperado'});return}inputs.push(input);const id=`fake-${++runs}`;jobs.set(id,{polls:0,prompt:wf['4'].inputs.text});send(200,{id,status:'IN_QUEUE'})});return}
 const m=req.url.match(/^\/endpoint(?:-video)?-falso\/status\/(.+)$/);
 if(m){const j=jobs.get(m[1]);if(!j){send(404,{error:'nao existe'});return}j.polls++;if(j.prompt.includes('FALHAR')){send(200,{id:m[1],status:'FAILED',error:'boom'});return}if(j.polls===1){send(200,{id:m[1],status:'IN_PROGRESS'});return}send(200,{id:m[1],status:'COMPLETED',output:{images:j.video?[{filename:'video/minimax_h3_00001_.mp4',type:'base64',data:MP4.toString('base64')}]:[{filename:'krea2_00001_.png',type:'base64',data:PNG.toString('base64')}]},delayTime:1200,executionTime:7000});return}
 send(404,{error:'rota'});
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
 const info=await call('/api/painel/arte');assert.equal(info.status,200);assert.equal(info.data.conectado,true);assert.equal(info.data.video,true);marks.push('connected_reported');
 assert.equal((await call('/api/painel/arte',{method:'POST',origin:'https://example.com',body:{chave,prompt:'gato'}})).status,403);marks.push('cross_origin_blocked');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'ab'}})).status,400);marks.push('short_prompt_rejected');
 const started=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'um gato astronauta na lua',tamanho:'1:1'}});assert.equal(started.status,201);assert.equal(started.data.job.status,'na_fila');marks.push('job_started_at_runpod');
 const id=started.data.job.id;
 const first=await call(`/api/painel/arte/${id}`);assert.equal(first.status,200);assert.equal(first.data.job.status,'gerando');marks.push('in_progress_mapped');
 const second=await call(`/api/painel/arte/${id}`);assert.equal(second.data.job.status,'pronto');assert.match(second.data.job.url,/^\/api\/painel\/arquivo\//);marks.push('completed_stored_as_file');
 const served=await call(second.data.job.url,{raw:true});assert.equal(served.status,200);assert.equal(served.type,'image/png');assert.ok(served.bytes.equals(PNG));marks.push('image_bytes_identical');
 const third=await call(`/api/painel/arte/${id}`);assert.equal(third.data.job.url,second.data.job.url);marks.push('terminal_status_cached');
 assert.equal((await call(`/api/painel/arte/${id}`,{auth:false})).status,401);marks.push('anonymous_status_blocked');
 const failing=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'isto vai FALHAR'}});assert.equal(failing.status,201);
 const failed=await call(`/api/painel/arte/${failing.data.job.id}`);assert.equal(failed.data.job.status,'erro');assert.ok(failed.data.job.error);marks.push('failure_reported_in_portuguese');
 assert.equal((await call('/api/painel/arte/00000000-0000-4000-8000-000000000000')).status,404);marks.push('unknown_job_404');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'foto externa',imagemUrl:'https://evil.example/x.png'}})).status,400);marks.push('external_source_rejected');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'forca alta',imagemUrl:'/workspace/01-celular-cafe-cama.jpg',forca:5}})).status,400);marks.push('force_out_of_range_rejected');
 const fromPhoto=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'a mesma cena ao entardecer',imagemUrl:'/workspace/01-celular-cafe-cama.jpg',forca:0.4}});assert.equal(fromPhoto.status,201);
 const sent=inputs.at(-1);assert.equal(sent.images.length,1);assert.equal(sent.workflow['15'].class_type,'VAEEncode');assert.equal(sent.workflow['7'].inputs.denoise,0.4);assert.equal(sent.workflow['6'],undefined);
 const {readFileSync}=await import('node:fs');assert.ok(Buffer.from(sent.images[0].image,'base64').equals(readFileSync('public/workspace/01-celular-cafe-cama.jpg')),'foto enviada byte a byte');marks.push('image_to_image_sends_photo');
 const ownFile=await fetch(`${base}/api/painel/arquivo?chave=${chave}`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png','X-Nome':'minha.png'},body:PNG});assert.equal(ownFile.status,201);const ownUrl=(await ownFile.json()).url;
 const fromOwn=await call('/api/painel/arte',{method:'POST',body:{chave,prompt:'a partir do meu arquivo',imagemUrl:ownUrl}});assert.equal(fromOwn.status,201);assert.ok(Buffer.from(inputs.at(-1).images[0].image,'base64').equals(PNG));assert.equal(inputs.at(-1).workflow['7'].inputs.denoise,0.65);marks.push('image_to_image_from_own_file');
 assert.equal((await call('/api/painel/arte',{method:'POST',body:{chave,tipo:'video',prompt:'dog running on the beach, waves sound',duracaoS:20}})).status,400);marks.push('video_duration_out_of_range_rejected');
 const vid=await call('/api/painel/arte',{method:'POST',body:{chave,tipo:'video',prompt:'dog running on the beach, waves sound',tamanho:'9:16',duracaoS:5,imagemUrl:'/workspace/01-celular-cafe-cama.jpg'}});assert.equal(vid.status,201);assert.equal(vid.data.job.tipo,'video');
 const vsent=inputs.at(-1);assert.equal(vsent.workflow['5'].inputs.width,480);assert.equal(vsent.workflow['5'].inputs.height,864);assert.equal(vsent.workflow['5'].inputs.length,124);assert.deepEqual(vsent.workflow['5'].inputs.first_frame,['16',0]);assert.equal(vsent.images.length,1);marks.push('video_job_started_with_first_frame');
 assert.equal((await call(`/api/painel/arte/${vid.data.job.id}`)).data.job.status,'gerando');
 const vdone=await call(`/api/painel/arte/${vid.data.job.id}`);assert.equal(vdone.data.job.status,'pronto');const vfile=await call(vdone.data.job.url,{raw:true});assert.equal(vfile.status,200);assert.equal(vfile.type,'video/mp4');assert.ok(vfile.bytes.equals(MP4));marks.push('video_stored_and_served_as_mp4');
 assert.equal((await call(`/api/painel?chave=${chave}`,{method:'DELETE'})).status,200);assert.equal((await call(second.data.job.url,{raw:true})).status,404);marks.push('delete_removes_generated_files');
 console.log(JSON.stringify({passed:marks,runpodRuns:runs}));
}catch(error){console.error(JSON.stringify({passed:marks}));await call(`/api/painel?chave=${chave}`,{method:'DELETE'}).catch(()=>{});throw error}
finally{fake.close()}
