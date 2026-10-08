// Prova das regras do login próprio por código no e-mail, sem servidor e sem envio real (banco em memória, Resend falso).
import assert from 'node:assert/strict';
import {pedirCodigo,verificarCodigo,usuarioDaSessao,sair,lembrarUsuario,enviarPorResend,CODIGO_MS,SESSAO_MS,TENTATIVAS} from '../../lib/login-codigo.ts';
function lojaEmMemoria(){
 const codigos=new Map(),usuarios=new Map(),sessoes=new Map(),contagem={comparacoes:0};
 // pegarCodigo devolve uma cópia cujo hash conta quantas vezes foi lido: cada leitura é uma comparação feita por verificarCodigo.
 return {codigos,sessoes,contagem,
  pegarCodigo:async e=>{const c=codigos.get(e);return c?{expira:c.expira,tentativas:c.tentativas,get hash(){contagem.comparacoes++;return c.hash}}:null},salvarCodigo:async(e,hash,expira)=>{codigos.set(e,{hash,expira,tentativas:0})},
  somarTentativa:async e=>{const c=codigos.get(e);if(c)c.tentativas++;return c?.tentativas??0},apagarCodigo:async e=>{codigos.delete(e)},
  consumirCodigo:async(e,hash)=>{const c=codigos.get(e);if(!c||c.hash!==hash)return false;codigos.delete(e);return true},
  acharUsuario:async e=>usuarios.get(e)??null,criarUsuario:async(id,e)=>{if(!usuarios.has(e))usuarios.set(e,{id,email:e});return usuarios.get(e)},
  salvarSessao:async(hash,u,expira)=>{sessoes.set(hash,{...u,expira})},acharSessao:async hash=>sessoes.get(hash)??null,apagarSessao:async hash=>{sessoes.delete(hash)}};
}
let agora=1_800_000_000_000;const relogio=()=>agora;
const caixa=[];const enviar=async(email,codigo)=>{caixa.push({email,codigo})};
const loja=lojaEmMemoria();
const marcas=[];
// E-mail inválido não gera código.
assert.equal((await pedirCodigo(loja,'nao-e-email',enviar,relogio)).ok,false);marcas.push('email_invalido');
// Pede o código: vai 1 e-mail com 6 dígitos; o banco guarda só o resumo (hash), nunca o código.
assert.equal((await pedirCodigo(loja,' Ana@Exemplo.com ',enviar,relogio)).ok,true);
assert.equal(caixa.length,1);assert.equal(caixa[0].email,'ana@exemplo.com');assert.match(caixa[0].codigo,/^\d{6}$/);
assert.ok(!JSON.stringify([...loja.codigos.values()]).includes(caixa[0].codigo));marcas.push('codigo_enviado_e_guardado_em_hash');
// Código errado: recusa; depois de TENTATIVAS erradas, o código morre e nem o certo entra.
const certo=caixa[0].codigo,errado=certo==='000000'?'111111':'000000';
assert.equal((await verificarCodigo(loja,'ana@exemplo.com',errado,relogio)).ok,false);marcas.push('codigo_errado_recusado');
for(let i=1;i<TENTATIVAS;i++)await verificarCodigo(loja,'ana@exemplo.com',errado,relogio);
assert.equal((await verificarCodigo(loja,'ana@exemplo.com',certo,relogio)).ok,false);marcas.push('tentativas_esgotadas');
// Código expirado não entra.
await pedirCodigo(loja,'ana@exemplo.com',enviar,relogio);agora+=CODIGO_MS+1;
assert.equal((await verificarCodigo(loja,'ana@exemplo.com',caixa.at(-1).codigo,relogio)).ok,false);marcas.push('codigo_expirado');
// Código certo: entra, cria o usuário e uma sessão; o mesmo código não serve duas vezes.
await pedirCodigo(loja,'ana@exemplo.com',enviar,relogio);const novo=caixa.at(-1).codigo;
const r=await verificarCodigo(loja,'ana@exemplo.com',novo,relogio);assert.equal(r.ok,true);assert.ok(r.token&&r.token.length>=40);
assert.equal((await verificarCodigo(loja,'ana@exemplo.com',novo,relogio)).ok,false);marcas.push('entra_uma_vez');
assert.ok(!loja.sessoes.has(r.token),'a sessão fica guardada por hash, não pelo token');
const u=await usuarioDaSessao(loja,r.token,relogio);assert.equal(u?.email,'ana@exemplo.com');assert.ok(u?.userId);marcas.push('sessao_valida');
assert.equal(await usuarioDaSessao(loja,'token-inventado',relogio),null);marcas.push('token_inventado_recusado');
// Sessão vence em SESSAO_MS; sair apaga na hora.
agora+=SESSAO_MS+1;assert.equal(await usuarioDaSessao(loja,r.token,relogio),null);marcas.push('sessao_vencida');
await pedirCodigo(loja,'ana@exemplo.com',enviar,relogio);const r2=await verificarCodigo(loja,'ana@exemplo.com',caixa.at(-1).codigo,relogio);
await sair(loja,r2.token);assert.equal(await usuarioDaSessao(loja,r2.token,relogio),null);marcas.push('sair_apaga_sessao');
// Mesmo dono de antes: quem já entrou pelo Access fica com o mesmo identificador quando passar a entrar por código.
await lembrarUsuario(loja,'id-do-access','bia@exemplo.com');
await pedirCodigo(loja,'bia@exemplo.com',enviar,relogio);const rb=await verificarCodigo(loja,'bia@exemplo.com',caixa.at(-1).codigo,relogio);
assert.equal((await usuarioDaSessao(loja,rb.token,relogio))?.userId,'id-do-access');marcas.push('mesmo_dono_do_access');
// Envio pelo Resend: chama a API com a chave e o remetente; erro da API vira falha, sem vazar o código no erro.
let pedido;const ok=await enviarPorResend(async(u,i)=>{pedido={u,i};return new Response('{}',{status:200})},{chave:'re_teste',de:'Launchwing <entrar@exemplo.com>'})('ana@exemplo.com','123456');
assert.equal(ok,undefined);assert.equal(pedido.u,'https://api.resend.com/emails');assert.equal(pedido.i.headers.Authorization,'Bearer re_teste');assert.match(pedido.i.body,/123456/);
await assert.rejects(enviarPorResend(async()=>new Response('{}',{status:422}),{chave:'x',de:'y'})('ana@exemplo.com','654321'),e=>!String(e.message).includes('654321'));marcas.push('resend');
// Clique duplo: dois pedidos ao mesmo tempo com o código certo abrem UMA sessão só. Em sequência não prova nada: o segundo já falhava.
await pedirCodigo(loja,'caio@exemplo.com',enviar,relogio);const codigoCaio=caixa.at(-1).codigo;
const dupla=await Promise.all([verificarCodigo(loja,'caio@exemplo.com',codigoCaio,relogio),verificarCodigo(loja,'caio@exemplo.com',codigoCaio,relogio)]);
assert.deepEqual(dupla.map(r=>r.ok).sort(),[false,true],'dois pedidos simultâneos com o código certo: um entra, o outro falha');marcas.push('codigo_certo_em_paralelo_entra_uma_vez');
// Rajada: 7 chutes errados ao mesmo tempo comparam no máximo TENTATIVAS vezes; os demais morrem antes de olhar o hash.
await pedirCodigo(loja,'caio@exemplo.com',enviar,relogio);const erradoCaio=caixa.at(-1).codigo==='000000'?'111111':'000000';loja.contagem.comparacoes=0;
const rajada=await Promise.all(Array.from({length:TENTATIVAS+2},()=>verificarCodigo(loja,'caio@exemplo.com',erradoCaio,relogio)));
assert.ok(rajada.every(r=>!r.ok));assert.ok(loja.contagem.comparacoes<=TENTATIVAS,`${loja.contagem.comparacoes} comparações em paralelo, o teto é ${TENTATIVAS}`);marcas.push('rajada_paralela_compara_no_maximo_5');
// Resend pendurado: a chamada desiste em menos de 11 s. O fetch falso só termina se for abortado pelo signal, como o fetch de verdade.
const inicio=Date.now();let vigia;const pendurado=enviarPorResend((u,i)=>new Promise((_,rej)=>{i.signal?.addEventListener('abort',()=>rej(i.signal.reason))}),{chave:'x',de:'y'})('ana@exemplo.com','111111');
await assert.rejects(Promise.race([pendurado,new Promise((_,rej)=>{vigia=setTimeout(()=>rej(new Error('sem_timeout')),11000)})]),e=>e.name==='TimeoutError');clearTimeout(vigia);
assert.ok(Date.now()-inicio<11000);marcas.push('resend_desiste_em_10s');
console.log('regras-smoke ok:',marcas.join(', '));
