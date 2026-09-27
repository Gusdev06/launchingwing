import {z} from 'zod';
import {keySchema} from '@/lib/workspace-model';
import {runpodConfig,workflowImagem,workflowVideo,iniciar,TAMANHOS_IMAGEM,TAMANHOS_VIDEO} from '@/lib/runpod';
import {countArtJobsToday,createArtJob,readFileBytes} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
// Teto por conta em 24 h. Cada imagem custa dinheiro de verdade no RunPod (US$ 0,005 a 0,02).
export const TETO_DIARIO=60,TETO_DIARIO_VIDEO=20;
const bodySchema=z.object({chave:keySchema,prompt:z.string().trim().min(3,'Descreva a imagem com pelo menos 3 letras.').max(1500),tipo:z.enum(['imagem','video']).default('imagem'),duracaoS:z.number().int().min(2).max(15).default(5),tamanho:z.enum(['1:1','9:16','4:5','16:9']).default('1:1'),imagemUrl:z.string().max(2000).optional(),forca:z.number().min(0.1).max(1).default(0.65)});
const MAX_INICIAL=6*1024*1024;
function base64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out)}
// A foto de partida vem sempre de um arquivo da conta: um Worker não busca a própria URL com segurança,
// então o navegador sobe a foto pública como arquivo antes de pedir a geração.
async function fotoInicial(owner:string,url:string){
 const own=url.match(/^\/api\/painel\/arquivo\/([0-9a-f-]{36})$/);
 if(!own)throw new Error('Escolha uma foto da sua galeria como ponto de partida.');
 const file=await readFileBytes(owner,own[1]);if(!file)throw new Error('A foto escolhida não está na sua conta.');
 const {mime,bytes}=file;
 if(!/^image\/(png|jpeg|webp)$/.test(mime))throw new Error('A foto de partida precisa ser PNG, JPG ou WebP.');
 if(bytes.byteLength>MAX_INICIAL)throw new Error('A foto de partida passa de 6 MB. Use uma menor.');
 return base64(bytes);
}
export async function GET(request:Request){
 if(!await pilotIdentity(request))return Response.json({error:'Entre para continuar.'},{status:401,headers:pilotHeaders});
 const config=runpodConfig();return Response.json({conectado:!!config?.endpoints.imagem,video:!!config?.endpoints.video,tamanhos:TAMANHOS_IMAGEM,tamanhosVideo:TAMANHOS_VIDEO,tetoDiario:TETO_DIARIO,tetoDiarioVideo:TETO_DIARIO_VIDEO},{headers:pilotHeaders});
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para gerar.'},{status:403,headers:pilotHeaders});
 const config=runpodConfig();
 const parsed=await readPilotBody(request).then(b=>bodySchema.safeParse(b)).catch(()=>null);
 if(!parsed?.success)return Response.json({error:parsed?.error.issues[0]?.message||'Confira o pedido.'},{status:400,headers:pilotHeaders});
 try{
  const tipo=parsed.data.tipo;
  if(!config||!config.endpoints[tipo])return Response.json({error:tipo==='video'?'A geração de vídeo ainda não está conectada nesta conta.':'A geração de imagem ainda não está conectada nesta conta.'},{status:503,headers:pilotHeaders});
  const teto=tipo==='video'?TETO_DIARIO_VIDEO:TETO_DIARIO;
  if(await countArtJobsToday(owner,tipo)>=teto)return Response.json({error:`Você chegou ao limite de ${teto} ${tipo==='video'?'vídeos':'imagens'} em 24 horas. Tente amanhã.`},{status:429,headers:pilotHeaders});
  let foto;if(parsed.data.imagemUrl){try{foto=await fotoInicial(owner,parsed.data.imagemUrl)}catch(error){return Response.json({error:error instanceof Error?error.message:'Foto de partida inválida.'},{status:400,headers:pilotHeaders})}}
  let built;
  if(tipo==='video'){const key=parsed.data.tamanho==='9:16'?'9:16':parsed.data.tamanho==='1:1'?'1:1':'16:9';const [width,height]=TAMANHOS_VIDEO[key];const v=workflowVideo({prompt:parsed.data.prompt,width,height,duracaoS:parsed.data.duracaoS,primeiroQuadro:foto});built={...v,width,height,duration:parsed.data.duracaoS}}
  else{const [width,height]=TAMANHOS_IMAGEM[parsed.data.tamanho];const i=workflowImagem({prompt:parsed.data.prompt,width,height,inicial:foto?{base64:foto,forca:parsed.data.forca}:undefined});built={...i,width,height,duration:null}}
  const runpodId=await iniciar(config,tipo,built.workflow,built.images);
  const {width,height,seed}=built;
  const job=await createArtJob(owner,parsed.data.chave,{runpodId,kind:tipo,duration:built.duration,prompt:parsed.data.prompt,width,height,seed});
  return Response.json({job:{id:job.id,status:job.status,seed,tipo}},{status:201,headers:pilotHeaders});
 }catch(error){console.error('Art job start failed');return Response.json({error:error instanceof Error?error.message:'Não foi possível iniciar a geração. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
