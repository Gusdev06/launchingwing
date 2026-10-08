// Saúde do Launchwing (08/10, pedido do dono: saber na hora quando algo quebra). A rotina de 2 minutos pergunta ao motor;
// 5 falhas seguidas (10 min) avisam no Telegram uma vez, e a volta avisa uma vez. Canário que falhou avisa uma vez por rodada.
import assert from 'node:assert/strict';
import {proximoEstado,avisoDoCanario,FALHAS_PARA_AVISAR} from '../../lib/saude-regras.ts';
const t=n=>`2026-10-08T10:${String(n).padStart(2,'0')}:00.000Z`;
let e={falhas:0,fora:false,desde:t(0)},avisos=[];
for(let i=1;i<=7;i++){const r=proximoEstado(e,false,t(i*2));e=r.estado;if(r.aviso)avisos.push(r.aviso)}
assert.equal(FALHAS_PARA_AVISAR,5);
assert.equal(avisos.length,1,'fora do ar avisa uma vez só');assert.match(avisos[0],/fora do ar há 10 min/);
assert.equal(e.fora,true);assert.equal(e.desde,t(2),'fora desde a 1ª falha, a hora da queda');
const volta=proximoEstado(e,true,t(20));assert.equal(volta.aviso,'O motor do Launchwing voltou (estava fora desde 07:02, horário de Brasília).');assert.deepEqual(volta.estado,{falhas:0,fora:false,desde:t(20)});
assert.equal(proximoEstado(volta.estado,true,t(22)).aviso,undefined,'no ar continua sem aviso');
const quase=proximoEstado({falhas:3,fora:false,desde:t(0)},true,t(8));assert.equal(quase.aviso,undefined,'falha curta não avisa');assert.equal(quase.estado.falhas,0);
const ruim={em:t(30),ok:false,motivo:'só 1 de 3 peças'};
assert.match(avisoDoCanario(undefined,ruim),/lote de teste falhou: só 1 de 3 peças/);
assert.equal(avisoDoCanario(t(30),ruim),undefined,'mesmo canário não avisa duas vezes');
assert.equal(avisoDoCanario(undefined,{em:t(31),ok:true,motivo:'ok'}),undefined,'canário bom não avisa');
assert.equal(avisoDoCanario(undefined,null),undefined);
console.log('saude-regras ok: avisa_uma_vez_aos_10_min, hora_da_queda_em_brasilia, avisa_a_volta, falha_curta_nao_avisa, canario_avisa_uma_vez');
