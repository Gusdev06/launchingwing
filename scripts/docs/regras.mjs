// Os documentos que o agente lê batem com o código (08/10, ARQ-03): toda variável de ambiente lida em lib/, app/ e worker/
// está em .dev.vars.example; CLAUDE.md descreve o login próprio e a prova; README diz como rodar, provar e publicar, sem o passado.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,extname} from 'node:path';
const raiz=new URL('../../',import.meta.url).pathname;
const ler=p=>readFileSync(join(raiz,p),'utf8');
function arquivos(dir){const r=[];for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())r.push(...arquivos(p));else if(['.ts','.tsx'].includes(extname(n)))r.push(p)}return r}
const nomes=new Set();
for(const p of ['lib','app','worker'].flatMap(d=>arquivos(join(raiz,d))))for(const m of readFileSync(p,'utf8').matchAll(/([A-Z][A-Z0-9_]{3,})\?: ?string/g))nomes.add(m[1]);
assert.ok(nomes.size>=15,`esperava ao menos 15 variáveis lidas pelo código, achou ${nomes.size}`);
const exemplo=ler('.dev.vars.example'),declaradas=new Set([...exemplo.matchAll(/^([A-Z][A-Z0-9_]{3,})=/gm)].map(m=>m[1]));
const faltam=[...nomes].filter(n=>!declaradas.has(n)).sort();
assert.deepEqual(faltam,[],`.dev.vars.example sem: ${faltam.join(', ')}`);
assert.ok(!/=\S{12,}$/m.test(exemplo),'.dev.vars.example com valor que parece segredo');
const claude=ler('CLAUDE.md');
for(const t of ['LOGIN_PROPRIO','LOGIN_EMAIL_TESTE','scripts/login','npm run check'])assert.ok(claude.includes(t),`CLAUDE.md não cita ${t}`);
const readme=ler('README.md');
for(const t of ['npm run check','npm run test:e2e','npm run deploy','/api/saude'])assert.ok(readme.includes(t),`README.md não cita ${t}`);
for(const t of ['chatgpt.site','RunPod','Sites'])assert.ok(!readme.includes(t),`README.md ainda cita ${t}`);
console.log(`docs-regras ok: ${nomes.size} variáveis em .dev.vars.example, CLAUDE.md com login próprio, README sem passado`);
