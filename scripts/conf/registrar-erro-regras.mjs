// Registro de erro no servidor (saúde P7, 08/10): cada catch grava uma linha JSON com o evento e a mensagem original do erro,
// nunca um rótulo fixo, e nunca um e-mail. Roda sem servidor: node scripts/conf/registrar-erro-regras.mjs
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const raiz=new URL('../../',import.meta.url),ler=f=>readFileSync(new URL(f,raiz),'utf8');
const rotas=['app/api/pilot/route.ts','app/api/pilot/[id]/route.ts','app/api/painel/route.ts','app/api/painel/arquivo/route.ts','app/api/entrar/codigo/route.ts','app/api/waitlist/route.ts','app/sair/route.ts','app/chatgpt-auth.ts','lib/rate-limit.ts'];
const rotulos=rotas.flatMap(f=>(ler(f).match(/console\.error\(["'][^"']*["']\)/g)??[]).map(m=>`${f}: ${m}`));
assert.deepEqual(rotulos,[],'catch que descarta o erro e grava rótulo fixo');
const semRegistro=rotas.filter(f=>!/registrarErro\(/.test(ler(f)));
assert.deepEqual(semRegistro,[],'arquivo com catch que não chama registrarErro');
for(const f of ['app/error.tsx','app/global-error.tsx']){assert.ok(existsSync(new URL(f,raiz)),`${f} não existe`);assert.match(ler(f),/^'use client'/,`${f} precisa de 'use client'`);assert.match(ler(f),/reset\(\)/,`${f} precisa do botão de tentar de novo`)}
const {registrarErro}=await import('../../lib/registrar-erro.ts');
const linhas=[],original=console.error;console.error=(...a)=>linhas.push(a.join(' '));
try{
 registrarErro('painel_salvar',new Error('D1_ERROR: no such table: workspaces'));
 registrarErro('rate_limit','texto solto');
 registrarErro('login_codigo_envio',Object.assign(new Error('Resend recusou'),{status:422}),{email:'ana@exemplo.com',tentativa:2});
 registrarErro('pilot_criar',new Error('motor recusou ana.silva+x@exemplo.com.br'),{dono:'Ana <ana@exemplo.com>'});
}finally{console.error=original}
assert.equal(linhas.length,4,'uma linha por erro');
const json=linhas.map(l=>JSON.parse(l));
assert.deepEqual(json[0],{evento:'painel_salvar',erro:'D1_ERROR: no such table: workspaces'},'a linha é JSON com evento e a mensagem original');
assert.deepEqual(json[1],{evento:'rate_limit',erro:'texto solto'},'erro que não é Error vira texto');
assert.equal(json[2].status,422,'status do erro entra na linha');assert.equal(json[2].tentativa,2,'extra entra na linha');
assert.ok(!linhas.some(l=>/@/.test(l)),'e-mail nunca entra no registro: '+linhas.filter(l=>/@/.test(l)).join(' | '));
assert.equal(json[2].email,'[e-mail]');assert.match(json[3].erro,/motor recusou \[e-mail\]/);
console.log('registrar-erro ok: sem_rotulo_fixo, todos_chamam_registrarErro, error_tsx_existe, linha_json_com_causa, status_e_extra, sem_email');
