// Aplica as migrações do drizzle/ num D1 pelo wrangler, local ou remoto.
//   node scripts/migracoes.mjs local    (banco do `npm run dev`, em .wrangler/state)
//   node scripts/migracoes.mjs remote   (produção; precisa de CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_ID)
// O wrangler lê a pasta migrations/ e não entende o marcador do drizzle, então a pasta é gerada aqui.
import {readdirSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const alvo=process.argv[2];
if(!['local','remote'].includes(alvo)){console.error('use: local | remote');process.exit(1)}
mkdirSync('migrations',{recursive:true});
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())writeFileSync(`migrations/${f}`,readFileSync(`drizzle/${f}`,'utf8').replace(/-->\s*statement-breakpoint/g,''));
if(!existsSync('dist/server/wrangler.json')){console.error('Rode npm run build antes: a configuração do wrangler sai do build.');process.exit(1)}
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.d1_databases[0].migrations_dir='../../migrations';
if(alvo==='remote'){if(!process.env.CLOUDFLARE_D1_ID){console.error('Defina CLOUDFLARE_D1_ID (id do banco no painel da Cloudflare) e rode npm run build de novo.');process.exit(1)}}
writeFileSync('dist/server/wrangler.migracoes.json',JSON.stringify(config));
const args=['wrangler','d1','migrations','apply',config.d1_databases[0].database_name,'-c','dist/server/wrangler.migracoes.json',...(alvo==='local'?['--local','--persist-to',process.env.PERSIST_TO||'.wrangler/state']:['--remote'])];
const r=spawnSync('npx',args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
process.exit(r.status??1);
