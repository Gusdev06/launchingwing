// Trava do caminho para as peças salvas (frente 3, 07/10): em 06/10 o Nicolas não achou os Salvos sozinho. A tela dizia
// "Salvos" e o menu do celular chama de "Galeria". Depois de salvar e no fim do lote, um link leva direto à Galeria (tela=galeria).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const tela=readFileSync(new URL('../../app/piloto/blitz-workspace.tsx',import.meta.url),'utf8');
const menu=readFileSync(new URL('../../app/piloto/frontend/workspace.tsx',import.meta.url),'utf8');
assert.match(menu,/\{id:'galeria',name:'Galeria'/,'o menu mudou o nome da Galeria: revisar os textos da tela');
assert.doesNotMatch(tela,/estão em Salvos/,'a tela não pode mandar para "Salvos": o menu chama de Galeria');
assert.match(tela,/Abrir a Galeria/);
assert.match(tela,/Salva na Galeria/);
assert.match(tela,/tela:'galeria'/);
console.log('caminho-galeria-regras ok');
