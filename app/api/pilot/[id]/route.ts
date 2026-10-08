import {generation,queueProduction,syncGeneration} from '@/lib/pilot-engine';
import {actionSchema,applyPilotAction} from '@/lib/pilot-model';
import {preparedPieces} from '@/lib/pilot-cases';
import {findRun,saveRun} from '@/lib/pilot-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
import {registrarErro} from '@/lib/registrar-erro';
type Params={params:Promise<{id:string}>};
// "Retomar geração" roda o job pago de novo no motor: vale 3 vezes por geração (saúde P1, 08/10).
const TENTATIVAS_POR_GERACAO=3;
export async function GET(request:Request,{params}:Params){
 const owner=await pilotIdentity(request);if(!owner)return Response.json({error:'Entre para abrir seu caso.'},{status:401,headers:pilotHeaders});
 try{const run=await findRun(owner,(await params).id);return run?Response.json({run},{headers:pilotHeaders}):Response.json({error:'Caso não encontrado.'},{status:404,headers:pilotHeaders})}catch(error){registrarErro('pilot_abrir',error);return Response.json({error:'Não foi possível abrir o caso.'},{status:503,headers:pilotHeaders})}
}
export async function PATCH(request:Request,{params}:Params){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para salvar.'},{status:403,headers:pilotHeaders});
 const parsed=await readPilotBody(request).then(body=>actionSchema.safeParse(body)).catch(()=>null);
 if(!parsed?.success)return Response.json({error:'Confira os campos antes de salvar.'},{status:400,headers:pilotHeaders});
 try{
  const id=(await params).id,run=await findRun(owner,id);
  if(!run)return Response.json({error:'Caso não encontrado.'},{status:404,headers:pilotHeaders});
  if(run.revision!==parsed.data.revision)return Response.json({error:'O caso mudou em outra aba. Reabra o caso para carregar a revisão atual.'},{status:409,headers:pilotHeaders});
  const {id:_id,revision:_revision,createdAt:_created,updatedAt:_updated,...data}=run;
  let next;
  try{
   if(run.mode==='api'&&(parsed.data.action==='prepare'||parsed.data.action==='retry'||parsed.data.action==='more')){
    next=structuredClone(data);
    if(parsed.data.action==='more'){
     if(run.flow!=='blitz'||!run.onboarding?.completedAt||run.generation?.status!=='succeeded'||run.generation?.kind!=='production')throw new Error('Aguarde as sugestões atuais ficarem prontas.');
     queueProduction(next);
    }else if(parsed.data.action==='prepare'){
     if(run.phase!=='ready'||!run.contextConfirmedAt)throw new Error('Confirme o contexto antes de gerar.');
     next.generation=generation('production');next.phase='generating';
    }else{
     if(run.phase!=='failed'||!run.generation)throw new Error('Esta geração não precisa de uma nova tentativa.');
     if((run.generation.retries??0)>=TENTATIVAS_POR_GERACAO)throw new Error(`Esta geração já foi retomada ${TENTATIVAS_POR_GERACAO} vezes. Abra outro caso.`);
     next.generation={...run.generation,status:'queued',retryRequested:true,retries:(run.generation.retries??0)+1,error:undefined};next.phase=run.generation.kind==='analysis'?'analyzing':'generating';
    }
   }else next=applyPilotAction(data,parsed.data,preparedPieces(run.caseId));
   if(parsed.data.action==='swipe'&&next.flow==='blitz'&&next.generation?.kind==='production'&&next.generation.status==='succeeded'&&(next.batches??1)<3&&next.pieces.filter(p=>p.status==='pending').length<=1)queueProduction(next);
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Revise esta ação.'},{status:400,headers:pilotHeaders})}
  if(!await saveRun(owner,id,parsed.data.revision,next))return Response.json({error:'Outra revisão foi salva primeiro. Reabra o caso antes de continuar.'},{status:409,headers:pilotHeaders});
  let saved=(await findRun(owner,id))!;
  if(saved.mode==='api'&&(['analyzing','generating'].includes(saved.phase)||(saved.flow==='blitz'&&saved.onboarding?.completedAt))){try{saved=await syncGeneration(owner,saved)}catch{/* The persisted claim can resume during polling. */}}
  return Response.json({run:saved},{headers:pilotHeaders});
 }catch(error){registrarErro('pilot_salvar',error);return Response.json({error:'Não foi possível salvar. Suas edições continuam na tela.'},{status:503,headers:pilotHeaders})}
}
