import {findRun} from '@/lib/pilot-store';
import {engineFetch} from '@/lib/pilot-engine';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
export async function GET(request:Request,{params}:{params:Promise<{id:string;jobId:string;file:string}>}){
 const owner=await pilotIdentity(request);if(!owner)return new Response(null,{status:401,headers:pilotHeaders});
 const {id,jobId,file}=await params;
 try{
  const run=await findRun(owner,id),url=`/api/pilot/${id}/assets/${jobId}/${file}`;
  if(!run||!run.pieces.some(p=>p.assets.some(a=>a.url===url||a.poster===url)))return new Response(null,{status:404,headers:pilotHeaders});
  const upstream=await engineFetch(`/jobs/${jobId}/assets/${file}`);
  return new Response(upstream.body,{headers:{...pilotHeaders,'Content-Type':upstream.headers.get('Content-Type')||'application/octet-stream','X-Content-Type-Options':'nosniff',...(upstream.headers.get('Content-Length')?{'Content-Length':upstream.headers.get('Content-Length')!}:{})}});
 }catch(error){
  // O motor apaga pedidos com mais de 30 dias: arquivo que ele não tem mais é 404, não "gerador desconectado".
  if((error as {status?:number}).status===404)return Response.json({error:'Este arquivo não está mais guardado no gerador.'},{status:404,headers:pilotHeaders});
  return Response.json({error:'Arquivo indisponível. Confira se o gerador privado está conectado.'},{status:503,headers:pilotHeaders});
 }
}
