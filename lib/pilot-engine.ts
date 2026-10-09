import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {contextSchema,type PilotData,type PilotRun,type PilotGeneration,type PilotPiece} from './pilot-model';
import {findRun,saveRun} from './pilot-store';
import {generatedPieces,avisoDoLote,historicoDoDono} from './pilot-lote';
export {generatedPieces};

export async function engineFetch(path:string,init?:RequestInit){
 const config=env as unknown as {LAUNCHWING_ENGINE_URL?:string;LAUNCHWING_ENGINE_TOKEN?:string};
 if(!config.LAUNCHWING_ENGINE_URL||!config.LAUNCHWING_ENGINE_TOKEN)throw new Error('O gerador privado ainda não está conectado neste ambiente.');
 let response:Response;
 try{response=await fetch(`${config.LAUNCHWING_ENGINE_URL.replace(/\/$/,'')}${path}`,{...init,headers:{'Authorization':`Bearer ${config.LAUNCHWING_ENGINE_TOKEN}`,'Content-Type':'application/json',...init?.headers},signal:AbortSignal.timeout(15000)})}catch{throw new Error('O gerador está temporariamente indisponível. Seu caso ficou salvo; tente novamente em instantes.')}
 if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw Object.assign(new Error(body?.error||'Não foi possível acessar a geração. Tente novamente.'),{status:response.status})}
 return response;
}
export function runData(run:PilotRun):PilotData{
 const {id,revision,createdAt,updatedAt,...data}=run;void id;void revision;void createdAt;void updatedAt;return data;
}
export function generation(kind:PilotGeneration['kind']):PilotGeneration{return {key:crypto.randomUUID(),kind,status:'queued',stage:'queued',message:kind==='analysis'?'Preparando a leitura do produto':'Preparando sua geração',progress:0}}
export function initialApiData(url:string,extra:Partial<PilotData>={}):PilotData{return {url,caseId:null,mode:'api',phase:'analyzing',context:{name:'',description:'',audience:'',situations:''},facts:[],sources:[],pieces:[],contextConfirmedAt:null,events:[{at:new Date().toISOString(),kind:'api_case_created'}],generation:generation('analysis'),...extra}}
const jobSchema=z.object({id:z.string().uuid(),kind:z.enum(['analysis','production']),status:z.enum(['queued','running','succeeded','failed']),stage:z.string().max(100),message:z.string().max(1000),progress:z.number().min(0).max(100),error:z.string().max(1000).nullable(),result:z.unknown()});
const analysisSchema=z.object({context:contextSchema,facts:z.array(z.string().max(1000)).max(15),uncertainties:z.array(z.string().max(1500)).max(15),sources:z.array(z.object({url:z.string().url(),label:z.string().max(150),checkedAt:z.string().max(30)})).max(5)});
export function mergeGeneratedPieces(existing:PilotPiece[],incoming:PilotPiece[]){const seen=new Set(existing.map(p=>p.id));return [...existing,...incoming.filter(p=>!seen.has(p.id))]}
// Contrato C5: no máximo 3 lotes por caso. A regra mora aqui para valer em todo caminho que pede lote ("Gerar mais ideias" incluído).
export const LOTES_POR_CASO=3;
// Geração parada há mais tempo que isto vira falha na rotina, sem perguntar ao motor (saúde P9, 08/10): o motor roda num Mac e pode perder o pedido.
export const PRAZO_GERACAO_MS=2*3600000;
export function marcarFalha(data:PilotData,mensagem:string){data.phase='failed';data.generation={...data.generation!,status:'failed',error:mensagem,message:mensagem}}
export function queueProduction(data:PilotData){if((data.batches??0)>=LOTES_POR_CASO)throw new Error(`Este caso já recebeu ${LOTES_POR_CASO} lotes. Abra outro caso para novas sugestões.`);data.generation=generation('production');data.phase='generating';data.batches=(data.batches??0)+1;data.events.push({at:new Date().toISOString(),kind:'api_production_requested'})}
// The claim is saved before talking to the engine. Repeated requests reuse its
// key, so a lost response or closing the tab cannot start a second paid job.
export async function syncGeneration(owner:string,run:PilotRun){
 const current=run.generation;if(run.mode!=='api'||!current||current.status==='failed')return run;
 if(current.status==='succeeded'){
  if(run.flow==='blitz'&&current.kind==='analysis'&&run.onboarding?.completedAt){const next=runData(run);next.analysisJobId=current.jobId;queueProduction(next);if(await saveRun(owner,run.id,run.revision,next))return syncGeneration(owner,(await findRun(owner,run.id))!);return (await findRun(owner,run.id))!}return run;
 }
 let jobId=current.jobId;
 if(!jobId){const input=current.kind==='analysis'?{url:run.url,...(run.flow==='blitz'?{prefetch:true}:{}),...(run.descriptionInput?{description:run.descriptionInput}:{})}:{url:run.url,context:run.context,facts:run.facts,sources:run.sources,...(run.flow==='blitz'?{analysisJobId:run.analysisJobId,preferences:{...run.onboarding?.answers,...historicoDoDono(run.pieces)}}:{})};const body=await(await engineFetch('/jobs',{method:'POST',body:JSON.stringify({key:current.key,kind:current.kind,input})})).json();jobId=z.object({id:z.string().uuid()}).parse(body).id}
 if(current.retryRequested&&current.jobId)await engineFetch(`/jobs/${jobId}/retry`,{method:'POST',body:'{}'});
 let job:z.infer<typeof jobSchema>;
 try{job=jobSchema.parse(await(await engineFetch(`/jobs/${jobId}`)).json())}
 catch(erro){
  // O motor não tem mais o job (404): o caso vira falha e "tentar de novo" abre um job novo, em vez de ficar "gerando" para sempre (saúde P9).
  if((erro as {status?:number}).status!==404)throw erro;
  console.log(JSON.stringify({evento:'lote',caso:run.id,job:jobId,tipo:current.kind,de:current.status,para:'failed',etapa:'perdido'}));
  const perdido=runData(run);marcarFalha(perdido,'O gerador não encontrou mais esta geração. Tente de novo.');perdido.generation={...perdido.generation!,jobId:undefined,retryRequested:undefined};
  await saveRun(owner,run.id,run.revision,perdido);return (await findRun(owner,run.id))!;
 }
 if(job.kind!==current.kind)throw new Error('A geração não corresponde a este caso.');
 const next=runData(run);next.generation={...current,jobId,status:job.status,stage:job.stage,message:job.message,progress:job.progress,error:job.error||undefined,retryRequested:undefined};
 // Rastro do lote (08/10): o mesmo job aparece no registro do motor ([producao] <job>), então dá para seguir do site ao motor.
 if(job.status!==current.status)console.log(JSON.stringify({evento:'lote',caso:run.id,job:jobId,tipo:job.kind,de:current.status,para:job.status,etapa:job.stage,...(job.error?{erro:job.error.slice(0,200)}:{})}));
 if(job.status==='failed')next.phase='failed';
 if(run.flow==='blitz'&&job.result){
  if(job.kind==='analysis'){const partial=analysisSchema.safeParse(job.result);if(partial.success)Object.assign(next,partial.data)}
  else {try{next.pieces=mergeGeneratedPieces(run.pieces,generatedPieces(run.id,jobId,job.result,job.status!=='succeeded',true));if(job.status==='succeeded')next.aviso=avisoDoLote(job.result)}catch{if(job.status==='succeeded'){next.phase='failed';next.generation.status='failed';next.generation.error='A geração terminou com um lote incompleto. As peças prontas continuam salvas.';next.generation.message=next.generation.error}}}
 }
 if(job.status==='succeeded'&&next.generation.status!=='failed'){
  try{if(job.kind==='analysis'){Object.assign(next,analysisSchema.parse(job.result));next.phase='context';next.analysisJobId=jobId;if(run.flow==='blitz'&&run.onboarding?.completedAt)queueProduction(next)}else{if(run.flow!=='blitz')next.pieces=generatedPieces(run.id,jobId,job.result);next.aviso=avisoDoLote(job.result);next.phase='review'}next.events.push({at:new Date().toISOString(),kind:`api_${job.kind}_completed`})}
  catch{next.phase='failed';next.generation.status='failed';next.generation.error='A geração terminou com dados fora do formato esperado. Abra outro caso para gerar um novo lote.';next.generation.message=next.generation.error}
 }
 if(next.generation.kind==='analysis'&&next.generation.status!=='failed'&&run.flow==='blitz'&&run.onboarding?.completedAt&&analysisSchema.safeParse(job.result).success){next.analysisJobId=jobId;queueProduction(next)}
 if(job.kind==='production'&&job.status==='succeeded'&&next.phase==='review'&&run.flow==='blitz'&&(next.batches??1)<3&&next.pieces.filter(p=>p.status==='pending').length<=1)queueProduction(next);
 if(JSON.stringify(next)!==JSON.stringify(runData(run)))await saveRun(owner,run.id,run.revision,next);
 return (await findRun(owner,run.id))!;
}
