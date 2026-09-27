import {z} from 'zod';
import {keySchema} from '@/lib/workspace-model';
import {runpodConfig,workflowImagem,iniciarImagem,TAMANHOS_IMAGEM} from '@/lib/runpod';
import {countArtJobsToday,createArtJob} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
// Teto por conta em 24 h. Cada imagem custa dinheiro de verdade no RunPod (US$ 0,005 a 0,02).
export const TETO_DIARIO=60;
const bodySchema=z.object({chave:keySchema,prompt:z.string().trim().min(3,'Descreva a imagem com pelo menos 3 letras.').max(1500),tamanho:z.enum(['1:1','9:16','4:5','16:9']).default('1:1')});
export async function GET(request:Request){
 if(!await pilotIdentity(request))return Response.json({error:'Entre para continuar.'},{status:401,headers:pilotHeaders});
 return Response.json({conectado:!!runpodConfig(),tamanhos:TAMANHOS_IMAGEM,tetoDiario:TETO_DIARIO},{headers:pilotHeaders});
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para gerar.'},{status:403,headers:pilotHeaders});
 const config=runpodConfig();if(!config)return Response.json({error:'A geração de imagem ainda não está conectada nesta conta.'},{status:503,headers:pilotHeaders});
 const parsed=await readPilotBody(request).then(b=>bodySchema.safeParse(b)).catch(()=>null);
 if(!parsed?.success)return Response.json({error:parsed?.error.issues[0]?.message||'Confira o pedido.'},{status:400,headers:pilotHeaders});
 try{
  if(await countArtJobsToday(owner)>=TETO_DIARIO)return Response.json({error:`Você chegou ao limite de ${TETO_DIARIO} imagens em 24 horas. Tente amanhã.`},{status:429,headers:pilotHeaders});
  const [width,height]=TAMANHOS_IMAGEM[parsed.data.tamanho];
  const {workflow,seed}=workflowImagem({prompt:parsed.data.prompt,width,height});
  const runpodId=await iniciarImagem(config,workflow);
  const job=await createArtJob(owner,parsed.data.chave,{runpodId,prompt:parsed.data.prompt,width,height,seed});
  return Response.json({job:{id:job.id,status:job.status,seed}},{status:201,headers:pilotHeaders});
 }catch(error){console.error('Art job start failed');return Response.json({error:error instanceof Error?error.message:'Não foi possível iniciar a geração. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
