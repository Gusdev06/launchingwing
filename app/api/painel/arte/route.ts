import {z} from 'zod';
import {keySchema} from '@/lib/workspace-model';
import {TAMANHOS_IMAGEM,TAMANHOS_VIDEO} from '@/lib/runpod';
import {openaiConfig,gerarImagem} from '@/lib/openai-imagem';
import {countArtJobsToday,createArtJob,createFile,readFileBytes,updateArtJob} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
// Teto por conta em 24 h. Cada imagem custa dinheiro de verdade na OpenAI.
export const TETO_DIARIO=60,TETO_DIARIO_VIDEO=20;
// Vídeo desligado desde a troca do RunPod pelo ChatGPT Image (o ChatGPT Image só faz imagem).
const VIDEO_DESLIGADO='A geração de vídeo está desligada por enquanto.';
const bodySchema=z.object({chave:keySchema,prompt:z.string().trim().min(3,'Descreva a imagem com pelo menos 3 letras.').max(1500),tipo:z.enum(['imagem','video']).default('imagem'),tamanho:z.enum(['1:1','9:16','4:5','16:9']).default('1:1'),imagemUrl:z.string().max(2000).optional()});
const MAX_INICIAL=6*1024*1024;
// A foto de partida vem sempre de um arquivo da conta: um Worker não busca a própria URL com segurança,
// então o navegador sobe a foto pública como arquivo antes de pedir a geração.
async function fotoInicial(owner:string,url:string){
 const own=url.match(/^\/api\/painel\/arquivo\/([0-9a-f-]{36})$/);
 if(!own)throw new Error('Escolha uma foto da sua galeria como ponto de partida.');
 const file=await readFileBytes(owner,own[1]);if(!file)throw new Error('A foto escolhida não está na sua conta.');
 if(!/^image\/(png|jpeg|webp)$/.test(file.mime))throw new Error('A foto de partida precisa ser PNG, JPG ou WebP.');
 if(file.bytes.byteLength>MAX_INICIAL)throw new Error('A foto de partida passa de 6 MB. Use uma menor.');
 return file;
}
export async function GET(request:Request){
 if(!await pilotIdentity(request))return Response.json({error:'Entre para continuar.'},{status:401,headers:pilotHeaders});
 return Response.json({conectado:!!openaiConfig(),video:false,saldoUsd:null,saldoBaixo:null,tamanhos:TAMANHOS_IMAGEM,tamanhosVideo:TAMANHOS_VIDEO,tetoDiario:TETO_DIARIO,tetoDiarioVideo:TETO_DIARIO_VIDEO},{headers:pilotHeaders});
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para gerar.'},{status:403,headers:pilotHeaders});
 const config=openaiConfig();
 const parsed=await readPilotBody(request).then(b=>bodySchema.safeParse(b)).catch(()=>null);
 if(!parsed?.success)return Response.json({error:parsed?.error.issues[0]?.message||'Confira o pedido.'},{status:400,headers:pilotHeaders});
 if(parsed.data.tipo==='video')return Response.json({error:VIDEO_DESLIGADO},{status:503,headers:pilotHeaders});
 if(!config)return Response.json({error:'A geração de imagem ainda não está conectada nesta conta.'},{status:503,headers:pilotHeaders});
 let jobId:string|null=null;
 try{
  if(await countArtJobsToday(owner,'imagem')>=TETO_DIARIO)return Response.json({error:`Você chegou ao limite de ${TETO_DIARIO} imagens em 24 horas. Tente amanhã.`},{status:429,headers:pilotHeaders});
  let foto;if(parsed.data.imagemUrl){try{foto=await fotoInicial(owner,parsed.data.imagemUrl)}catch(error){return Response.json({error:error instanceof Error?error.message:'Foto de partida inválida.'},{status:400,headers:pilotHeaders})}}
  const [width,height]=TAMANHOS_IMAGEM[parsed.data.tamanho];
  // O pedido fica registrado antes de chamar a OpenAI para contar no teto diário mesmo se falhar.
  const job=await createArtJob(owner,parsed.data.chave,{runpodId:'openai',kind:'imagem',duration:null,prompt:parsed.data.prompt,width,height,seed:0});jobId=job.id;
  const {name,mime,bytes}=await gerarImagem(config,{prompt:parsed.data.prompt,width,height,foto});
  const file=await createFile(owner,job.workspaceKey,name,mime,bytes);
  await updateArtJob(owner,job.id,{status:'pronto',fileId:file.id});
  return Response.json({job:{id:job.id,status:'pronto',seed:0,tipo:'imagem',error:null,url:`/api/painel/arquivo/${file.id}`}},{status:201,headers:pilotHeaders});
 }catch(error){
  const message=error instanceof Error?error.message:'Não foi possível gerar a imagem. Tente novamente.';
  console.error('Art job failed');if(jobId)await updateArtJob(owner,jobId,{status:'erro',error:message}).catch(()=>{});
  return Response.json({error:message},{status:503,headers:pilotHeaders});
 }
}
