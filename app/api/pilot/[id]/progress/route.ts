import {findRun} from '@/lib/pilot-store';
import {syncGeneration} from '@/lib/pilot-engine';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre para acompanhar seu caso.'},{status:403,headers:pilotHeaders});
 try{const run=await findRun(owner,(await params).id);if(!run)return Response.json({error:'Caso não encontrado.'},{status:404,headers:pilotHeaders});return Response.json({run:await syncGeneration(owner,run)},{headers:pilotHeaders})}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Não foi possível atualizar o andamento.'},{status:503,headers:pilotHeaders})}
}
