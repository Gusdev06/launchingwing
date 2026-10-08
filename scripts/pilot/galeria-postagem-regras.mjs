// F1 na tela (07/10): a rotina marcava a peça como "postada (simulação)", mas nenhuma tela mostrava isso ao cliente. O texto só
// existia numa lista lateral que o painel novo não exibe. O cartão da Galeria passa a dizer o estado da postagem.
import assert from 'node:assert/strict';
import {rotuloDaPostagem} from '../../lib/postagem.ts';
// Sem as redes ligadas nada é postado de verdade (reunião de 07/10): o cartão diz "Pronta para postar", nunca "Postada".
assert.equal(rotuloDaPostagem({status:'approved',postagem:{status:'postada',em:'2026-10-07T07:58:00.000Z',simulacao:true}}),'Pronta para postar');
assert.equal(rotuloDaPostagem({status:'approved',postagem:{status:'postada',em:'2026-10-07T07:58:00.000Z',simulacao:false}}),'Postada em 07/10, 04:58');
assert.equal(rotuloDaPostagem({status:'approved'}),'Pronta para postar','com a postagem simulada, aprovada também não está "na fila"');
assert.equal(rotuloDaPostagem({status:'pending'}),undefined);
assert.equal(rotuloDaPostagem({status:'rejected'}),undefined);
console.log('galeria-postagem-regras ok');
