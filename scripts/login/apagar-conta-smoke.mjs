// Prova de que uma conta some inteira (DAD-04, LGPD) e de que sessões e códigos vencidos saem na rotina.
// Sobe um servidor próprio sobre dist/ com um D1 e um KV temporários (precisa de npm run build antes). Duas contas pelo
// código de login, cada uma com caso, espaço, arquivo, art_job, mídia no KV e sessão. Apaga A por POST /api/interno/apagar-conta
// (APAGAR_CONTA_CHAVE no cabeçalho x-chave; a do fundo verde não serve): as 9 tabelas (com rate_limits) e o KV de A ficam em 0, os números de B não mudam, o cookie antigo de A
// recebe 401. Sessão e código vencidos (gravados por SQL) somem depois da rotina agendada e os válidos ficam. Nada toca produção.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const porta=8793,base=`http://127.0.0.1:${porta}`,chave='c'.repeat(40),chaveFundoVerde='f'.repeat(40),estado=mkdtempSync(join(tmpdir(),'launchwing-apagar-conta-')),configMigracoes='dist/server/wrangler.migracoes.json';
const migrou=spawnSync(process.execPath,['scripts/migracoes.mjs','local'],{env:{...process.env,PERSIST_TO:estado},encoding:'utf8'});
assert.equal(migrou.status,0,'as migrações não entraram no banco da prova:\n'+(migrou.stdout+migrou.stderr).slice(-2000));
const banco=JSON.parse(readFileSync(configMigracoes,'utf8')).d1_databases[0].database_name;
const wrangler=args=>{const r=spawnSync('npx',['wrangler',...args],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});assert.equal(r.status,0,`wrangler ${args.slice(0,3).join(' ')} falhou:\n`+String(r.stderr).slice(-1500));return String(r.stdout)};
const sql=comando=>JSON.parse(wrangler(['d1','execute',banco,'-c',configMigracoes,'--local','--persist-to',estado,'--json','--command',comando]))[0].results;
const kvListar=prefixo=>JSON.parse(wrangler(['kv','key','list','--binding','MIDIA','-c','dist/server/wrangler.json','--local','--persist-to',estado,'--prefix',prefixo])).map(k=>k.name);
const kvGravar=(nome,valor)=>wrangler(['kv','key','put','--binding','MIDIA','-c','dist/server/wrangler.json','--local','--persist-to',estado,nome,valor]);

let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',estado,'--ip','127.0.0.1','--port',String(porta),'--inspector-port','0',
 '--var','LOGIN_PROPRIO:1','--var','LOGIN_EMAIL_TESTE:1','--var',`APAGAR_CONTA_CHAVE:${chave}`,'--var',`FUNDO_VERDE_CHAVE:${chaveFundoVerde}`],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
// Sem keep-alive: entre uma chamada e outra o teste fica segundos parado no wrangler e o servidor fecha a conexão ociosa.
const f=(url,o={})=>fetch(url,{...o,headers:{Connection:'close',...(o.headers??{})}});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(await teste())return true;await new Promise(r=>setTimeout(r,250))}return false};
const marcas=[];
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const pedir=async(caminho,{method='GET',corpo,cookie,cabecalhos={}}={})=>{const r=await f(base+caminho,{method,redirect:'manual',headers:{...cabecalhos,...(cookie?{Cookie:cookie}:{}),...(corpo?{'Content-Type':'application/json',Origin:base}:{})},...(corpo?{body:JSON.stringify(corpo)}:{})});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,dados:d,corpo:t}};
 const rotina=async()=>{const r=await f(`${base}/cdn-cgi/local/scheduled?cron=*/2+*+*+*+*`);assert.equal(r.status,200,'a rotina agendada não rodou')};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 // Uma conta completa: entra pelo código, cria um caso (demo), um arquivo num espaço, e por SQL o espaço, um art_job, uma peça com mídia no KV.
 const conta=async nome=>{
  const email=`${nome}-${randomUUID().slice(0,8)}@exemplo.com`,job=`job-${nome}`;
  assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email}})).status,200);
  assert.ok(await esperar(()=>new RegExp(`codigo para ${email}: (\\d{6})`).test(saida),10000),'o código não chegou ao carteiro de teste');
  const entrou=await f(base+'/api/entrar/verificar',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,codigo:saida.match(new RegExp(`codigo para ${email}: (\\d{6})`))[1]})});
  const cookie=(entrou.headers.get('set-cookie')??'').split(';')[0];assert.match(cookie,/lw_sessao=/);
  const caso=await pedir('/api/pilot',{method:'POST',cookie,corpo:{mode:'demo',url:'https://exemplo.com/'}});assert.equal(caso.status,201,caso.corpo);
  const arquivo=await f(`${base}/api/painel/arquivo?chave=${nome}`,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png'},body:png});assert.equal(arquivo.status,201);
  const [{id}]=sql(`SELECT id FROM usuarios WHERE email='${email}'`);
  const agora=new Date().toISOString(),dados=JSON.stringify({pieces:[{assets:[{url:`/api/pilot/${caso.dados.run.id}/assets/${job}/meme.mp4`,poster:`/api/pilot/${caso.dados.run.id}/assets/${job}/meme-capa.jpg`}]}]});
  sql(`INSERT INTO workspaces (owner_id,key,data,revision,created_at,updated_at) VALUES ('${id}','${nome}','{}',0,'${agora}','${agora}'); INSERT INTO art_jobs (id,owner_id,workspace_key,runpod_id,status,prompt,width,height,seed,created_at,updated_at) VALUES ('${randomUUID()}','${id}','${nome}','r','erro','p',1,1,1,'${agora}','${agora}'); INSERT INTO pilot_runs (id,owner_id,data,revision,created_at,updated_at) VALUES ('${randomUUID()}','${id}','${dados.replace(/'/g,"''")}',0,'${agora}','${agora}')`);
  sql(`INSERT INTO rate_limits (key,window_start,count) VALUES ('painel:${id}',${Date.now()},1)`);
  kvGravar(`${job}/meme.mp4`,'video');kvGravar(`${job}/meme-capa.jpg`,'capa');
  // Os pedaços contam pelos ids guardados agora: depois de apagar, workspace_files não serve mais de ponte.
  const arquivos=sql(`SELECT id FROM workspace_files WHERE owner_id='${id}'`).map(r=>`'${r.id}'`).join(',');
  return {email,cookie,id,job,arquivos};
 };
 const A=await conta('a'),B=await conta('b');marcas.push('duas_contas_completas');
 const contagem=c=>{
  const [r]=sql(`SELECT (SELECT COUNT(*) FROM usuarios WHERE id='${c.id}') AS usuarios,(SELECT COUNT(*) FROM sessoes WHERE user_id='${c.id}') AS sessoes,(SELECT COUNT(*) FROM login_codigos WHERE email='${c.email}') AS login_codigos,(SELECT COUNT(*) FROM pilot_runs WHERE owner_id='${c.id}') AS pilot_runs,(SELECT COUNT(*) FROM workspaces WHERE owner_id='${c.id}') AS workspaces,(SELECT COUNT(*) FROM workspace_files WHERE owner_id='${c.id}') AS workspace_files,(SELECT COUNT(*) FROM workspace_file_chunks WHERE file_id IN (${c.arquivos})) AS workspace_file_chunks,(SELECT COUNT(*) FROM rate_limits WHERE key IN ('entrar-email:${c.email}','painel:${c.id}','arquivo:${c.id}')) AS rate_limits,(SELECT COUNT(*) FROM art_jobs WHERE owner_id='${c.id}') AS art_jobs`);
  return {...r,midia:kvListar(`${c.job}/`).length};
 };
 // Código de login pendente para cada conta, para provar que ele também sai.
 for(const c of [A,B])assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email:c.email}})).status,200);
 const antesA=contagem(A),antesB=contagem(B);
 const cheio={usuarios:1,sessoes:1,login_codigos:1,pilot_runs:2,workspaces:1,workspace_files:1,workspace_file_chunks:1,art_jobs:1,rate_limits:3,midia:2};
 assert.deepEqual(antesA,cheio,'a conta A não ficou completa: '+JSON.stringify(antesA));assert.deepEqual(antesB,cheio,'a conta B não ficou completa: '+JSON.stringify(antesB));
 // sem a chave interna, nada acontece
 assert.equal((await pedir('/api/interno/apagar-conta',{method:'POST',corpo:{email:A.email}})).status,401,'apagar conta sem chave precisa dar 401');
 assert.equal((await pedir('/api/interno/apagar-conta',{method:'POST',corpo:{email:A.email},cabecalhos:{'x-chave':'errada'}})).status,401,'apagar conta com chave errada precisa dar 401');
 assert.equal((await pedir('/api/interno/apagar-conta',{method:'POST',corpo:{email:A.email},cabecalhos:{'x-chave':chaveFundoVerde}})).status,401,'a chave do fundo verde não pode apagar conta');
 assert.deepEqual(contagem(A),cheio,'sem chave válida a conta A mudou');marcas.push('sem_chave_401_fundo_verde_401');
 // apaga A
 const apagou=await pedir('/api/interno/apagar-conta',{method:'POST',corpo:{email:A.email.toUpperCase()},cabecalhos:{'x-chave':chave}});
 assert.equal(apagou.status,200,`apagar conta respondeu ${apagou.status}: ${apagou.corpo}`);
 const depoisA=contagem(A),zerado=Object.fromEntries(Object.keys(cheio).map(k=>[k,0]));
 assert.deepEqual(depoisA,zerado,'sobrou dado de A: '+JSON.stringify(depoisA));
 assert.deepEqual(contagem(B),antesB,'apagar A mexeu em B');
 for(const [tabela,n] of Object.entries(cheio))if(tabela!=='midia')assert.equal(apagou.dados.apagados?.[tabela],n,`a resposta não contou ${tabela}: ${apagou.corpo}`);
 assert.equal(apagou.dados.apagados?.midia,2,'a resposta não contou as mídias: '+apagou.corpo);marcas.push('conta_a_zerada_b_intacta');
 assert.equal((await pedir('/api/pilot',{cookie:A.cookie})).status,401,'o cookie antigo de A ainda entra');
 assert.equal((await pedir('/api/pilot',{cookie:B.cookie})).status,200,'o cookie de B parou de entrar');marcas.push('cookie_de_a_401');
 assert.equal((await pedir('/api/interno/apagar-conta',{method:'POST',corpo:{email:A.email},cabecalhos:{'x-chave':chave}})).status,404,'apagar de novo precisa dar 404');marcas.push('segunda_vez_404');
 // sessão e código vencidos somem na rotina, os válidos ficam
 const vencido=Date.now()-60000;
 sql(`INSERT INTO sessoes (hash,user_id,email,expira) VALUES ('vencida-${randomUUID()}','${B.id}','${B.email}',${vencido}); INSERT INTO login_codigos (email,hash,expira,tentativas) VALUES ('vencido@exemplo.com','h',${vencido},0); INSERT INTO rate_limits (key,window_start,count) VALUES ('entrar:203.0.113.9',${Date.now()-2*86400000},1)`);
 const vencidos=()=>sql(`SELECT (SELECT COUNT(*) FROM sessoes WHERE expira<${Date.now()}) AS sessoes_vencidas,(SELECT COUNT(*) FROM login_codigos WHERE expira<${Date.now()}) AS codigos_vencidos,(SELECT COUNT(*) FROM sessoes WHERE user_id='${B.id}') AS sessoes_b,(SELECT COUNT(*) FROM login_codigos WHERE email='${B.email}') AS codigos_b,(SELECT COUNT(*) FROM rate_limits WHERE key='entrar:203.0.113.9') AS limite_velho,(SELECT COUNT(*) FROM rate_limits WHERE key='painel:${B.id}') AS limite_b`)[0];
 assert.deepEqual(vencidos(),{sessoes_vencidas:1,codigos_vencidos:1,sessoes_b:2,codigos_b:1,limite_velho:1,limite_b:1});
 await rotina();
 const depois=vencidos();
 assert.equal(depois.sessoes_vencidas,0,'a sessão vencida continua no banco depois da rotina');
 assert.equal(depois.codigos_vencidos,0,'o código vencido continua no banco depois da rotina');
 assert.equal(depois.sessoes_b,1,'a rotina apagou a sessão válida de B');
 assert.equal(depois.codigos_b,1,'a rotina apagou o código válido de B');
 assert.equal(depois.limite_velho,0,'o limite de taxa de 2 dias atrás continua no banco depois da rotina');
 assert.equal(depois.limite_b,1,'a rotina apagou o limite de taxa da janela atual');
 assert.equal((await pedir('/api/pilot',{cookie:B.cookie})).status,200);marcas.push('vencidos_somem_na_rotina_validos_ficam');
 console.log('apagar-conta-smoke ok: '+marcas.join(', '));
}catch(erro){console.error(saida.slice(-3000));throw erro}
finally{servidor.kill();rmSync(estado,{recursive:true,force:true})}
