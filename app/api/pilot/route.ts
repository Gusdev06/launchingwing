import {engineFetch,initialApiData,syncGeneration} from '@/lib/pilot-engine';
import {normalizeProductUrl,onboardingSchema,type PilotData} from '@/lib/pilot-model';
import {initialPilotData} from '@/lib/pilot-cases';
import {createRun,listRuns} from '@/lib/pilot-store';
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
export async function GET(request:Request){
 const owner=await pilotIdentity(request);if(!owner)return Response.json({error:'Entre para abrir seus casos.'},{status:401,headers:pilotHeaders});
 try{return Response.json({runs:await listRuns(owner)},{headers:pilotHeaders})}catch{console.error('Pilot list unavailable');return Response.json({error:'Não conseguimos carregar seus casos. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para salvar o caso.'},{status:403,headers:pilotHeaders});
 let url:string,mode:'api'|'demo',extra:Partial<PilotData>={};
 try{const body=await readPilotBody(request);mode=body?.mode==='demo'?'demo':'api';if(body?.flow==='blitz'&&mode==='api'){const answers=onboardingSchema.parse(body.answers);extra={flow:'blitz',onboarding:{step:2,answers,completedAt:null},batches:0};if(typeof body.description==='string'&&body.description.trim()){if(body.description.trim().length<40||body.description.length>3000)throw new Error('Descreva o produto em 40 a 3.000 caracteres.');extra.descriptionInput=body.description.trim()}}url=extra.descriptionInput?'':normalizeProductUrl(body?.url)}catch(error){return Response.json({error:error instanceof Error?error.message:'Confira o link.'},{status:400,headers:pilotHeaders})}
 try{
  if(mode==='api'){const health=await(await engineFetch('/health')).json() as {ready:boolean};if(!health.ready)throw new Error('Complete as conexões do gerador privado antes de começar.')}
  let run=await createRun(owner,mode==='demo'?{...initialPilotData(url),mode:'demo'}:initialApiData(url,extra));
  if(mode==='api'){try{run=await syncGeneration(owner,run)}catch{/* Saved claim resumes on the next progress request. */}}
  return Response.json({run},{status:201,headers:pilotHeaders})
 }catch(error){console.error('Pilot creation unavailable');return Response.json({error:error instanceof Error?error.message:'O caso não foi salvo. Seu link continua aqui; tente novamente.'},{status:503,headers:pilotHeaders})}
}
