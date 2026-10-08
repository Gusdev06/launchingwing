// Prova das cotas (saúde P1, 08/10) contra um servidor local próprio, com banco novo numa pasta temporária e um motor falso
// em node:http: nada chega ao motor real nem ao banco do dev. Precisa de npm run build antes.
//   1. seis pedidos de caso ao mesmo tempo da mesma conta: exatamente 3 entram (201) e 3 são recusados (429);
//   2. o 16º caso do dia no sistema inteiro, de outra conta, recebe 429 sem o motor ser chamado;
//   3. "Retomar geração" vale 3 vezes por geração, a 4ª recebe 400;
//   4. a 11ª chave de espaço e o arquivo que passa de 200 MB por conta recebem 413;
//   5. o 301º pedido de código por e-mail do dia, de IP e e-mail novos, recebe 429 e nenhum e-mail sai.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
const porta=8798,base=`http://127.0.0.1:${porta}`,portaMotor=8791;
const CASOS_POR_DIA=3,CASOS_NO_SISTEMA_POR_DIA=15,TENTATIVAS=3,COTA_CHAVES=10,CODIGOS_POR_DIA=300;
const estado=mkdtempSync(join(tmpdir(),'launchwing-cota-'));
const migrou=spawnSync(process.execPath,['scripts/migracoes.mjs','local'],{env:{...process.env,PERSIST_TO:estado},encoding:'utf8'});
assert.equal(migrou.status,0,'migrações no banco temporário:\n'+(migrou.stdout+migrou.stderr).slice(-2000));
// A configuração fica um nível acima de dist/server: com no_bundle o wrangler vigia a pasta do main e recarregava o Worker ao
// escrever o próprio .wrangler/tmp lá dentro (3 recargas numa rodada, upload em andamento caía com 503).
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
writeFileSync('dist/wrangler.cota.json',JSON.stringify({...config,main:'server/index.js',assets:{...config.assets,directory:'client'},d1_databases:config.d1_databases.map(d=>({...d,migrations_dir:'../migrations'}))}));
// Motor falso: /health demora 300 ms (alarga a janela entre contar e gravar), todo job termina em falha, /retry é contado.
const motor={health:0,jobs:0,retries:0};
const motorFalso=createServer((req,res)=>{
 const responder=(corpo,ms=0)=>setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(corpo))},ms);
 if(req.headers.authorization!=='Bearer prova'){res.statusCode=401;return responder({error:'token'})}
 const url=new URL(req.url,'http://motor');
 if(req.method==='GET'&&url.pathname==='/health'){motor.health++;return responder({ready:true},300)}
 if(req.method==='POST'&&url.pathname==='/jobs'){motor.jobs++;let corpo='';req.on('data',d=>{corpo+=d});req.on('end',()=>{const {kind}=JSON.parse(corpo);motor.kind=kind;responder({id:randomUUID()})});return}
 const retry=url.pathname.match(/^\/jobs\/([0-9a-f-]{36})\/retry$/);if(req.method==='POST'&&retry){motor.retries++;return responder({})}
 const job=url.pathname.match(/^\/jobs\/([0-9a-f-]{36})$/);if(req.method==='GET'&&job)return responder({id:job[1],kind:motor.kind??'analysis',status:'failed',stage:'erro',message:'O motor falso sempre falha.',progress:0,error:'Prova: falha de propósito.',result:null});
 res.statusCode=404;responder({error:'rota'});
});
await new Promise(r=>motorFalso.listen(portaMotor,'127.0.0.1',r));
let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/wrangler.cota.json','--local','--persist-to',estado,'--ip','127.0.0.1','--port',String(porta),'--inspector-port','0','--var','LOGIN_PROPRIO:1','--var','LOGIN_EMAIL_TESTE:1','--var',`LAUNCHWING_ENGINE_URL:http://127.0.0.1:${portaMotor}`,'--var','LAUNCHWING_ENGINE_TOKEN:prova'],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(teste())return true;await new Promise(r=>setTimeout(r,100))}return false};
const codigosEnviados=()=>(saida.match(/\[login-teste\] codigo para /g)??[]).length;
const marcas=[];let ip=0;
const pedir=(caminho,{method='GET',corpo,cookie,raw,type,ipDe}={})=>fetch(base+caminho,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:base}:{}),...(type?{'Content-Type':type}:corpo!==undefined?{'Content-Type':'application/json'}:{}),'CF-Connecting-IP':ipDe??`10.1.${(ip>>8)&255}.${ip++&255}`},...(raw?{body:raw}:corpo!==undefined?{body:JSON.stringify(corpo)}:{})});
const json=async r=>({status:r.status,data:await r.json().catch(()=>({}))});
// Entra com um e-mail novo pelo código de teste (aparece no registro do servidor) e devolve o cookie da sessão.
async function entrar(email){
 const antes=codigosEnviados();
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email}})).status,200,`pedido de código para ${email}`);
 const re=new RegExp(`\\[login-teste\\] codigo para ${email.replaceAll('.','\\.')}: (\\d{6})`);
 assert.ok(await esperar(()=>codigosEnviados()>antes&&re.test(saida),10000),'código não chegou ao registro');
 const r=await pedir('/api/entrar/verificar',{method:'POST',corpo:{email,codigo:saida.match(re)[1]}});assert.equal(r.status,200);
 return (r.headers.get('set-cookie')??'').split(';')[0];
}
const novoCaso=cookie=>pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',url:'https://exemplo-prova.com/produto'}}).then(json);
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const a=await entrar('a@prova.exemplo');
 assert.deepEqual((await json(await pedir('/api/pilot/engine',{cookie:a}))).data,{ready:true},'o motor falso responde ao servidor');
 // 1. Corrida: 6 pedidos ao mesmo tempo da conta A.
 const corrida=await Promise.all(Array.from({length:6},()=>novoCaso(a)));
 const status=corrida.map(r=>r.status).sort();
 assert.deepEqual(status,[201,201,201,429,429,429],`corrida de 6 pedidos: ${status.join(',')}`);
 assert.equal((await json(await pedir('/api/pilot',{cookie:a}))).data.runs.length,CASOS_POR_DIA,'casos gravados da conta A');marcas.push('corrida_6_pedidos_3_entram_3_recusados');
 // 2. Teto do sistema: B, C e D fazem 3 cada (6 + 9 = 15 pedidos ao motor no dia); o 16º, da conta E, é recusado antes do motor.
 const cookies={};for(const nome of ['b','c','d']){cookies[nome]=await entrar(`${nome}@prova.exemplo`);for(let i=0;i<CASOS_POR_DIA;i++)assert.equal((await novoCaso(cookies[nome])).status,201,`caso ${i+1} da conta ${nome}`)}
 const e=await entrar('e@prova.exemplo'),saudeAntes=motor.health;
 const decimoSexto=await novoCaso(e);
 assert.equal(decimoSexto.status,429,`16º caso do dia no sistema: ${decimoSexto.status} ${JSON.stringify(decimoSexto.data)}`);
 assert.equal(motor.health,saudeAntes,'o motor não foi chamado para o 16º caso');
 assert.match(decimoSexto.data.error??'',/limite do dia/);marcas.push(`16o_caso_do_sistema_429_sem_chamar_motor (${CASOS_NO_SISTEMA_POR_DIA} no dia)`);
 // 3. Retomar geração: a conta B tem casos em falha (o motor falso sempre falha); 3 retomadas passam, a 4ª não.
 let caso=(await json(await pedir('/api/pilot',{cookie:cookies.b}))).data.runs[0];assert.equal(caso.phase,'failed','caso em falha para retomar');
 const retriesAntes=motor.retries;
 for(let i=1;i<=TENTATIVAS;i++){const r=await json(await pedir(`/api/pilot/${caso.id}`,{method:'PATCH',cookie:cookies.b,corpo:{action:'retry',revision:caso.revision}}));assert.equal(r.status,200,`retomada ${i}: ${JSON.stringify(r.data)}`);caso=r.data.run;assert.equal(caso.phase,'failed')}
 const quarta=await json(await pedir(`/api/pilot/${caso.id}`,{method:'PATCH',cookie:cookies.b,corpo:{action:'retry',revision:caso.revision}}));
 assert.equal(quarta.status,400,`4ª retomada: ${quarta.status} ${JSON.stringify(quarta.data)}`);
 assert.equal(motor.retries-retriesAntes,TENTATIVAS,'o motor recebeu exatamente 3 /retry');marcas.push('quarta_retomada_400_motor_recebeu_3_retry');
 // 4. Cota da conta: 10 chaves de espaço cabem, a 11ª não; 10 arquivos de 19 MiB cabem, o 11º (209 MiB) não, e 1 MiB ainda cabe.
 const doc={version:1,brand:{name:'Prova',site:'',description:'',audience:'',problem:'',benefit:'',tone:'',angles:[],avoid:'',mention:'',color:'',logo:''},contents:[],media:[],plans:[],campaigns:[],favorites:[],collections:[],preferences:{language:'Português (Brasil)',timezone:'America/Sao_Paulo',readyAlerts:true,failureAlerts:true,weeklyAlerts:false}};
 for(let i=1;i<=COTA_CHAVES;i++)assert.equal((await pedir('/api/painel',{method:'PUT',cookie:a,corpo:{chave:`cota-${i}`,revision:-1,data:doc}})).status,200,`chave ${i}`);
 const chave11=await json(await pedir('/api/painel',{method:'PUT',cookie:a,corpo:{chave:'cota-11',revision:-1,data:doc}}));
 assert.equal(chave11.status,413,`11ª chave: ${chave11.status} ${JSON.stringify(chave11.data)}`);marcas.push('11a_chave_413');
 const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),randomBytes(19*1024*1024-8)]);
 for(let i=1;i<=10;i++)assert.equal((await pedir('/api/painel/arquivo?chave=cota-1',{method:'POST',cookie:a,raw:png,type:'image/png'})).status,201,`arquivo ${i} de 19 MiB`);
 const arquivo11=await json(await pedir('/api/painel/arquivo?chave=cota-1',{method:'POST',cookie:a,raw:png,type:'image/png'}));
 assert.equal(arquivo11.status,413,`11º arquivo (passa de 200 MiB): ${arquivo11.status} ${JSON.stringify(arquivo11.data)}`);
 assert.equal((await pedir('/api/painel/arquivo?chave=cota-1',{method:'POST',cookie:a,raw:png.subarray(0,1024*1024),type:'image/png'})).status,201,'1 MiB ainda cabe: a cota é por bytes');marcas.push('arquivo_acima_de_200MB_413');
 // 5. Teto de e-mails do sistema: completa 300 pedidos do dia (IP e e-mail novos a cada um) e o 301º é recusado sem enviar.
 const faltam=CODIGOS_POR_DIA-codigosEnviados();assert.ok(faltam>0);
 for(let feitos=0;feitos<faltam;){const lote=Math.min(20,faltam-feitos);const rs=await Promise.all(Array.from({length:lote},(_,i)=>pedir('/api/entrar/codigo',{method:'POST',corpo:{email:`p${feitos+i}@prova.exemplo`}})));assert.deepEqual(rs.map(r=>r.status),Array(lote).fill(200),`pedidos ${feitos+1} a ${feitos+lote}`);feitos+=lote}
 assert.ok(await esperar(()=>codigosEnviados()===CODIGOS_POR_DIA,10000),`e-mails enviados até aqui: ${codigosEnviados()}`);
 const r301=await json(await pedir('/api/entrar/codigo',{method:'POST',corpo:{email:'ultimo@prova.exemplo'}}));
 assert.equal(r301.status,429,`301º pedido de código: ${r301.status} ${JSON.stringify(r301.data)}`);
 await new Promise(r=>setTimeout(r,500));assert.equal(codigosEnviados(),CODIGOS_POR_DIA,'o 301º não gerou e-mail');marcas.push(`301o_codigo_429_sem_email (${CODIGOS_POR_DIA} no dia)`);
 console.log(JSON.stringify({ok:marcas,motor,recargasDoWorker:(saida.match(/Reloading local server/g)??[]).length}));
}catch(error){console.error(JSON.stringify({ok:marcas,motor}));console.error('registro do servidor inteiro em outputs/cota-concorrente-servidor.log; fim:\n'+saida.slice(-1500));throw error}
finally{writeFileSync('outputs/cota-concorrente-servidor.log',saida);servidor.kill('SIGTERM');motorFalso.close();await new Promise(r=>servidor.once('exit',r));rmSync(estado,{recursive:true,force:true})}
