import {engineFetch,initialApiData,syncGeneration} from '@/lib/pilot-engine';
import {normalizeProductUrl,onboardingSchema,type PilotData} from '@/lib/pilot-model';
import {initialPilotData} from '@/lib/pilot-cases';
import {createRun,listRuns,casosNasUltimas24h} from '@/lib/pilot-store';
// Limite por conta: a IA grátis aguenta poucos casos bons por dia para todos (decisão do Nicolas em 06/10: 3, demo conta também).
// Teto do sistema inteiro (saúde P1, 08/10): 15 casos com o motor por dia, somando todas as contas; conta é grátis, o motor não.
const CASOS_POR_DIA=3,CASOS_NO_SISTEMA_POR_DIA=15;
import {pilotIdentity,pilotHeaders,readPilotBody} from '@/lib/pilot-http';
import {rateLimited} from '@/lib/rate-limit';
import {registrarErro} from '@/lib/registrar-erro';
export async function GET(request:Request){
 const owner=await pilotIdentity(request);if(!owner)return Response.json({error:'Entre para abrir seus casos.'},{status:401,headers:pilotHeaders});
 try{return Response.json({runs:await listRuns(owner)},{headers:pilotHeaders})}catch(error){registrarErro('pilot_listar',error);return Response.json({error:'Não conseguimos carregar seus casos. Tente novamente.'},{status:503,headers:pilotHeaders})}
}
export async function POST(request:Request){
 const owner=await pilotIdentity(request,true);if(!owner)return Response.json({error:'Entre novamente para salvar o caso.'},{status:403,headers:pilotHeaders});
 let url:string,mode:'api'|'demo',extra:Partial<PilotData>={};
 try{const body=await readPilotBody(request);mode=body?.mode==='demo'?'demo':'api';if(body?.flow==='blitz'&&mode==='api'){const answers=onboardingSchema.parse(body.answers);extra={flow:'blitz',onboarding:{step:2,answers,completedAt:null},batches:0};if(typeof body.description==='string'&&body.description.trim()){if(body.description.trim().length<40||body.description.length>3000)throw new Error('Descreva o produto em 40 a 3.000 caracteres.');extra.descriptionInput=body.description.trim()}}url=extra.descriptionInput?'':normalizeProductUrl(body?.url)}catch(error){return Response.json({error:error instanceof Error?error.message:'Confira o link.'},{status:400,headers:pilotHeaders})}
 try{
  const tetoDaConta=Response.json({error:`Você já criou ${CASOS_POR_DIA} casos nas últimas 24 horas. Tente de novo amanhã.`},{status:429,headers:pilotHeaders});
  if(await casosNasUltimas24h(owner)>=CASOS_POR_DIA)return tetoDaConta;
  if(mode==='api'&&await rateLimited('pilot-global',CASOS_NO_SISTEMA_POR_DIA,86400000))return Response.json({error:'O gerador atingiu o limite do dia. Tente amanhã.'},{status:429,headers:pilotHeaders});
  if(mode==='api'){const health=await(await engineFetch('/health')).json() as {ready:boolean};if(!health.ready)throw new Error('Complete as conexões do gerador privado antes de começar.')}
  let run=await createRun(owner,mode==='demo'?{...initialPilotData(url),mode:'demo'}:initialApiData(url,extra),CASOS_POR_DIA);
  if(!run)return tetoDaConta;
  if(mode==='api'){try{run=await syncGeneration(owner,run)}catch{/* Saved claim resumes on the next progress request. */}}
  return Response.json({run},{status:201,headers:pilotHeaders})
 }catch(error){registrarErro('pilot_criar',error);return Response.json({error:error instanceof Error?error.message:'O caso não foi salvo. Seu link continua aqui; tente novamente.'},{status:503,headers:pilotHeaders})}
}
