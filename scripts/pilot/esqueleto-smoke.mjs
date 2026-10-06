// Prova do esqueleto (F1), de ponta a ponta contra o servidor local (precisa de npm run build e npm run db:migrate:local):
// entrar -> colar o link -> a rotina agendada faz o caso andar sem a tela -> imagens guardadas na Cloudflare (abrem com o
// motor fora) -> aprovar -> a rotina posta (simulação). Também prova o limite de casos por conta.
// O motor aqui é de mentira (sem IA e sem custo): responde o contrato de lib/pilot-engine.ts e só termina a análise quando a
// prova manda, para mostrar que foi a rotina, e não a tela, que levou o caso adiante.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {assertPostagem} from './esqueleto-regras.mjs';

const porta=8797,base=`http://127.0.0.1:${porta}`,portaMotor=8796,token='t'.repeat(40),email='esqueleto@exemplo.com';
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
let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port',String(porta),'--inspector-port','0','--test-scheduled',
 '--var',`LOGIN_PROPRIO:1`,'--var','LOGIN_EMAIL_TESTE:1','--var',`LAUNCHWING_ENGINE_URL:http://127.0.0.1:${portaMotor}`,'--var',`LAUNCHWING_ENGINE_TOKEN:${token}`],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(await teste())return true;await new Promise(r=>setTimeout(r,250))}return false};
const marcas=[];
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const pedir=async(caminho,{method='GET',corpo,cookie}={})=>{const r=await fetch(base+caminho,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(corpo?{'Content-Type':'application/json',Origin:base}:{})},...(corpo?{body:JSON.stringify(corpo)}:{})});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,dados:d,corpo:t}};
 const rotina=async()=>{const r=await fetch(`${base}/__scheduled?cron=*/2+*+*+*+*`);assert.equal(r.status,200,'a rotina agendada não rodou')};
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
 for(const p of pecas)for(const a of p.assets){const r=await fetch(base+a.url,{headers:{Cookie:cookie}});assert.equal(r.status,200,`${a.url} não abriu sem o motor`);assert.match(await r.text(),/^arquivo /)}
 marcas.push('imagens_abrem_sem_o_motor');
 // aprovar e a rotina postar
 const aprovado=await pedir(`/api/pilot/${run.id}`,{method:'PATCH',cookie,corpo:{action:'swipe',revision:run.revision,pieceId:pecas[1].id,direction:'right',seconds:3}});
 assert.equal(aprovado.status,200,aprovado.corpo);
 await rotina();
 run=(await pedir(`/api/pilot/${run.id}`,{cookie})).dados.run;
 assertPostagem(run.pieces,pecas[1].id);marcas.push('aprovada_e_postada_simulacao');
 // limite por conta: 3 casos com o motor em 24 horas
 for(let i=0;i<2;i++)assert.equal((await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',flow:'blitz',url:`https://exemplo${i}.com/`,answers:respostas}})).status,201);
 const quarto=await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'api',flow:'blitz',url:'https://exemplo9.com/',answers:respostas}});
 assert.equal(quarto.status,429);assert.match(quarto.dados.error,/3 casos/);marcas.push('limite_de_3_casos_por_dia');
 console.log('esqueleto-smoke ok: '+marcas.join(', '));
}catch(erro){console.error(saida.slice(-3000));throw erro}
finally{servidor.kill();motor.close()}
