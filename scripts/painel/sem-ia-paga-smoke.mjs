// Prova do contrato C4: nenhuma chamada paga de IA sai do site. Sobe um provedor falso em
// 127.0.0.1:8790 (o endereço que a chave de teste apontava), pede uma imagem pela rota antiga e
// confere que a rota não existe mais (404) e que o falso não recebeu nada. Roda com o dev ligado,
// de preferência com a chave de teste ainda em .dev.vars: a chave não pode religar nada.
// Também varre app/, lib/ e scripts/: nenhum arquivo cita o provedor antigo (o padrão usa colchetes
// para este arquivo não se citar).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
const base='http://localhost:5173';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
let chamadas=0;
const fake=createServer((req,res)=>{chamadas++;req.on('data',()=>{});req.on('end',()=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{b64_json:PNG.toString('base64')}]}))})});
await new Promise(r=>fake.listen(8790,'127.0.0.1',r));
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/painel`,{redirect:'manual'});
const cookie=signIn.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local sign-in cookie');
const marks=[];
try{
 const post=await fetch(`${base}/api/painel/arte`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({chave:'prova-c4',prompt:'um gato astronauta na lua'})});
 assert.equal(chamadas,0,`o provedor pago recebeu ${chamadas} chamada(s) depois do POST`);marks.push('nenhuma_chamada_paga_saiu');
 assert.equal(post.status,404,`POST /api/painel/arte respondeu ${post.status}`);marks.push('rota_de_geracao_404');
 assert.equal((await fetch(`${base}/api/painel/arte`,{headers:{Cookie:cookie}})).status,404);marks.push('rota_de_estado_404');
 assert.equal((await fetch(`${base}/api/painel/arte/00000000-0000-4000-8000-000000000000`,{headers:{Cookie:cookie}})).status,404);marks.push('rota_de_consulta_404');
 const varredura=spawnSync('grep',['-rliE','open[a]i|run[p]od','app','lib','scripts'],{encoding:'utf8'});
 const citam=varredura.stdout.split('\n').filter(Boolean);assert.deepEqual(citam,[],`ainda citam o provedor pago: ${citam.join(', ')}`);marks.push('codigo_sem_provedor_pago');
 console.log(JSON.stringify({passed:marks,chamadasPagas:chamadas}));
}catch(error){console.error(JSON.stringify({passed:marks,chamadasPagas:chamadas}));throw error}
finally{fake.close()}
