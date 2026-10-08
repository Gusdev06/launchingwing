// Commit no ar (P0, 08/10): /api/saude diz qual commit está publicado e o deploy entrega esse commit ao Worker.
// Sem isso não há como provar que um merge chegou ao ar. Roda sem servidor: node scripts/saude/commit-regras.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ler=f=>readFileSync(new URL(`../../${f}`,import.meta.url),'utf8');
assert.match(ler('lib/saude.ts'),/site:'ok',commit:commitNoAr\(\)/,'resumoDaSaude devolve o commit publicado');
assert.match(ler('app/api/saude/route.ts'),/\{site:'ok',motor:null,commit:commitNoAr\(\),erro:/,'o 503 da rota também devolve o commit');
assert.match(ler('scripts/publicar.mjs'),/const commit=commitAtual\(\);[\s\S]*run\('npx',argsDoDeploy\(commit\)\)/,'o deploy lê o commit do git antes do build e passa ao wrangler');
const {commitPublicado}=await import('../../lib/saude-regras.ts');
assert.equal(commitPublicado({LAUNCHWING_COMMIT:'abc1234'}),'abc1234','com a variável, a resposta traz o commit');
assert.equal(commitPublicado({}),null,'sem a variável, commit é null');
assert.equal(commitPublicado({LAUNCHWING_COMMIT:''}),null,'variável vazia conta como ausente');
assert.equal(commitPublicado({LAUNCHWING_COMMIT:'abc1234-sujo'}),'abc1234-sujo','a marca de árvore suja chega inteira');
const {argsDoDeploy,commitAtual}=await import('../publicar.mjs');
assert.match(commitAtual(),/^[0-9a-f]{7,}(-sujo)?$/,'commitAtual lê o hash curto do git e marca -sujo quando há mudança');
const args=argsDoDeploy('abc1234');
assert.deepEqual(args.slice(0,4),['wrangler','deploy','-c','dist/server/wrangler.json'],'o deploy continua apontando para o wrangler.json gerado');
assert.equal(args[args.indexOf('--var')+1],'LAUNCHWING_COMMIT:abc1234','o commit vai como --var LAUNCHWING_COMMIT:<valor>');
assert.equal(args.filter(a=>a.startsWith('LAUNCHWING_')).length,1,'só o commit entra como variável, nenhuma outra');
console.log('saude-commit ok: resumo_traz_commit, rota_503_traz_commit, deploy_passa_var, sem_variavel_null, so_o_commit_entra');
