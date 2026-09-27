import {runpodConfig,status as runpodStatus,bytesDaSaida} from '@/lib/runpod';
import {createFile,findArtJob,updateArtJob,type ArtJob} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
function view(job:ArtJob){return {id:job.id,tipo:job.kind,status:job.status,seed:job.seed,error:job.error,url:job.fileId?`/api/painel/arquivo/${job.fileId}`:null}}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await pilotIdentity(request);if(!owner)return Response.json({error:'Entre para continuar.'},{status:401,headers:pilotHeaders});
 const {id}=await params;
 try{
  const job=await findArtJob(owner,id);if(!job)return Response.json({error:'Pedido não encontrado.'},{status:404,headers:pilotHeaders});
  if(job.status==='pronto'||job.status==='erro')return Response.json({job:view(job)},{headers:pilotHeaders});
  const config=runpodConfig();if(!config)return Response.json({job:view(job)},{headers:pilotHeaders});
  const remote=await runpodStatus(config,job.kind,job.runpodId);
  let next:ArtJob={...job};
  if(remote.status==='COMPLETED'){
   const {name,mime,bytes}=await bytesDaSaida(remote);
   const file=await createFile(owner,job.workspaceKey,name,mime,bytes);
   await updateArtJob(owner,job.id,{status:'pronto',fileId:file.id});next={...job,status:'pronto',fileId:file.id};
  }else if(remote.status==='FAILED'||remote.status==='CANCELLED'||remote.status==='TIMED_OUT'){
   const error=job.kind==='video'?'A geração do vídeo falhou no servidor. Tente de novo com outra descrição.':'A geração falhou no servidor de imagens. Tente de novo com outra descrição.';
   await updateArtJob(owner,job.id,{status:'erro',error});next={...job,status:'erro',error};
  }else{
   const status=remote.status==='IN_PROGRESS'?'gerando':'na_fila';
   if(status!==job.status){await updateArtJob(owner,job.id,{status});next={...job,status}}
   if(status==='na_fila'&&Date.now()-new Date(job.createdAt).getTime()>10*60000){const error='O servidor está sem máquina disponível agora. Tente mais tarde.';await updateArtJob(owner,job.id,{status:'erro',error});next={...job,status:'erro',error}}
  }
  return Response.json({job:view(next)},{headers:pilotHeaders});
 }catch(error){console.error('Art job status failed');return Response.json({error:error instanceof Error?error.message:'Não foi possível consultar a geração.'},{status:503,headers:pilotHeaders})}
}
