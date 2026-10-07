// Trava da regra do Nicolas: nenhum travessão (U+2014) no repositório, nem em título de página, rótulo, comentário ou documento.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const T=String.fromCharCode(0x2014);
// git grep sai com 1 quando não acha nada: é o resultado esperado.
let saida='';try{saida=execFileSync('git',['grep','-n','-I',T,'--','.'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})}catch(e){if(e.status!==1)throw e}
const achados=saida.trim().split('\n').filter(Boolean);
assert.deepEqual(achados,[],`travessão em ${achados.length} linha(s):\n${achados.map(l=>l.slice(0,120)).join('\n')}`);
console.log('sem-travessao ok');
