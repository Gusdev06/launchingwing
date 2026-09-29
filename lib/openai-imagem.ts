import {env} from 'cloudflare:workers';
// Cliente mínimo do ChatGPT Image (API de imagens da OpenAI). Responde direto, sem fila: 10 s a 2 min.
export type OpenAIConfig={apiKey:string;base:string;modelo:string};
export function openaiConfig():OpenAIConfig|null{
 const e=env as unknown as {OPENAI_API_KEY?:string;OPENAI_BASE_URL?:string;OPENAI_IMAGE_MODEL?:string};
 if(!e.OPENAI_API_KEY)return null;
 return {apiKey:e.OPENAI_API_KEY,base:(e.OPENAI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,''),modelo:e.OPENAI_IMAGE_MODEL||'gpt-image-2.5-flare'};
}
export type FotoBase={bytes:Uint8Array;mime:string};
// Com foto, usa /images/edits (a foto serve de base). Sem foto, /images/generations.
export async function gerarImagem(config:OpenAIConfig,{prompt,width,height,foto}:{prompt:string;width:number;height:number;foto?:FotoBase}):Promise<{name:string;mime:string;bytes:Uint8Array}>{
 const texto=prompt.trim();if(!texto)throw new Error('Descreva a imagem que você quer.');
 const campos={model:config.modelo,prompt:texto,size:`${width}x${height}`,quality:'medium',output_format:'png'};
 const headers={authorization:`Bearer ${config.apiKey}`};
 let response:Response;
 if(foto){
  const form=new FormData();for(const [k,v] of Object.entries(campos))form.append(k,v);
  const ext=foto.mime==='image/jpeg'?'jpg':foto.mime==='image/webp'?'webp':'png';
  form.append('image',new Blob([new Uint8Array(foto.bytes)],{type:foto.mime}),`base.${ext}`);
  response=await fetch(`${config.base}/images/edits`,{method:'POST',headers,body:form,signal:AbortSignal.timeout(180000)});
 }else response=await fetch(`${config.base}/images/generations`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(campos),signal:AbortSignal.timeout(180000)});
 if(!response.ok){
  const body=await response.text();console.error(`OpenAI image ${response.status}: ${body.slice(0,300)}`);
  if(response.status===400&&/safety|moderation/i.test(body))throw new Error('A OpenAI recusou esta descrição. Tente descrever de outro jeito.');
  if(response.status===429)throw new Error('A conta da OpenAI chegou ao limite ou está sem crédito. Avise o administrador.');
  throw new Error('A geração falhou no servidor de imagens. Tente de novo com outra descrição.');
 }
 const b64=((await response.json()) as {data?:{b64_json?:string}[]}).data?.[0]?.b64_json;
 if(!b64)throw new Error('O pedido terminou sem imagem.');
 return {name:`chatgpt-image-${Date.now()}.png`,mime:'image/png',bytes:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))};
}
