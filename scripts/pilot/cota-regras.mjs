// Prova sem servidor da regra de lotes (saúde P1, 08/10): queueProduction em lib/pilot-engine.ts recusa o 4º lote de um caso.
// cloudflare:workers vira um módulo vazio e os imports relativos sem extensão ganham .ts, só para carregar o arquivo em Node.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(spec,ctx,next){
 if(spec==='cloudflare:workers')return {url:'data:text/javascript,export const env={}',shortCircuit:true};
 if(/^\.\.?\//.test(spec)&&!/\.[a-z]+$/.test(spec)&&ctx.parentURL?.includes('/lib/'))return next(spec+'.ts',ctx);
 return next(spec,ctx);
}});
const {queueProduction,LOTES_POR_CASO}=await import('../../lib/pilot-engine.ts');
const caso=batches=>({url:'https://exemplo-prova.com/',caseId:null,mode:'api',phase:'review',context:{name:'',description:'',audience:'',situations:''},facts:[],sources:[],pieces:[],contextConfirmedAt:null,events:[],batches});
const segundo=caso(LOTES_POR_CASO-1);queueProduction(segundo);
assert.equal(segundo.batches,LOTES_POR_CASO);assert.equal(segundo.phase,'generating');assert.equal(segundo.generation.kind,'production');
assert.throws(()=>queueProduction(caso(LOTES_POR_CASO)),/já recebeu 3 lotes/,'o 4º lote precisa ser recusado');
console.log(`cota-regras ok: ${LOTES_POR_CASO} lotes por caso, o ${LOTES_POR_CASO+1}º é recusado`);
