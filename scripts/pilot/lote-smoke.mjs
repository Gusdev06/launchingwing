// Prova do lote do motor, sem servidor: 3 formatos de sempre; ou só os 2 carrosséis quando o motor diz por que o meme não
// saiu (semMeme, auditoria 05/10: meme reprovado no portão não é entregue). Lote faltando peça sem motivo continua recusado.
import assert from 'node:assert/strict';
import {generatedPieces,avisoDoLote} from '../../lib/pilot-lote.ts';
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
console.log('lote-smoke ok');
