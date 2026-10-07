// Trava do menu do celular (07/10): o diálogo base centraliza com a propriedade translate (Tailwind 4), e o menu lateral só
// desligava transform. Sobrava translate -50%: no celular o menu abria com metade fora da tela (x = -160 px em 500 px).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../../app/piloto/frontend/workspace.css',import.meta.url),'utf8');
const regra=css.match(/\.fw-nav-dialog\{[^}]*\}/)?.[0]??'';
assert.ok(regra,'regra .fw-nav-dialog sumiu');
assert.match(regra,/translate:none!important/,'o menu do celular precisa desligar translate, não só transform');
assert.match(regra,/left:0/);
const base=readFileSync(new URL('../../components/ui/dialog.tsx',import.meta.url),'utf8');
assert.match(base,/translate-x-\[-50%\]/,'se o diálogo base parar de usar translate, revisar esta trava');
console.log('menu-celular-regras ok');
