// Rotina agendada (worker/index.ts, a cada 2 minutos): faz andar o que o cliente deixou em curso, sem o navegador aberto.
// 1. Casos com geração em andamento: pergunta ao motor e grava o resultado (o mesmo caminho da tela, syncGeneration).
// 2. Lotes prontos: guarda imagens e vídeos na Cloudflare (lib/midia.ts).
// 3. Peças aprovadas: postagem. No esqueleto ela é simulada (sem contas das redes ainda): marca "postada" com a hora.
import {env} from 'cloudflare:workers';
import {runData as dados,syncGeneration,marcarFalha,PRAZO_GERACAO_MS} from './pilot-engine';
import {findRun,saveRun} from './pilot-store';
import {guardarMidia,arquivosDoLote,loteDaUrl} from './midia';
import {postarAprovadas,PRAZO_DESFAZER_MS} from './postagem';
import {sentinela} from './saude';
import {JANELA_MAIS_LONGA_MS} from './rate-limit';

const db=()=>(env as unknown as {DB:D1Database}).DB;
// PRAZO_DESFAZER_SEGUNDOS só para a prova do esqueleto (prazo curto); no ar vale o padrão de lib/postagem.ts.
const prazoDesfazer=()=>{const s=Number((env as unknown as {PRAZO_DESFAZER_SEGUNDOS?:string}).PRAZO_DESFAZER_SEGUNDOS);return s>0?s*1000:PRAZO_DESFAZER_MS};

export async function rotina(){
 // Sentinela do motor e do lote de teste (lib/saude.ts, 08/10). Erro aqui nunca para o resto da rotina.
 try{await sentinela()}catch(e){console.error(JSON.stringify({evento:'sentinela_falhou',erro:e instanceof Error?e.message:String(e)}))}
 // Sessões e códigos de login vencidos saem a cada rodada (DAD-04): expira é em milissegundos, como em lib/login-codigo.ts.
 // Limites de taxa (chaves com IP, e-mail ou id) saem depois da janela mais longa, 1 dia (lib/rate-limit.ts).
 try{for(const t of ['sessoes','login_codigos'])await db().prepare(`DELETE FROM ${t} WHERE expira<?`).bind(Date.now()).run();await db().prepare('DELETE FROM rate_limits WHERE window_start<?').bind(Date.now()-JANELA_MAIS_LONGA_MS).run()}catch(e){console.error(JSON.stringify({evento:'limpeza_vencidos_falhou',erro:e instanceof Error?e.message:String(e)}))}
 const desde=new Date(Date.now()-3*86400000).toISOString();
 const {results}=await db().prepare(`SELECT id,owner_id FROM pilot_runs WHERE updated_at>? AND (json_extract(data,'$.generation.status') IN ('queued','running') OR EXISTS (SELECT 1 FROM json_each(data,'$.pieces') WHERE json_extract(value,'$.status')='approved' AND json_extract(value,'$.postagem') IS NULL) OR (json_extract(data,'$.generation.kind')='production' AND json_extract(data,'$.generation.status')='succeeded' AND json_extract(data,'$.midiaGuardada') IS NOT json_extract(data,'$.generation.jobId'))) ORDER BY updated_at DESC LIMIT 25`).bind(desde).all<{id:string;owner_id:string}>();
 for(const {id,owner_id:dono} of results){
  try{
   let run=await findRun(dono,id);if(!run)continue;
   const g=run.generation;
   // Geração parada além do prazo vira falha sem perguntar ao motor (saúde P9): o cliente ganha o botão de tentar de novo.
   if(g&&(g.status==='queued'||g.status==='running')&&Date.now()-Date.parse(run.updatedAt)>PRAZO_GERACAO_MS){const parado=dados(run);marcarFalha(parado,'A geração demorou mais que o esperado. Tente de novo.');if(await saveRun(dono,id,run.revision,parado))run=(await findRun(dono,id))!}
   else if(g&&(g.status==='queued'||g.status==='running'||(g.status==='succeeded'&&!g.jobId)))run=await syncGeneration(dono,run);
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
