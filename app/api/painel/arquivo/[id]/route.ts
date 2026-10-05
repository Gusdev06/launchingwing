import {findFile,readChunk} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await pilotIdentity(request);if(!owner)return new Response(null,{status:401,headers:pilotHeaders});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/.test(id))return new Response(null,{status:404,headers:pilotHeaders});
 try{
  const file=await findFile(owner,id);if(!file)return new Response(null,{status:404,headers:pilotHeaders});
  let seq=0;
  const body=new ReadableStream<Uint8Array>({async pull(controller){if(seq>=file.chunks){controller.close();return}const chunk=await readChunk(file.id,seq++);if(!chunk){controller.error(new Error('Arquivo incompleto.'));return}controller.enqueue(new Uint8Array(chunk))}});
  return new Response(body,{headers:{...pilotHeaders,'Cache-Control':'private, max-age=3600','Content-Type':file.mime,'Content-Length':String(file.size),'X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="${encodeURIComponent(file.name)}"`}});
 }catch{return new Response(null,{status:503,headers:pilotHeaders})}
}
