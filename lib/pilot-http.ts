import {getChatGPTUser} from '@/app/chatgpt-auth';
export const pilotHeaders={'Cache-Control':'private, no-store'};
export async function pilotIdentity(request:Request,write=false){
 if(write){const origin=request.headers.get('Origin');if(origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return null}
 return (await getChatGPTUser())?.userId??null;
}
export async function readPilotBody(request:Request,limit=12000){
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new Error('Envie os dados em JSON.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Dados ausentes.');
 const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new Error(`Os dados ultrapassam o limite deste formulário (${Math.round(limit/1000)} KB).`)}chunks.push(value)}}finally{reader.releaseLock()}
 const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}return JSON.parse(new TextDecoder().decode(all));
}
