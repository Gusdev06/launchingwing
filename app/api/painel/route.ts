import {keySchema,saveSchema,MAX_DOC_BYTES} from '@/lib/workspace-model';
import {CotaExcedida,deleteWorkspace,findWorkspace,saveWorkspace} from '@/lib/workspace-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
import {rateLimited} from '@/lib/rate-limit';
function key(request:Request){const parsed=keySchema.safeParse(new URL(request.url).searchParams.get('chave')||'preview');return parsed.success?parsed.data:null}
export async function GET(request:Request){
 const owner=await pilotIdentity(request);if(!owner)return Response.json({error:'Entre para abrir seu espaço.'},{status:401,headers:pilotHeaders});
 const chave=key(request);if(!chave)return Response.json({error:'Chave do espaço inválida.'},{status:400,headers:pilotHeaders});
 try{return Response.json({workspace:await findWorkspace(owner,chave)},{headers:pilotHeaders})}catch{console.error('Workspace read unavailable');return Response.json({error:'Não foi possível abrir seu espaço. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
export async function PUT(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para salvar.'},{status:403,headers:pilotHeaders});
 if(await rateLimited(`painel:${owner}`,120,60000)){await request.body?.cancel();return Response.json({error:'Muitas gravações seguidas. Aguarde um minuto e tente de novo.'},{status:429,headers:pilotHeaders})}
 let body;try{body=await readPilotBody(request,MAX_DOC_BYTES)}catch(error){return Response.json({error:error instanceof Error?error.message:'Envio inválido.'},{status:413,headers:pilotHeaders})}
 const parsed=saveSchema.safeParse(body);if(!parsed.success)return Response.json({error:'Os dados do espaço estão fora do formato esperado. Recarregue a página e tente de novo.'},{status:400,headers:pilotHeaders});
 try{
  const revision=await saveWorkspace(owner,parsed.data.chave,parsed.data.revision,parsed.data.data);
  if(revision===null)return Response.json({error:'Este espaço mudou em outra aba. Recarregue para continuar da versão mais recente.'},{status:409,headers:pilotHeaders});
  return Response.json({revision},{headers:pilotHeaders});
 }catch(error){if(error instanceof CotaExcedida)return Response.json({error:error.message},{status:413,headers:pilotHeaders});console.error('Workspace save unavailable');return Response.json({error:'Não foi possível salvar. Suas edições continuam na tela; tente novamente.'},{status:503,headers:pilotHeaders})}
}
export async function DELETE(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para continuar.'},{status:403,headers:pilotHeaders});
 const chave=key(request);if(!chave)return Response.json({error:'Chave do espaço inválida.'},{status:400,headers:pilotHeaders});
 try{await deleteWorkspace(owner,chave);return Response.json({ok:true},{headers:pilotHeaders})}catch{console.error('Workspace delete unavailable');return Response.json({error:'Não foi possível apagar agora. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
