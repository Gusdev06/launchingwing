// F1 na tela (07/10): a rotina marcava a peça como "postada (simulação)", mas nenhuma tela mostrava isso ao cliente. O texto só
// existia numa lista lateral que o painel novo não exibe. O cartão da Galeria passa a dizer o estado da postagem.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rotuloDaPostagem} from '../../lib/postagem.ts';
assert.equal(rotuloDaPostagem({status:'approved',postagem:{status:'postada',em:'2026-10-07T07:58:00.000Z',simulacao:true}}),'Postada (simulação) em 07/10, 04:58');
assert.equal(rotuloDaPostagem({status:'approved',postagem:{status:'postada',em:'2026-10-07T07:58:00.000Z',simulacao:false}}),'Postada em 07/10, 04:58');
assert.equal(rotuloDaPostagem({status:'approved'}),'Na fila para postar');
assert.equal(rotuloDaPostagem({status:'pending'}),undefined);
assert.equal(rotuloDaPostagem({status:'rejected'}),undefined);
const modelo=readFileSync(new URL('../../app/piloto/frontend/model.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../app/piloto/frontend/ui.tsx',import.meta.url),'utf8');
assert.match(modelo,/postagem:rotuloDaPostagem\(p\)/,'fromPilot leva o rótulo da postagem para o cartão');
assert.match(ui,/item\.postagem\?\?/,'o cartão mostra o rótulo da postagem quando existe');
console.log('galeria-postagem-regras ok');
