// Trava do menu do celular (07/10): o diálogo base centraliza com translate-x-[-50%] translate-y-[-50%] (Tailwind 4, propriedade
// translate). O menu lateral só desligava transform no CSS, e o otimizador de CSS do build descarta um translate:none colado no
// transform. No celular o menu abria com metade fora da tela (x = -160 px em 500 px). A saída é zerar pela classe, que o twMerge troca.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {twMerge} from 'tailwind-merge';
const ler=(c)=>readFileSync(new URL(`../../${c}`,import.meta.url),'utf8');
const base=ler('components/ui/dialog.tsx').match(/"(fixed top-\[50%\][^"]*)"/)?.[1];
assert.ok(base,'classe do diálogo base não encontrada');
const doMenu=ler('app/piloto/frontend/workspace.tsx').match(/DialogContent className="([^"]*fw-nav-dialog[^"]*)"/)?.[1];
assert.ok(doMenu,'menu do celular não encontrado');
const final=twMerge(base,doMenu).split(' ');
assert.ok(!final.includes('translate-x-[-50%]')&&!final.includes('translate-y-[-50%]'),`o menu ainda herda o deslocamento de -50%: ${doMenu}`);
assert.ok(final.includes('translate-x-0')&&final.includes('translate-y-0'));
console.log('menu-celular-regras ok');
