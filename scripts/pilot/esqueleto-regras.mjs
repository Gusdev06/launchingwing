// Regras do esqueleto conferidas pela prova (esqueleto-smoke.mjs).
import assert from 'node:assert/strict';
export function assertPostagem(pieces,aprovadaId){
 const p=pieces.find(x=>x.id===aprovadaId);
 assert.ok(p,'peça aprovada sumiu');assert.equal(p.status,'approved');
 assert.equal(p.postagem?.status,'postada','a rotina não postou a peça aprovada');assert.equal(p.postagem.simulacao,true);
 assert.ok(pieces.filter(x=>x.id!==aprovadaId).every(x=>!x.postagem),'só a aprovada é postada');
}
