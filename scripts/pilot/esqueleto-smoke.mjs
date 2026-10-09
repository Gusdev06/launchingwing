// Prova do esqueleto (F1), de ponta a ponta contra o servidor local (precisa de npm run build; o banco D1 é só desta prova):
// entrar -> colar o link -> a rotina agendada faz o caso andar sem a tela -> imagens guardadas na Cloudflare (abrem com o
// motor fora) -> aprovar -> a rotina posta (simulação). Também prova o limite de casos por conta.
// O motor aqui é de mentira (sem IA e sem custo): responde o contrato de lib/pilot-engine.ts e só termina a análise quando a
// prova manda, para mostrar que foi a rotina, e não a tela, que levou o caso adiante.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertPostagem} from './esqueleto-regras.mjs';

const prazoSegundos=4,porta=8797,base=`http://127.0.0.1:${porta}`,portaMotor=8796,token='t'.repeat(40),email=`esqueleto-${randomUUID().slice(0,8)}@exemplo.com`;
// ---- motor de mentira ----
const jobs=new Map(),pedidos=[];let analiseLiberada=false,arquivosNoMotor=true;
const carrossel=id=>({id,format:`Slideshow ${id} · 6 slides`,hook:`gancho ${id}`,caption:'legenda',rationale:'a\nb',provenance:'p',copy:'PAS',assets:Array.from({length:6},(_,i)=>({file:`${id}-slide-0${i+1}.jpg`,kind:'image',alt:'slide'}))});
const lote={pieces:[{id:'meme',format:'Meme em vídeo',hook:'gancho meme',caption:'legenda',rationale:'a\nb',provenance:'p',copy:'BAB',assets:[{file:'meme.mp4',kind:'video',alt:'meme',poster:'meme-capa.jpg'}]},carrossel('educativo'),carrossel('amiga')]};
const analise={context:{name:'Produto Teste',description:'Um app de teste para a prova do esqueleto.',audience:'quem testa',situations:'a\nb\nc'},facts:['faz uma coisa'],uncertainties:[],sources:[{url:'https://exemplo.com/',label:'site',checkedAt:'2026-10-06'}]};
const motor=createServer(async(req,res)=>{
 const json=(s,c)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(c))};
 if(req.headers.authorization!==`Bearer ${token}`)return json(401,{error:'não'});
 const partes=req.url.split('/').filter(Boolean);
 if(req.url==='/health')return json(200,{ready:true});
 if(req.method==='POST'&&req.url==='/jobs'){let c='';for await(const p of req)c+=p;const {key,kind}=JSON.parse(c);const id=randomUUID();jobs.set(id,{id,key,kind});pedidos.push(kind);return json(201,{id})}
 const job=jobs.get(partes[1]);if(!job)return json(404,{error:'sem job'});
 if(partes[2]==='assets'){if(!arquivosNoMotor)return json(404,{error:'apagado'});res.writeHead(200,{'Content-Type':partes[3].endsWith('.mp4')?'video/mp4':'image/jpeg'});return res.end(Buffer.from(`arquivo ${partes[3]}`))}
 const pronto=job.kind==='production'||analiseLiberada;
 return json(200,{id:job.id,kind:job.kind,status:pronto?'succeeded':'running',stage:'x',message:'x',progress:pronto?100:50,error:null,result:pronto?(job.kind==='analysis'?analise:lote):null});
});
await new Promise(ok=>motor.listen(portaMotor,'127.0.0.1',ok));

// ---- site ----
// Banco D1 numa pasta só desta prova: os limites por hora e os casos de outras rodadas (ou do npm run dev) não interferem.
const estado=mkdtempSync(join(tmpdir(),'launchwing-esqueleto-'));
const migrou=spawnSync(process.execPath,['scripts/migracoes.mjs','local'],{env:{...process.env,PERSIST_TO:estado},encoding:'utf8'});
assert.equal(migrou.status,0,'as migrações não entraram no banco da prova:\n'+(migrou.stdout+migrou.stderr).slice(-2000));
let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',estado,'--ip','127.0.0.1','--port',String(porta),'--inspector-port','0',
 '--var',`LOGIN_PROPRIO:1`,'--var','LOGIN_EMAIL_TESTE:1','--var',`LAUNCHWING_ENGINE_URL:http://127.0.0.1:${portaMotor}`,'--var',`LAUNCHWING_ENGINE_TOKEN:${token}`,'--var',`PRAZO_DESFAZER_SEGUNDOS:${prazoSegundos}`],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(await teste())return true;await new Promise(r=>setTimeout(r,250))}return false};
const marcas=[];
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const pedir=async(caminho,{method='GET',corpo,cookie}={})=>{const r=await fetch(base+caminho,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(corpo?{'Content-Type':'application/json',Origin:base}:{})},...(corpo?{body:JSON.stringify(corpo)}:{})});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,dados:d,corpo:t}};
 const rotina=async()=>{const r=await fetch(`${base}/cdn-cgi/local/scheduled?cron=*/2+*+*+*+*`);assert.equal(r.status,200,'a rotina agendada não rodou')};
 // entrar (login próprio, código no registro do servidor local)
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email}})).status,200);
 assert.ok(await esperar(()=>new RegExp(`codigo para ${email}: (\\d{6})`).test(saida),10000));
 const codigo=saida.match(new RegExp(`codigo para ${email}: (\\d{6})`))[1];
 const entrou=await fetch(base+'/api/entrar/verificar',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,codigo})});
 const cookie=(entrou.headers.get('set-cookie')??'').split(';')[0];assert.match(cookie,/lw_sessao=/);marcas.push('entrou');
 // colar o link e terminar o cadastro
 const respostas={name:'Teste',company:'Empresa Teste',team:'1',revenue:'0',role:'dono',businessModel:'B2C',categories:['app'],marketingNeed:'posts',goals:['vender'],discovery:'amigo'};
 const criado=await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',flow:'blitz',url:'https://exemplo.com/',answers:respostas}});
 assert.equal(criado.status,201,criado.corpo);let run=criado.dados.run;
 const cad=await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie,corpo:{action:'onboarding',revision:run.revision,step:10,answers:respostas,complete:true}});
 assert.equal(cad.status,200,cad.corpo);marcas.push('colou_o_link');
 assert.deepEqual(pedidos,['analysis'],'até aqui o motor só recebeu a análise');
 // daqui em diante a tela não pede nada: só a rotina
 analiseLiberada=true;
 assert.ok(await esperar(async()=>{await rotina();return pedidos.includes('production')},20000),'a rotina não pediu o lote ao motor');
 let pecas=[];
 assert.ok(await esperar(async()=>{await rotina();const r=await pedir(`/api/pilot/${run.id}`,{cookie});run=r.dados.run;pecas=run.pieces;return pecas.length===3&&run.midiaGuardada},30000),'a rotina não trouxe o lote nem guardou as imagens:\n'+JSON.stringify(run).slice(0,500));
 marcas.push('rotina_trouxe_as_pecas_sem_a_tela');
 // imagens guardadas: abrem com o motor sem os arquivos
 arquivosNoMotor=false;
 for(const p of pecas)for(const a of p.assets){const r=await fetch(base+a.url,{headers:{Cookie:cookie}});assert.equal(r.status,200,`${a.url} não abriu sem o motor`);assert.match(await r.text(),/^arquivo /);const cc=r.headers.get('cache-control')??'';assert.ok(/\bprivate\b/.test(cc)&&/max-age=86400/.test(cc),`${a.url} sem cache do navegador (PERF-05): ${cc}`)}
 // a mídia fica no cache do navegador, o JSON do caso nunca
 const ccJson=(await fetch(`${base}/api/pilot/${run.id}`,{headers:{Cookie:cookie}})).headers.get('cache-control');assert.match(ccJson??'',/no-store/,`o JSON do caso perdeu o no-store: ${ccJson}`);
 marcas.push('imagens_abrem_sem_o_motor');marcas.push('midia_em_cache_json_no_store');
 // contrato C2 (VER-02, 08/10): outra conta não vê nem muda o que é de A. Segundo login, pedidos pelos ids de A, 404 em todos e o caso de A igual.
 const emailB=`esqueleto-b-${randomUUID().slice(0,8)}@exemplo.com`;
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email:emailB}})).status,200);
 assert.ok(await esperar(()=>new RegExp(`codigo para ${emailB}: (\\d{6})`).test(saida),10000));
 const entrouB=await fetch(base+'/api/entrar/verificar',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:emailB,codigo:saida.match(new RegExp(`codigo para ${emailB}: (\\d{6})`))[1]})});
 const cookieB=(entrouB.headers.get('set-cookie')??'').split(';')[0];assert.match(cookieB,/lw_sessao=/);assert.notEqual(cookieB,cookie);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 const arquivoA=await fetch(`${base}/api/painel/arquivo?chave=esqueleto`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png'},body:png});assert.equal(arquivoA.status,201);const urlArquivoA=(await arquivoA.json()).url;
 const revisaoAntes=run.revision,pedidosDeB=[`GET /api/pilot/${run.id}`,`PATCH /api/pilot/${run.id}`,`GET ${urlArquivoA}`,`GET ${pecas[0].assets[0].url}`];
 const deB=[await pedir(`/api/pilot/${run.id}`,{cookie:cookieB}),await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie:cookieB,corpo:{action:'swipe',revision:run.revision,pieceId:pecas[0].id,direction:'right',seconds:1}}),await pedir(urlArquivoA,{cookie:cookieB}),await pedir(pecas[0].assets[0].url,{cookie:cookieB})];
 assert.deepEqual(deB.map(r=>r.status),[404,404,404,404],'a conta B alcançou dado de A: '+pedidosDeB.map((p,i)=>`${p} -> ${deB[i].status}`).join(', '));
 { const r=await fetch(base+pecas[0].assets[0].url,{headers:{Cookie:cookieB}});assert.equal(r.status,404);assert.match(r.headers.get('cache-control')??'',/no-store/,'o 404 da mídia de outra conta não pode ir para o cache') }
 run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;assert.equal(run.revision,revisaoAntes,'o PATCH de B mudou o caso de A');assert.ok(run.pieces.every(p=>p.status==='pending'),'B aprovou peça de A');
 assert.equal((await pedir(urlArquivoA,{cookie})).status,200,'o arquivo de A continua abrindo para A');marcas.push('outra_conta_nao_ve_nem_muda');
 // aprovar e a rotina postar
 const aprovado=await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie,corpo:{action:'swipe',revision:run.revision,pieceId:pecas[1].id,direction:'right',seconds:3}});
 assert.equal(aprovado.status,200,aprovado.corpo);
 // dentro do prazo para desfazer a rotina não posta (frente 3, 07/10)
 await rotina();
 run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;
 assert.equal(run.pieces.find(p=>p.id===pecas[1].id).postagem,undefined,'a rotina postou antes do prazo para desfazer');marcas.push('espera_o_prazo_para_desfazer');
 await new Promise(ok=>setTimeout(ok,(prazoSegundos+1)*1000));
 await rotina();
 run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;
 assertPostagem(run.pieces,pecas[1].id);marcas.push('aprovada_e_postada_simulacao');
 // já postada: não volta para revisão
 const desfazer=await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie,corpo:{action:'review',revision:run.revision,pieceId:pecas[1].id,status:'pending',caption:'legenda',feedback:'',seconds:0}});
 assert.equal(desfazer.status,400);assert.match(desfazer.dados.error,/já foi postada/);marcas.push('postada_nao_desfaz');
 // F2 (07/10): reprovou até sobrar 1 peça para revisar, o site pede outro lote ao motor sozinho e as peças novas chegam
 run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;
 const producoesAntes=pedidos.filter(k=>k==='production').length;
 const pendente=run.pieces.find(p=>p.status==='pending');
 const reprovou=await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie,corpo:{action:'swipe',revision:run.revision,pieceId:pendente.id,direction:'left',seconds:2}});
 assert.equal(reprovou.status,200,reprovou.corpo);
 assert.ok(await esperar(async()=>{await rotina();run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;return pedidos.filter(k=>k==='production').length>producoesAntes&&run.pieces.length===6},30000),'reprovou e não chegou outro lote:\n'+JSON.stringify(run).slice(0,400));
 assert.equal(run.pieces.filter(p=>p.status==='pending').length,4,'o lote novo chega para revisar');marcas.push('reprovou_chegou_outro_lote');
 // limite por conta: 3 casos com o motor em 24 horas
 for(let i=0;i<2;i++)assert.equal((await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',flow:'blitz',url:`https://exemplo${i}.com/`,answers:respostas}})).status,201);
 const quarto=await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',flow:'blitz',url:'https://exemplo9.com/',answers:respostas}});
 assert.equal(quarto.status,429);assert.match(quarto.dados.error,/3 casos/);marcas.push('limite_de_3_casos_por_dia');
 console.log('esqueleto-smoke ok: '+marcas.join(', '));
}catch(erro){console.error(saida.slice(-3000));throw erro}
finally{servidor.kill();motor.close();rmSync(estado,{recursive:true,force:true})}
