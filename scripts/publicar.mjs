// Publica direto na Cloudflare (sem o ChatGPT Sites): build, migrações remotas e deploy do Worker.
// Precisa de CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_ID e CLOUDFLARE_D1_NAME no ambiente.
// Variáveis do app (RUNPOD_*, CF_ACCESS_*, LAUNCHWING_ENGINE_*) vão como secrets: npx wrangler secret put NOME -c dist/server/wrangler.json
import {spawnSync} from 'node:child_process';
const faltam=['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_ID','CLOUDFLARE_D1_NAME'].filter(k=>!process.env[k]);
if(faltam.length){console.error('Faltam variáveis: '+faltam.join(', '));process.exit(1)}
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)process.exit(r.status??1)}
run('npm',['run','build']);
run('node',['scripts/migracoes.mjs','remote']);
run('npx',['wrangler','deploy','-c','dist/server/wrangler.json']);
