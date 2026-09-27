import {env} from 'cloudflare:workers';
// Cliente mínimo do RunPod Serverless (endpoint krea2 do Gustavo). Mesma montagem de workflow de
// krea2-comfy-api/entrega/gustavo_runpod.mjs, só o caminho texto para imagem.
const MODELO={difusao:'krea2_turbo_fp8_scaled.safetensors',textEncoder:'qwen3vl_4b_fp8_scaled.safetensors',vae:'qwen_image_vae.safetensors'};
const MAX_SEED=2**53-1;
export const TAMANHOS_IMAGEM={'1:1':[1024,1024],'9:16':[768,1344],'4:5':[1024,1280],'16:9':[1344,768]} as const;
export type Kind='imagem'|'video';
export type Config={apiKey:string;endpoints:{imagem?:string;video?:string};base:string};
export function runpodConfig():Config|null{
 const e=env as unknown as {RUNPOD_API_KEY?:string;RUNPOD_KREA2_ENDPOINT_ID?:string;RUNPOD_H3_ENDPOINT_ID?:string;RUNPOD_BASE_URL?:string};
 if(!e.RUNPOD_API_KEY||(!e.RUNPOD_KREA2_ENDPOINT_ID&&!e.RUNPOD_H3_ENDPOINT_ID))return null;
 return {apiKey:e.RUNPOD_API_KEY,endpoints:{imagem:e.RUNPOD_KREA2_ENDPOINT_ID||undefined,video:e.RUNPOD_H3_ENDPOINT_ID||undefined},base:(e.RUNPOD_BASE_URL||'https://api.runpod.ai/v2').replace(/\/$/,'')};
}
const MODELO_VIDEO={difusao:'minimax_h3_fl2va_pruned_fp8_scaled.safetensors',textEncoder:'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',vaeVideo:'minimax_h3_video_vae_fp16.safetensors',vaeAudio:'minimax_h3_audio_vae_fp32.safetensors',loraTurbo:'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors'};
export const TAMANHOS_VIDEO={'16:9':[864,480],'9:16':[480,864],'1:1':[768,768]} as const;
// Quadros válidos do H3: 24 fps, arredondado para cima na grade 17k+5.
export function quadrosPara(duracaoS:number){const base=Math.max(5,Math.round(duracaoS*24));return base+((5-(base%17))+17)%17}
export function workflowVideo({prompt,width,height,duracaoS,seed,primeiroQuadro}:{prompt:string;width:number;height:number;duracaoS:number;seed?:number;primeiroQuadro?:string}){
 const texto=prompt.trim();if(!texto)throw new Error('Descreva o vídeo que você quer.');
 for(const v of [width,height]){if(!Number.isInteger(v)||v<320||v>1344||v%32)throw new Error('Tamanho de vídeo inválido.')}
 if(Math.min(width,height)>768)throw new Error('O lado curto do vídeo vai até 768.');
 if(!(duracaoS>=2&&duracaoS<=15))throw new Error('Duração entre 2 e 15 segundos.');
 const s=seed??Math.floor(Math.random()*MAX_SEED),quadros=quadrosPara(duracaoS),m=MODELO_VIDEO,modelo=['15',0];
 const workflow:Record<string,{class_type:string;inputs:Record<string,unknown>}>={
  '1':{class_type:'UNETLoader',inputs:{unet_name:m.difusao,weight_dtype:'default'}},
  '2':{class_type:'CLIPLoader',inputs:{clip_name:m.textEncoder,type:'minimax',device:'default'}},
  '3':{class_type:'VAELoader',inputs:{vae_name:m.vaeVideo}},
  '4':{class_type:'VAELoader',inputs:{vae_name:m.vaeAudio}},
  '5':{class_type:'MiniMaxH3ImageToVideo',inputs:{clip:['2',0],vae:['3',0],prompt:texto,width,height,length:quadros}},
  '6':{class_type:'RandomNoise',inputs:{noise_seed:s}},
  '7':{class_type:'KSamplerSelect',inputs:{sampler_name:'res_multistep'}},
  '8':{class_type:'BasicScheduler',inputs:{model:modelo,scheduler:'simple',steps:8,denoise:1.0}},
  '9':{class_type:'BasicGuider',inputs:{model:modelo,conditioning:['5',0]}},
  '10':{class_type:'SamplerCustomAdvanced',inputs:{noise:['6',0],guider:['9',0],sampler:['7',0],sigmas:['8',0],latent_image:['5',1]}},
  '11':{class_type:'VAEDecode',inputs:{samples:['10',0],vae:['3',0]}},
  '12':{class_type:'VAEDecodeAudio',inputs:{samples:['10',0],vae:['4',0]}},
  '13':{class_type:'CreateVideo',inputs:{images:['11',0],audio:['12',0],fps:24.0}},
  '14':{class_type:'SaveVideo',inputs:{video:['13',0],filename_prefix:'video/minimax_h3',format:'mp4','format.codec':'h264'}},
  '15':{class_type:'LoraLoaderModelOnly',inputs:{model:['1',0],lora_name:m.loraTurbo,strength_model:1.0}},
 };
 const images:{name:string;image:string}[]=[];
 if(primeiroQuadro){const name=`quadro_${s}.png`;images.push({name,image:primeiroQuadro});workflow['16']={class_type:'LoadImage',inputs:{image:name}};workflow['5'].inputs.first_frame=['16',0]}
 return {workflow,seed:s,quadros,images};
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
async function call(config:Config,kind:Kind,path:string,init?:RequestInit){
 const endpoint=config.endpoints[kind];if(!endpoint)throw new Error(kind==='video'?'A geração de vídeo ainda não está conectada nesta conta.':'A geração de imagem ainda não está conectada nesta conta.');
 const response=await fetch(`${config.base}/${endpoint}${path}`,{...init,headers:{'content-type':'application/json',authorization:`Bearer ${config.apiKey}`,...init?.headers},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`RunPod respondeu ${response.status}: ${(await response.text()).slice(0,300)}`);
 return response.json();
}
export async function iniciar(config:Config,kind:Kind,workflow:unknown,images:{name:string;image:string}[]=[]):Promise<string>{
 const {id}=await call(config,kind,'/run',{method:'POST',body:JSON.stringify({input:{workflow,...(images.length?{images}:{})}})}) as {id:string};
 if(!id)throw new Error('RunPod não devolveu o id do pedido.');return id;
}
export type RunPodStatus={status:'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'|'FAILED'|'CANCELLED'|'TIMED_OUT';output?:{images?:{filename:string;type:string;data:string}[]};error?:unknown;delayTime?:number;executionTime?:number};
export async function status(config:Config,kind:Kind,jobId:string):Promise<RunPodStatus>{return call(config,kind,`/status/${jobId}`) as Promise<RunPodStatus>}
export async function bytesDaSaida(status:RunPodStatus):Promise<{name:string;mime:string;bytes:Uint8Array}>{
 const image=status.output?.images?.[0];if(!image)throw new Error('O pedido terminou sem imagem.');
 const bytes=image.type==='s3_url'?new Uint8Array(await(await fetch(image.data)).arrayBuffer()):Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));
 const name=(image.filename||'arquivo.png').split('/').pop()!;const mime=/\.mp4$/i.test(name)?'video/mp4':/\.webm$/i.test(name)?'video/webm':/\.jpe?g$/i.test(name)?'image/jpeg':/\.webp$/i.test(name)?'image/webp':'image/png';
 return {name,mime,bytes};
}
