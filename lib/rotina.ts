// Rotina agendada (worker/index.ts, a cada 2 minutos): faz andar o que o cliente deixou em curso, sem o navegador aberto.
// 1. Casos com geração em andamento: pergunta ao motor e grava o resultado (o mesmo caminho da tela, syncGeneration).
// 2. Lotes prontos: guarda imagens e vídeos na Cloudflare (lib/midia.ts).
// 3. Peças aprovadas: postagem. No esqueleto ela é simulada (sem contas das redes ainda): marca "postada" com a hora.
import {env} from 'cloudflare:workers';
import {runData as dados,syncGeneration} from './pilot-engine';
import {findRun,saveRun} from './pilot-store';
import {guardarMidia,arquivosDoLote,loteDaUrl} from './midia';
import {postarAprovadas,PRAZO_DESFAZER_MS} from './postagem';
import {sentinela} from './saude';

const db=()=>(env as unknown as {DB:D1Database}).DB;
// PRAZO_DESFAZER_SEGUNDOS só para a prova do esqueleto (prazo curto); no ar vale o padrão de lib/postagem.ts.
const prazoDesfazer=()=>{const s=Number((env as unknown as {PRAZO_DESFAZER_SEGUNDOS?:string}).PRAZO_DESFAZER_SEGUNDOS);return s>0?s*1000:PRAZO_DESFAZER_MS};

export async function rotina(){
 // Sentinela do motor e do lote de teste (lib/saude.ts, 08/10). Erro aqui nunca para o resto da rotina.
 try{await sentinela()}catch(e){console.error(JSON.stringify({evento:'sentinela_falhou',erro:e instanceof Error?e.message:String(e)}))}
 const desde=new Date(Date.now()-3*86400000).toISOString();
 const {results}=await db().prepare(`SELECT id,owner_id FROM pilot_runs WHERE updated_at>? AND (json_extract(data,'$.generation.status') IN ('queued','running') OR EXISTS (SELECT 1 FROM json_each(data,'$.pieces') WHERE json_extract(value,'$.status')='approved' AND json_extract(value,'$.postagem') IS NULL) OR (json_extract(data,'$.generation.kind')='production' AND json_extract(data,'$.generation.status')='succeeded' AND json_extract(data,'$.midiaGuardada') IS NOT json_extract(data,'$.generation.jobId'))) ORDER BY updated_at DESC LIMIT 25`).bind(desde).all<{id:string;owner_id:string}>();
 for(const {id,owner_id:dono} of results){
  try{
   let run=await findRun(dono,id);if(!run)continue;
   const g=run.generation;
   if(g&&(g.status==='queued'||g.status==='running'||(g.status==='succeeded'&&!g.jobId)))run=await syncGeneration(dono,run);
   const pronto=run.generation;
   if(pronto?.kind==='production'&&pronto.status==='succeeded'&&pronto.jobId&&run.midiaGuardada!==pronto.jobId){
    // Todos os lotes do caso: se dois terminaram entre uma passada e outra, o anterior também fica guardado.
    for(const job of new Set(run.pieces.flatMap(p=>p.assets.flatMap(a=>loteDaUrl(a.url)?.jobId??[]))))await guardarMidia(job,arquivosDoLote(run.pieces,job));
    if(await saveRun(dono,id,run.revision,{...dados(run),midiaGuardada:pronto.jobId}))run=(await findRun(dono,id))!;
   }
   const postado=postarAprovadas(dados(run),new Date().toISOString(),prazoDesfazer());
   if(postado)await saveRun(dono,id,run.revision,postado);
  }catch(erro){console.error('[rotina] caso',id,erro instanceof Error?erro.message:erro)}
 }
 return results.length;
}
