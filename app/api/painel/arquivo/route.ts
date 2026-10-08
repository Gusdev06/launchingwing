import {contentMatchesMime,fileMimes,keySchema,MAX_FILE_BYTES} from '@/lib/workspace-model';
import {CotaExcedida,createFile} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
import {rateLimited} from '@/lib/rate-limit';
import {registrarErro} from '@/lib/registrar-erro';
async function readBytes(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error('Arquivo ausente.');
 const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_FILE_BYTES){await reader.cancel();throw new Error('O arquivo passa de 20 MB.')}chunks.push(value)}}finally{reader.releaseLock()}
 if(!bytes)throw new Error('Arquivo vazio.');
 const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}return all;
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner){await request.body?.cancel();return Response.json({error:'Entre novamente para enviar arquivos.'},{status:403,headers:pilotHeaders})}
 if(await rateLimited(`arquivo:${owner}`,60,3600000)){await request.body?.cancel();return Response.json({error:'Muitos envios em uma hora. Aguarde um pouco e tente de novo.'},{status:429,headers:pilotHeaders})}
 const mime=(request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 if(!fileMimes.has(mime)){await request.body?.cancel();return Response.json({error:'Use JPG, PNG, WebP, GIF, MP4 ou WebM.'},{status:415,headers:pilotHeaders})}
 const chave=keySchema.safeParse(new URL(request.url).searchParams.get('chave')||'preview');if(!chave.success)return Response.json({error:'Chave do espaço inválida.'},{status:400,headers:pilotHeaders});
 let name='arquivo';try{name=decodeURIComponent(request.headers.get('X-Nome')||'arquivo').slice(0,200)||'arquivo'}catch{await request.body?.cancel();return Response.json({error:'Nome do arquivo inválido.'},{status:400,headers:pilotHeaders})}
 let bytes:Uint8Array;try{bytes=await readBytes(request)}catch(error){return Response.json({error:error instanceof Error?error.message:'Envio inválido.'},{status:413,headers:pilotHeaders})}
 if(!contentMatchesMime(bytes,mime))return Response.json({error:'O conteúdo do arquivo não corresponde ao tipo. Use JPG, PNG, WebP, GIF, MP4 ou WebM.'},{status:415,headers:pilotHeaders});
 try{const file=await createFile(owner,chave.data,name,mime,bytes);return Response.json({id:file.id,url:`/api/painel/arquivo/${file.id}`,size:file.size},{status:201,headers:pilotHeaders})}
 catch(error){if(error instanceof CotaExcedida)return Response.json({error:error.message},{status:413,headers:pilotHeaders});registrarErro('painel_arquivo',error);return Response.json({error:'Não foi possível guardar o arquivo. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
