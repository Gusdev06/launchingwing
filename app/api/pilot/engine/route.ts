import {engineFetch} from '@/lib/pilot-engine';
import {pilotIdentity,pilotHeaders} from '@/lib/pilot-http';
export async function GET(request:Request){
 if(!await pilotIdentity(request))return Response.json({error:'Entre para continuar.'},{status:401,headers:pilotHeaders});
 try{return Response.json(await(await engineFetch('/health')).json(),{headers:pilotHeaders})}catch(error){return Response.json({ready:false,error:error instanceof Error?error.message:'Gerador indisponível.'},{headers:pilotHeaders})}
}
