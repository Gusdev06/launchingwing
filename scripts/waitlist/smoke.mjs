// Prova do contrato C10: a lista de espera guarda cada e-mail uma vez e ninguém lê de fora.
// Sobe um servidor próprio sobre dist/ com um D1 temporário (precisa de npm run build antes), manda o mesmo e-mail
// duas vezes com letras e espaços diferentes, confere no banco que ficou uma linha só, que GET não devolve a lista
// e que e-mail inválido é recusado. Nada toca o banco do dev nem produção.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const porta=8798,base=`http://127.0.0.1:${porta}`,persist=mkdtempSync(join(tmpdir(),'lw-waitlist-')),banco='site-creator-d1',configMigracoes='dist/server/wrangler.migracoes.json';
const migrou=spawnSync(process.execPath,['scripts/migracoes.mjs','local'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PERSIST_TO:persist}});
assert.equal(migrou.status,0,'as migrações não entraram no D1 temporário:\n'+String(migrou.stdout)+String(migrou.stderr));

let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',persist,'--ip','127.0.0.1','--port',String(porta),'--inspector-port','0'],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(await teste())return true;await new Promise(r=>setTimeout(r,250))}return false};
const marcas=[];
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const pedir=async(method,corpo)=>{const r=await fetch(base+'/api/waitlist',{method,headers:corpo===undefined?{}:{'Content-Type':'application/json',Origin:base},...(corpo===undefined?{}:{body:JSON.stringify(corpo)})});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,dados:d,corpo:t}};
 // o mesmo e-mail duas vezes, com maiúsculas e espaços diferentes
 for(const email of ['A@x.com',' a@X.com '])assert.equal((await pedir('POST',{email})).status,200,`cadastro de ${JSON.stringify(email)} falhou`);
 const lido=spawnSync('npx',['wrangler','d1','execute',banco,'-c',configMigracoes,'--local','--persist-to',persist,'--json','--command','SELECT email FROM waitlist'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(lido.status,0,'não deu para ler a tabela waitlist:\n'+String(lido.stderr));
 const linhas=JSON.parse(String(lido.stdout))[0].results;
 assert.deepEqual(linhas,[{email:'a@x.com'}],'esperava uma linha só, normalizada: '+JSON.stringify(linhas));marcas.push('uma_linha_por_email');
 // ninguém lê de fora
 const leitura=await pedir('GET');
 assert.ok([404,405].includes(leitura.status),`GET /api/waitlist respondeu ${leitura.status}`);
 assert.ok(!leitura.corpo.includes('a@x.com'),'GET devolveu o e-mail cadastrado');marcas.push(`sem_leitura_publica_${leitura.status}`);
 // e-mail inválido é recusado e não entra
 for(const email of ['nao-e-email','a@x','',42])assert.equal((await pedir('POST',{email})).status,400,`aceitou e-mail inválido ${JSON.stringify(email)}`);
 const depois=spawnSync('npx',['wrangler','d1','execute',banco,'-c',configMigracoes,'--local','--persist-to',persist,'--json','--command','SELECT count(*) AS n FROM waitlist'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(JSON.parse(String(depois.stdout))[0].results[0].n,1,'e-mail inválido entrou na tabela');marcas.push('invalido_recusado');
 console.log('waitlist-smoke ok: '+marcas.join(', '));
}catch(erro){console.error(saida.slice(-3000));throw erro}
finally{servidor.kill();rmSync(persist,{recursive:true,force:true})}
