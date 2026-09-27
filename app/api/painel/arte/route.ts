import {z} from 'zod';
import {keySchema} from '@/lib/workspace-model';
import {runpodConfig,workflowImagem,iniciarImagem,TAMANHOS_IMAGEM} from '@/lib/runpod';
import {countArtJobsToday,createArtJob,readFileBytes} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
// Teto por conta em 24 h. Cada imagem custa dinheiro de verdade no RunPod (US$ 0,005 a 0,02).
export const TETO_DIARIO=60;
const bodySchema=z.object({chave:keySchema,prompt:z.string().trim().min(3,'Descreva a imagem com pelo menos 3 letras.').max(1500),tamanho:z.enum(['1:1','9:16','4:5','16:9']).default('1:1'),imagemUrl:z.string().max(2000).optional(),forca:z.number().min(0.1).max(1).default(0.65)});
const MAX_INICIAL=6*1024*1024;
function base64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out)}
// A foto de partida vem da conta (arquivo do dono) ou da biblioteca pública do site; nunca de URL externa.
async function fotoInicial(owner:string,url:string,request:Request){
 const own=url.match(/^\/api\/painel\/arquivo\/([0-9a-f-]{36})$/);
 let mime:string,bytes:Uint8Array;
 if(own){const file=await readFileBytes(owner,own[1]);if(!file)throw new Error('A foto escolhida não está na sua conta.');mime=file.mime;bytes=file.bytes}
 else if(/^\/(workspace|pilot|examples)\/[a-zA-Z0-9/_.-]+\.(png|jpe?g|webp)$/i.test(url)){const r=await fetch(new URL(url,request.url));if(!r.ok)throw new Error('Não foi possível ler a foto escolhida.');mime=r.headers.get('content-type')?.split(';')[0]||'';bytes=new Uint8Array(await r.arrayBuffer())}
 else throw new Error('Escolha uma foto da sua galeria como ponto de partida.');
 if(!/^image\/(png|jpeg|webp)$/.test(mime))throw new Error('A foto de partida precisa ser PNG, JPG ou WebP.');
 if(bytes.byteLength>MAX_INICIAL)throw new Error('A foto de partida passa de 6 MB. Use uma menor.');
 return base64(bytes);
}
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
  let inicial;if(parsed.data.imagemUrl){try{inicial={base64:await fotoInicial(owner,parsed.data.imagemUrl,request),forca:parsed.data.forca}}catch(error){return Response.json({error:error instanceof Error?error.message:'Foto de partida inválida.'},{status:400,headers:pilotHeaders})}}
  const {workflow,seed,images}=workflowImagem({prompt:parsed.data.prompt,width,height,inicial});
  const runpodId=await iniciarImagem(config,workflow,images);
  const job=await createArtJob(owner,parsed.data.chave,{runpodId,prompt:parsed.data.prompt,width,height,seed});
  return Response.json({job:{id:job.id,status:job.status,seed}},{status:201,headers:pilotHeaders});
 }catch(error){console.error('Art job start failed');return Response.json({error:error instanceof Error?error.message:'Não foi possível iniciar a geração. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
