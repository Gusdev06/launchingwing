// Prova do desfazer, sem servidor (frente 3): a peça aprovada só é postada depois do prazo para desfazer, e peça já postada
// não volta para revisão (com a postagem real, o post já estaria no Instagram).
import assert from 'node:assert/strict';
import {applyPilotAction} from '../../lib/pilot-model.ts';
import {postarAprovadas,PRAZO_DESFAZER_MS} from '../../lib/postagem.ts';

const t0='2026-10-07T03:00:00.000Z',depois=(ms)=>new Date(Date.parse(t0)+ms).toISOString();
const peca=(id)=>({id,format:'Slideshow',hook:'g',caption:'c',rationale:'r',provenance:'p',assets:[],status:'pending',feedback:'',reviewSeconds:0});
const base={url:'https://exemplo.com/',caseId:null,mode:'api',flow:'blitz',phase:'review',context:{name:'X',description:'descrição longa',audience:'quem',situations:'a'},facts:[],sources:[],pieces:[peca('a'),peca('b')],contextConfirmedAt:null,events:[]};

// Aprovou agora: a rotina ainda não posta (dá tempo de desfazer).
const aprovada=applyPilotAction(base,{action:'swipe',revision:0,pieceId:'a',direction:'right',seconds:0},[],t0);
assert.equal(postarAprovadas(aprovada,depois(60_000)),null,'aprovada há 1 minuto não pode ser postada ainda');
// Desfez dentro do prazo: volta a pendente e nada é postado.
const desfeita=applyPilotAction(aprovada,{action:'review',revision:0,pieceId:'a',status:'pending',caption:'c',feedback:'',seconds:0},[],depois(90_000));
assert.equal(desfeita.pieces[0].status,'pending');
assert.equal(postarAprovadas(desfeita,depois(PRAZO_DESFAZER_MS*3)),null,'peça desfeita não é postada');
// Passou o prazo: posta.
const postada=postarAprovadas(aprovada,depois(PRAZO_DESFAZER_MS+1000));
assert.equal(postada?.pieces[0].postagem?.status,'postada');
assert.equal(postada?.pieces[1].postagem,undefined);
// Já postada: desfazer, reprovar ou mudar é recusado com motivo claro.
assert.throws(()=>applyPilotAction(postada,{action:'review',revision:0,pieceId:'a',status:'pending',caption:'c',feedback:'',seconds:0},[],depois(PRAZO_DESFAZER_MS*2)),/já foi postada/);
assert.throws(()=>applyPilotAction(postada,{action:'swipe',revision:0,pieceId:'a',direction:'left',seconds:0},[],depois(PRAZO_DESFAZER_MS*2)),/já foi postada/);
// Aprovada pela revisão completa (editor) também espera o prazo.
const peloEditor=applyPilotAction(base,{action:'review',revision:0,pieceId:'b',status:'approved',caption:'c2',feedback:'',seconds:3},[],t0);
assert.equal(postarAprovadas(peloEditor,depois(60_000)),null);
assert.equal(postarAprovadas(peloEditor,depois(PRAZO_DESFAZER_MS+1000))?.pieces[1].postagem?.status,'postada');
console.log(`desfazer-regras ok (prazo ${PRAZO_DESFAZER_MS/60000} min)`);
