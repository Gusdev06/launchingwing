import {findRun} from '@/lib/pilot-store';
import {engineFetch} from '@/lib/pilot-engine';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
import {lerMidia,guardarMidia} from '@/lib/midia';
export async function GET(request:Request,{params}:{params:Promise<{id:string;jobId:string;file:string}>}){
 const owner=await pilotIdentity(request);if(!owner)return new Response(null,{status:401,headers:pilotHeaders});
 const {id,jobId,file}=await params;
 try{
  const run=await findRun(owner,id),url=`/api/pilot/${id}/assets/${jobId}/${file}`;
  if(!run||!run.pieces.some(p=>p.assets.some(a=>a.url===url||a.poster===url)))return new Response(null,{status:404,headers:pilotHeaders});
  // Guardado na Cloudflare: abre mesmo com o Mac desligado e depois que o motor apagou o pedido.
  const guardado=await lerMidia(jobId,file);
  if(guardado)return new Response(guardado.corpo,{headers:{...pilotHeaders,'Content-Type':guardado.tipo,'X-Content-Type-Options':'nosniff','Content-Length':String(guardado.corpo.byteLength)}});
  // Ainda não guardado (a rotina guarda a cada 2 minutos): busca no motor e guarda agora.
  await guardarMidia(jobId,[file]).catch(()=>0);
  const depois=await lerMidia(jobId,file);
  if(depois)return new Response(depois.corpo,{headers:{...pilotHeaders,'Content-Type':depois.tipo,'X-Content-Type-Options':'nosniff','Content-Length':String(depois.corpo.byteLength)}});
  const upstream=await engineFetch(`/jobs/${jobId}/assets/${file}`);
  return new Response(upstream.body,{headers:{...pilotHeaders,'Content-Type':upstream.headers.get('Content-Type')||'application/octet-stream','X-Content-Type-Options':'nosniff',...(upstream.headers.get('Content-Length')?{'Content-Length':upstream.headers.get('Content-Length')!}:{})}});
 }catch(error){
  // O motor apaga pedidos com mais de 30 dias: arquivo que ele não tem mais é 404, não "gerador desconectado".
  if((error as {status?:number}).status===404)return Response.json({error:'Este arquivo não está mais guardado no gerador.'},{status:404,headers:pilotHeaders});
  return Response.json({error:'Arquivo indisponível. Confira se o gerador privado está conectado.'},{status:503,headers:pilotHeaders});
 }
}
