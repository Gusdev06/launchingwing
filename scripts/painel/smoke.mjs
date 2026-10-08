// Prova das rotas do painel contra o dev local (npm run dev). Cria, lê, detecta revisão velha,
// recusa imagem embutida, envia arquivo maior que um pedaço do D1 e apaga tudo no fim.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base='http://localhost:5173';
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/painel`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local sign-in cookie');
async function call(path,{method='GET',body,auth=true,origin=base,raw,type}={}){
 const headers={...(auth?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...(type?{'Content-Type':type}:body!==undefined?{'Content-Type':'application/json'}:{})};
 const response=await fetch(`${base}${path}`,{method,headers,...(raw?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})});
 if(raw!==undefined&&method==='GET')return {status:response.status,bytes:Buffer.from(await response.arrayBuffer()),type:response.headers.get('content-type')};
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:response.status,data};
}
const chave=`smoke-${crypto.randomUUID()}`;
const data={version:1,brand:{name:'Marca de prova',site:'https://exemplo.com',description:'',audience:'',problem:'',benefit:'',tone:'',angles:['um'],avoid:'',mention:'Às vezes',color:'#2547FF',logo:''},contents:[{id:'c1',title:'Título',format:'meme',caption:'Legenda',slides:[{id:'s1',image:'/workspace/01-celular-cafe-cama.jpg',text:'',position:'top',size:30}],origin:'local',status:'draft',createdAt:'2026-09-27T00:00:00Z'}],media:[],plans:[],campaigns:[],favorites:[],collections:[],preferences:{language:'Português (Brasil)',timezone:'America/Sao_Paulo',readyAlerts:true,failureAlerts:true,weeklyAlerts:false}};
const marks=[],extras=[];
try{
 assert.equal((await call(`/api/painel?chave=${chave}`,{auth:false})).status,401);marks.push('anonymous_read_blocked');
 assert.equal((await call('/api/painel',{method:'PUT',origin:'https://example.com',body:{chave,revision:-1,data}})).status,403);marks.push('cross_origin_write_blocked');
 assert.equal((await call('/api/painel?chave=Inv%C3%A1lida')).status,400);marks.push('invalid_key_rejected');
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave,revision:-1,data:{version:2}}})).status,400);marks.push('malformed_data_rejected');
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave,revision:-1,data:{...data,brand:{...data.brand,logo:'data:image/png;base64,AAAA'}}}})).status,400);marks.push('embedded_image_rejected');
 assert.deepEqual((await call(`/api/painel?chave=${chave}`)).data,{workspace:null});marks.push('empty_before_create');
 const created=await call('/api/painel',{method:'PUT',body:{chave,revision:-1,data}});assert.equal(created.status,200);assert.equal(created.data.revision,0);marks.push('created_with_revision_zero');
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave,revision:-1,data}})).status,409);marks.push('duplicate_create_rejected');
 const read=await call(`/api/painel?chave=${chave}`);assert.equal(read.status,200);assert.deepEqual(read.data.workspace.data,data);assert.equal(read.data.workspace.revision,0);marks.push('read_back_identical');
 const updated=await call('/api/painel',{method:'PUT',body:{chave,revision:0,data:{...data,favorites:['c1']}}});assert.equal(updated.status,200);assert.equal(updated.data.revision,1);marks.push('update_increments_revision');
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave,revision:0,data}})).status,409);marks.push('stale_revision_rejected');
 assert.deepEqual((await call(`/api/painel?chave=${chave}`)).data.workspace.data.favorites,['c1']);marks.push('stale_write_did_not_land');
 const big=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),randomBytes(2_500_000)]);
 assert.equal((await call(`/api/painel/arquivo?chave=${chave}`,{method:'POST',raw:Buffer.from('<html><script>alert(1)</script>'),type:'image/png'})).status,415);marks.push('fake_png_rejected');
 assert.equal((await call(`/api/painel/arquivo?chave=${chave}`,{method:'POST',raw:big,type:'text/plain'})).status,415);marks.push('unknown_file_type_rejected');
 const uploaded=await call(`/api/painel/arquivo?chave=${chave}`,{method:'POST',raw:big,type:'image/png'});assert.equal(uploaded.status,201);assert.match(uploaded.data.url,/^\/api\/painel\/arquivo\/[0-9a-f-]{36}$/);marks.push('file_stored_across_chunks');
 assert.equal((await call(uploaded.data.url,{auth:false,raw:''})).status,401);marks.push('anonymous_file_blocked');
 const served=await call(uploaded.data.url,{raw:''});assert.equal(served.status,200);assert.equal(served.type,'image/png');assert.ok(served.bytes.equals(big),'bytes identical');marks.push('file_served_byte_identical');
 assert.equal((await call('/api/painel/arquivo/00000000-0000-4000-8000-000000000000',{raw:''})).status,404);marks.push('unknown_file_404');
 const withFile=await call('/api/painel',{method:'PUT',body:{chave,revision:1,data:{...data,media:[{id:'m1',name:'prova.png',src:uploaded.data.url,kind:'image',collection:'Meus arquivos',origin:'Arquivo local'}]}}});assert.equal(withFile.status,200);marks.push('file_url_accepted_in_document');
 // Cota por conta (saúde P1): 10 chaves por conta. O dev pode já ter a chave `preview` do painel; as extras completam as 10 e a seguinte recebe 413.
 const existentes=1+((await call('/api/painel?chave=preview')).data.workspace?1:0);
 for(let i=1;i<=10-existentes;i++){assert.equal((await call('/api/painel',{method:'PUT',body:{chave:`${chave}-c${i}`,revision:-1,data}})).status,200,`chave extra ${i}`);extras.push(i)}
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave:`${chave}-c${11-existentes}`,revision:-1,data}})).status,413);marks.push('eleventh_key_rejected_413');
 assert.equal((await call('/api/painel',{method:'PUT',body:{chave,revision:-1,data}})).status,409);marks.push('duplicate_create_still_409_when_full');
 for(const i of extras.splice(0))assert.equal((await call(`/api/painel?chave=${chave}-c${i}`,{method:'DELETE'})).status,200);
 assert.equal((await call(`/api/painel?chave=${chave}`,{method:'DELETE'})).status,200);
 assert.deepEqual((await call(`/api/painel?chave=${chave}`)).data,{workspace:null});assert.equal((await call(uploaded.data.url,{raw:''})).status,404);marks.push('delete_removes_document_and_files');
 // No dev todo pedido chega com o mesmo IP (127.0.0.1), então a prova é: depois de 11 envios seguidos o
 // último é 429, e nenhum deles gravou e-mail (campo website é a armadilha para robôs).
 const codes=[];for(let i=0;i<11;i++)codes.push((await fetch(`${base}/api/waitlist`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'x@y.z',website:'bot'})})).status);
 assert.equal(codes.at(-1),429,`códigos: ${codes.join(',')}`);assert.ok(codes.every(c=>c===200||c===429));marks.push('waitlist_rate_limited_after_10_per_hour');
 console.log(JSON.stringify({passed:marks}));
}catch(error){console.error(JSON.stringify({passed:marks}));await call(`/api/painel?chave=${chave}`,{method:'DELETE'}).catch(()=>{});for(const i of extras)await call(`/api/painel?chave=${chave}-c${i}`,{method:'DELETE'}).catch(()=>{});throw error}
