// Prova de ponta a ponta do login próprio contra o servidor local (precisa de npm run build; o banco D1 é só desta prova).
// Liga o servidor com LOGIN_PROPRIO=1 e o carteiro de teste (o código aparece no registro do servidor, só no localhost).
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const porta=8799,base=`http://127.0.0.1:${porta}`,email='teste-login@exemplo.com';
// Banco D1 numa pasta só desta prova: o limite de pedidos por hora de outras rodadas (ou do npm run dev) não interfere.
const estado=mkdtempSync(join(tmpdir(),'launchwing-login-'));
const migrou=spawnSync(process.execPath,['scripts/migracoes.mjs','local'],{env:{...process.env,PERSIST_TO:estado},encoding:'utf8'});
assert.equal(migrou.status,0,'as migrações não entraram no banco da prova:\n'+(migrou.stdout+migrou.stderr).slice(-2000));
let saida='';
const servidor=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',estado,'--ip','127.0.0.1','--port',String(porta),'--inspector-port','0','--var','LOGIN_PROPRIO:1','--var','LOGIN_EMAIL_TESTE:1'],{stdio:['ignore','pipe','pipe']});
servidor.stdout.on('data',d=>{saida+=d});servidor.stderr.on('data',d=>{saida+=d});
const esperar=async(teste,ms)=>{const fim=Date.now()+ms;while(Date.now()<fim){if(teste())return true;await new Promise(r=>setTimeout(r,250))}return false};
const marcas=[];
try{
 assert.ok(await esperar(()=>/Ready on/i.test(saida),90000),'o servidor local não ligou:\n'+saida.slice(-2000));
 const pedir=(caminho,{method='GET',corpo,cookie,origem=base}={})=>fetch(base+caminho,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(corpo?{'Content-Type':'application/json',Origin:origem}:{})},...(corpo?{body:JSON.stringify(corpo)}:{})});
 assert.equal((await pedir('/api/pilot')).status,401);marcas.push('api_sem_sessao_401');
 const pagina=await pedir('/piloto');assert.ok([302,303,307,308].includes(pagina.status),'página privada sem sessão redireciona');assert.match(pagina.headers.get('location')??'',/\/entrar\?return_to=%2Fpiloto/);marcas.push('pagina_sem_sessao_vai_para_entrar');
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email},origem:'https://outro.exemplo'})).status,403);marcas.push('outra_origem_403');
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email:'nao-e-email'}})).status,400);marcas.push('email_invalido_400');
 assert.equal((await pedir('/api/entrar/codigo',{method:'POST',corpo:{email}})).status,200);
 const achou=await esperar(()=>new RegExp(`\\[login-teste\\] codigo para ${email}: (\\d{6})`).test(saida),10000);assert.ok(achou,'o código não chegou ao carteiro de teste');
 const codigo=saida.match(new RegExp(`\\[login-teste\\] codigo para ${email}: (\\d{6})`))[1];marcas.push('codigo_enviado');
 assert.equal((await pedir('/api/entrar/verificar',{method:'POST',corpo:{email,codigo:codigo==='000000'?'111111':'000000'}})).status,401);marcas.push('codigo_errado_401');
 const entrou=await pedir('/api/entrar/verificar',{method:'POST',corpo:{email,codigo}});assert.equal(entrou.status,200);
 const setCookie=entrou.headers.get('set-cookie')??'';assert.match(setCookie,/lw_sessao=[\w-]{40,}/);assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);
 const cookie=setCookie.split(';')[0];marcas.push('codigo_certo_abre_sessao_httponly');
 assert.equal((await pedir('/api/entrar/verificar',{method:'POST',corpo:{email,codigo}})).status,401);marcas.push('codigo_nao_serve_duas_vezes');
 assert.equal((await pedir('/api/pilot',{cookie})).status,200);marcas.push('api_com_sessao_200');
 const jaDentro=await pedir('/entrar',{cookie});assert.match(jaDentro.headers.get('location')??'',/\/piloto/);marcas.push('entrar_com_sessao_vai_para_piloto');
 assert.equal((await pedir('/api/pilot',{cookie:'lw_sessao=inventado-'+'x'.repeat(40)})).status,401);marcas.push('cookie_inventado_401');
 const saiu=await pedir('/sair',{cookie});assert.equal(saiu.status,303);assert.match(saiu.headers.get('location')??'',/\/entrar/);assert.match(saiu.headers.get('set-cookie')??'',/Max-Age=0/);
 assert.equal((await pedir('/api/pilot',{cookie})).status,401,'depois de sair, o cookie antigo não vale mais');marcas.push('sair_derruba_a_sessao_no_servidor');
 let ultimo=0;for(let i=0;i<6;i++)ultimo=(await pedir('/api/entrar/codigo',{method:'POST',corpo:{email}})).status;
 assert.equal(ultimo,429);marcas.push('limite_de_pedidos_429');
 console.log('rotas-smoke ok:',marcas.join(', '));
}finally{servidor.kill('SIGTERM');rmSync(estado,{recursive:true,force:true})}
