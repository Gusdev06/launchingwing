// Publica direto na Cloudflare (sem o ChatGPT Sites): build, migrações remotas e deploy do Worker.
// Precisa de CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_ID, CLOUDFLARE_D1_NAME e CLOUDFLARE_KV_MIDIA_ID (KV das imagens) no ambiente.
// Variáveis do app (CF_ACCESS_*, LAUNCHWING_ENGINE_*) vão como secrets: npx wrangler secret put NOME -c dist/server/wrangler.json
// O commit publicado vai como variável LAUNCHWING_COMMIT e aparece em /api/saude: é a prova do que está no ar.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const argsDoDeploy=commit=>['wrangler','deploy','-c','dist/server/wrangler.json','--var',`LAUNCHWING_COMMIT:${commit}`];
export function commitAtual(){
 const git=a=>spawnSync('git',a,{encoding:'utf8'}),h=git(['rev-parse','--short','HEAD']),s=git(['status','--porcelain']);
 if(h.status!==0||!h.stdout.trim()){console.error('Não consegui ler o commit atual com git; publique de dentro do repositório.');process.exit(1)}
 return h.stdout.trim()+(s.stdout.trim()?'-sujo':'');
}
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)process.exit(r.status??1)}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const faltam=['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_ID','CLOUDFLARE_D1_NAME','CLOUDFLARE_KV_MIDIA_ID'].filter(k=>!process.env[k]);
 if(faltam.length){console.error('Faltam variáveis: '+faltam.join(', '));process.exit(1)}
 const commit=commitAtual();
 run('npm',['run','build']);
 run('node',['scripts/migracoes.mjs','remote']);
 run('npx',argsDoDeploy(commit));
}
