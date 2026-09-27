import {env} from 'cloudflare:workers';
// Cliente mínimo do RunPod Serverless (endpoint krea2 do Gustavo). Mesma montagem de workflow de
// krea2-comfy-api/entrega/gustavo_runpod.mjs, só o caminho texto para imagem.
const MODELO={difusao:'krea2_turbo_fp8_scaled.safetensors',textEncoder:'qwen3vl_4b_fp8_scaled.safetensors',vae:'qwen_image_vae.safetensors'};
const MAX_SEED=2**53-1;
export const TAMANHOS_IMAGEM={'1:1':[1024,1024],'9:16':[768,1344],'4:5':[1024,1280],'16:9':[1344,768]} as const;
export type Config={apiKey:string;endpoint:string;base:string};
export function runpodConfig():Config|null{
 const e=env as unknown as {RUNPOD_API_KEY?:string;RUNPOD_KREA2_ENDPOINT_ID?:string;RUNPOD_BASE_URL?:string};
 if(!e.RUNPOD_API_KEY||!e.RUNPOD_KREA2_ENDPOINT_ID)return null;
 return {apiKey:e.RUNPOD_API_KEY,endpoint:e.RUNPOD_KREA2_ENDPOINT_ID,base:(e.RUNPOD_BASE_URL||'https://api.runpod.ai/v2').replace(/\/$/,'')};
}
export type ImagemInicial={base64:string;forca:number};
export function workflowImagem({prompt,width,height,seed,inicial}:{prompt:string;width:number;height:number;seed?:number;inicial?:ImagemInicial}){
 const texto=prompt.trim();if(!texto)throw new Error('Descreva a imagem que você quer.');
 for(const v of [width,height]){if(!Number.isInteger(v)||v<512||v>2048||v%16)throw new Error('Tamanho inválido: lados entre 512 e 2048, múltiplos de 16.')}
 const s=seed??Math.floor(Math.random()*MAX_SEED);
 const workflow:Record<string,{class_type:string;inputs:Record<string,unknown>}>={
  '1':{class_type:'UNETLoader',inputs:{unet_name:MODELO.difusao,weight_dtype:'default'}},
  '2':{class_type:'CLIPLoader',inputs:{clip_name:MODELO.textEncoder,type:'krea2',device:'default'}},
  '3':{class_type:'VAELoader',inputs:{vae_name:MODELO.vae}},
  '4':{class_type:'CLIPTextEncode',inputs:{clip:['2',0],text:texto}},
  '5':{class_type:'ConditioningZeroOut',inputs:{conditioning:['4',0]}},
  '6':{class_type:'EmptyLatentImage',inputs:{width,height,batch_size:1}},
  '7':{class_type:'KSampler',inputs:{model:['1',0],positive:['4',0],negative:['5',0],latent_image:['6',0],seed:s,steps:8,cfg:1.0,sampler_name:'euler',scheduler:'simple',denoise:1.0}},
  '8':{class_type:'VAEDecode',inputs:{samples:['7',0],vae:['3',0]}},
  '9':{class_type:'SaveImage',inputs:{images:['8',0],filename_prefix:'krea2'}},
 };
 const images:{name:string;image:string}[]=[];
 if(inicial){
  if(!(inicial.forca>=0.1&&inicial.forca<=1))throw new Error('Quanto mudar deve ficar entre 10% e 100%.');
  // Imagem para imagem: a foto é redimensionada, codificada pelo VAE e entra no KSampler no lugar do latente vazio.
  const name=`inicial_${s}.png`;images.push({name,image:inicial.base64});
  const wf=workflow as Record<string,{class_type:string;inputs:Record<string,unknown>}>;
  wf['13']={class_type:'LoadImage',inputs:{image:name}};
  wf['14']={class_type:'ImageScale',inputs:{image:['13',0],upscale_method:'lanczos',width,height,crop:'center'}};
  wf['15']={class_type:'VAEEncode',inputs:{pixels:['14',0],vae:['3',0]}};
  wf['7'].inputs.latent_image=['15',0];wf['7'].inputs.denoise=inicial.forca;delete wf['6'];
 }
 return {workflow,seed:s,images};
}
async function call(config:Config,path:string,init?:RequestInit){
 const response=await fetch(`${config.base}/${config.endpoint}${path}`,{...init,headers:{'content-type':'application/json',authorization:`Bearer ${config.apiKey}`,...init?.headers},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`RunPod respondeu ${response.status}: ${(await response.text()).slice(0,300)}`);
 return response.json();
}
export async function iniciarImagem(config:Config,workflow:unknown,images:{name:string;image:string}[]=[]):Promise<string>{
 const {id}=await call(config,'/run',{method:'POST',body:JSON.stringify({input:{workflow,...(images.length?{images}:{})}})}) as {id:string};
 if(!id)throw new Error('RunPod não devolveu o id do pedido.');return id;
}
export type RunPodStatus={status:'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'|'FAILED'|'CANCELLED'|'TIMED_OUT';output?:{images?:{filename:string;type:string;data:string}[]};error?:unknown;delayTime?:number;executionTime?:number};
export async function statusImagem(config:Config,jobId:string):Promise<RunPodStatus>{return call(config,`/status/${jobId}`) as Promise<RunPodStatus>}
export async function cancelarImagem(config:Config,jobId:string){try{await call(config,`/cancel/${jobId}`,{method:'POST'})}catch{}}
export async function bytesDaSaida(status:RunPodStatus):Promise<{name:string;mime:string;bytes:Uint8Array}>{
 const image=status.output?.images?.[0];if(!image)throw new Error('O pedido terminou sem imagem.');
 const bytes=image.type==='s3_url'?new Uint8Array(await(await fetch(image.data)).arrayBuffer()):Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));
 const name=image.filename||'imagem.png';const mime=/\.jpe?g$/i.test(name)?'image/jpeg':/\.webp$/i.test(name)?'image/webp':'image/png';
 return {name,mime,bytes};
}
