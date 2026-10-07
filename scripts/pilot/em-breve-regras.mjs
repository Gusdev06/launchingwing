// Reunião Nicolas x Gustavo (07/10): foco em copy e vídeo. Telas que ainda não funcionam (Virais, Calendário, Automações,
// Contas sociais e Resultados) ficam no menu como "Em breve", sem abrir, e nenhum botão leva até elas.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ler=f=>readFileSync(new URL(`../../app/piloto/frontend/${f}`,import.meta.url),'utf8');
const modelo=ler('model.ts'),ws=ler('workspace.tsx'),conteudo=ler('content-screens.tsx'),ajustes=ler('settings-screens.tsx');
assert.match(modelo,/export const EM_BREVE=new Set<View>\(\['virais','calendario','automacoes','contas','resultados'\]\)/,'lista das telas em breve');
assert.match(ws,/EM_BREVE\.has\(n\.id\)\?<span[^>]*aria-disabled/,'item em breve no menu não é link');
assert.match(ws,/EM_BREVE\.has\(view\)\?<EmBreve/,'abrir pela URL mostra "Em breve" em vez da tela');
for(const [nome,codigo] of [['workspace.tsx',ws],['content-screens.tsx',conteudo],['settings-screens.tsx',ajustes]]){
 const soltos=[...codigo.matchAll(/navigate\('(virais|calendario|automacoes|contas|resultados)'/g)].filter(m=>!/EM_BREVE|emBreve/.test(codigo.slice(Math.max(0,m.index-160),m.index)));
 if(nome!=='settings-screens.tsx')assert.deepEqual(soltos.map(m=>m[1]),[],`${nome}: botão leva a tela em breve`);
}
console.log('em-breve-regras ok');
