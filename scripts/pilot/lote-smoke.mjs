// Prova do lote do motor, sem servidor: 3 formatos de sempre; ou só os 2 carrosséis quando o motor diz por que o meme não
// saiu (semMeme, auditoria 05/10: meme reprovado no portão não é entregue). Lote faltando peça sem motivo continua recusado.
import assert from 'node:assert/strict';
import {generatedPieces,avisoDoLote,historicoDoDono} from '../../lib/pilot-lote.ts';
const carrossel=id=>({id,format:'Slideshow',hook:'gancho',caption:'legenda',rationale:'r',provenance:'p',assets:Array.from({length:6},(_,i)=>({file:`${id}-slide-0${i+1}.jpg`,kind:'image',alt:'slide'}))});
const meme={id:'meme',format:'Meme',hook:'gancho',caption:'legenda',rationale:'r',provenance:'p',assets:[{file:'meme.mp4',kind:'video',alt:'meme',poster:'meme-capa.jpg'}]};
const semMeme='O meme deste lote não passou na conferência de qualidade, então não foi entregue.';
assert.equal(generatedPieces('r','j',{pieces:[meme,carrossel('educativo'),carrossel('amiga')]}).length,3);
const so2=generatedPieces('r','j',{pieces:[carrossel('educativo'),carrossel('amiga')],semMeme});
assert.deepEqual(so2.map(p=>p.id),['educativo','amiga']);
assert.equal(avisoDoLote({pieces:[],semMeme}),semMeme);
assert.equal(avisoDoLote({pieces:[]}),undefined);
assert.throws(()=>generatedPieces('r','j',{pieces:[carrossel('educativo'),carrossel('amiga')]}),/três formatos/,'sem motivo, 2 peças é lote incompleto');
assert.throws(()=>generatedPieces('r','j',{pieces:[meme,carrossel('educativo'),carrossel('amiga')],semMeme}),/três formatos/,'com semMeme não pode vir vídeo');
// F4 (07/10): um carrossel falhou e o resto chega com aviso (semCarrossel), em vez de o lote inteiro falhar.
const semCarrossel='Um dos carrosséis não ficou pronto (as fotos não chegaram). O resto do lote está aqui; gere de novo para tentar outro.';
assert.deepEqual(generatedPieces('r','j',{pieces:[meme,carrossel('educativo')],semCarrossel}).map(p=>p.id),['meme','educativo']);
assert.deepEqual(generatedPieces('r','j',{pieces:[carrossel('amiga')],semMeme,semCarrossel}).map(p=>p.id),['amiga']);
assert.throws(()=>generatedPieces('r','j',{pieces:[meme,carrossel('educativo'),carrossel('amiga')],semCarrossel}),/três formatos/,'com semCarrossel não podem vir os 2 carrosséis');
assert.throws(()=>generatedPieces('r','j',{pieces:[meme],semCarrossel}),/três formatos/,'sem o meme avisado, só 1 carrossel faltando');
assert.equal(avisoDoLote({pieces:[],semMeme,semCarrossel}),`${semMeme} ${semCarrossel}`);
assert.equal(avisoDoLote({pieces:[],semCarrossel}),semCarrossel);
// O motor aprende com o que o dono reprovou: gancho e motivo das peças marcadas para mudar ou recusadas, no máximo 8.
const peca=(hook,status,feedback='')=>({hook,status,feedback});
const h=historicoDoDono([peca('a','approved'),peca('b','rejected','sem graça'),peca('c','changes','tom errado'),peca('d','pending')]);
assert.deepEqual(h.previousHooks,['a','b','c','d']);
assert.deepEqual(h.reprovados,[{hook:'b',motivo:'sem graça'},{hook:'c',motivo:'tom errado'}]);
assert.deepEqual(historicoDoDono([]),{});
assert.equal(historicoDoDono(Array.from({length:12},(_,i)=>peca('r'+i,'rejected','x'))).reprovados.length,8);
// Copy por modelos (06/10): o site guarda o modelo de copy de cada peça e devolve os do último lote ao motor, para não repetir.
const comCopy=generatedPieces('r','job-1',{pieces:[{...meme,copy:'BAB'},{...carrossel('educativo'),copy:'PAS'},{...carrossel('amiga'),copy:'BAB'}]},false,true);
assert.deepEqual(comCopy.map(p=>p.copy),['BAB','PAS','BAB']);
assert.deepEqual(historicoDoDono(comCopy).copiasAnteriores,[{id:'meme',copy:'BAB'},{id:'educativo',copy:'PAS'},{id:'amiga',copy:'BAB'}]);
assert.equal(historicoDoDono([peca('a','approved')]).copiasAnteriores,undefined);
console.log('lote-smoke ok');
