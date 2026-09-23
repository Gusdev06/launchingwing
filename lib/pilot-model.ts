import {z} from 'zod';

export type ReviewStatus='pending'|'approved'|'changes'|'rejected';
export type PilotPiece={
 id:string; format:string; hook:string; caption:string; rationale:string;
 assets:{url:string;kind:'image'|'video';alt:string;poster?:string}[];
 provenance:string; status:ReviewStatus; feedback:string; reviewSeconds:number;
};
export type PilotContext={name:string;description:string;audience:string;situations:string};
export const onboardingSchema=z.object({
 name:z.string().trim().min(2).max(100),company:z.string().trim().min(2).max(100),
 team:z.string().trim().max(50).default(''),revenue:z.string().trim().max(50).default(''),role:z.string().trim().max(100).default(''),
 businessModel:z.enum(['','B2B','B2C','Ambos']).default(''),categories:z.array(z.string().trim().min(1).max(80)).max(8).default([]),
 marketingNeed:z.string().trim().max(150).default(''),goals:z.array(z.string().trim().min(1).max(150)).max(8).default([]),discovery:z.string().trim().max(150).default(''),
});
export type PilotAnswers=z.infer<typeof onboardingSchema>;
export type PilotOnboarding={step:number;answers:PilotAnswers;completedAt:string|null};
export type PilotSource={url:string;label:string;checkedAt:string};
export type PilotGeneration={key:string;jobId?:string;kind:'analysis'|'production';status:'queued'|'running'|'failed'|'succeeded';stage:string;message:string;progress:number;error?:string;retryRequested?:boolean};
export type PilotData={
 url:string;caseId:string|null;phase:'queued'|'context'|'ready'|'review'|'analyzing'|'generating'|'failed';
 mode?:'api'|'demo';generation?:PilotGeneration;uncertainties?:string[];
 flow?:'blitz';onboarding?:PilotOnboarding;descriptionInput?:string;analysisJobId?:string;batches?:number;
 context:PilotContext;facts:string[];sources:PilotSource[];pieces:PilotPiece[];
 contextConfirmedAt:string|null;
 events:{at:string;kind:string;pieceId?:string;status?:ReviewStatus}[];
};
export type PilotRun=PilotData & {id:string;revision:number;createdAt:string;updatedAt:string};
export const contextSchema=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().min(10).max(1200),audience:z.string().trim().min(5).max(800),situations:z.string().trim().min(5).max(1200)});
export const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('onboarding'),revision:z.number().int().nonnegative(),step:z.number().int().min(2).max(10),answers:onboardingSchema,complete:z.boolean().default(false)}),
 z.object({action:z.literal('more'),revision:z.number().int().nonnegative()}),
 z.object({action:z.literal('swipe'),revision:z.number().int().nonnegative(),pieceId:z.string().trim().min(1).max(80),direction:z.enum(['left','right']),seconds:z.number().int().min(0).max(3600).default(0)}),
 z.object({action:z.literal('context'),revision:z.number().int().nonnegative(),context:contextSchema}),
 z.object({action:z.literal('retry'),revision:z.number().int().nonnegative()}),
 z.object({action:z.literal('prepare'),revision:z.number().int().nonnegative()}),
 z.object({action:z.literal('review'),revision:z.number().int().nonnegative(),pieceId:z.string().trim().min(1).max(80),caption:z.string().trim().min(1).max(2200),status:z.enum(['pending','approved','changes','rejected']),feedback:z.string().trim().max(1500),seconds:z.number().int().min(0).max(3600)}),
]);
export type PilotAction=z.infer<typeof actionSchema>;

export function normalizeProductUrl(input:unknown):string{
 if(typeof input!=='string'||input.length>1000)throw new Error('Informe um link válido do produto.');
 const value=input.trim();
 let url:URL;
 try{url=new URL(value.includes('://')?value:`https://${value}`)}catch{throw new Error('Informe um link válido do produto.')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||url.hostname.includes(':')||/^\d+(\.\d+){3}$/.test(url.hostname)||/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname))throw new Error('Use o link público HTTPS do produto.');
 url.hash='';
 return url.toString();
}

export function applyPilotAction(data:PilotData,action:PilotAction,prepared:PilotPiece[],now=new Date().toISOString()):PilotData{
 const next=structuredClone(data);
 if(action.action==='onboarding'){
  if(data.flow!=='blitz'||!data.onboarding||data.onboarding.completedAt)throw new Error('O cadastro deste produto já foi concluído.');
  if(action.complete&&(!action.answers.team||!action.answers.revenue||!action.answers.role||!action.answers.businessModel||!action.answers.categories.length||!action.answers.marketingNeed||!action.answers.goals.length||!action.answers.discovery))throw new Error('Responda às perguntas antes de continuar.');
  next.onboarding={step:action.step,answers:action.answers,completedAt:action.complete?now:null};
  if(action.complete)next.events.push({at:now,kind:'onboarding_completed'});
 }else if(action.action==='swipe'){
  const piece=next.pieces.find(p=>p.id===action.pieceId);
  if(!piece)throw new Error('Esta peça ainda não está pronta.');
  piece.status=action.direction==='right'?'approved':'rejected';piece.reviewSeconds+=action.seconds;
  next.events.push({at:now,kind:'piece_swiped',pieceId:piece.id,status:piece.status});
 }else if(action.action==='more'){
  throw new Error('Esta ação está disponível apenas na geração pela API.');
 }else if(action.action==='context'){
  if(!['context','ready','queued'].includes(data.phase))throw new Error('Este lote já foi preparado. Abra um novo caso para mudar o contexto.');
  next.context=action.context;next.contextConfirmedAt=now;next.phase=data.mode==='api'||data.caseId?'ready':'queued';
  next.events.push({at:now,kind:'context_confirmed'});
 }else if(action.action==='prepare'){
  if(!data.caseId||!data.contextConfirmedAt||data.phase!=='ready'||!prepared.length)throw new Error('Confirme o contexto de um caso preparado antes de abrir as peças.');
  next.pieces=structuredClone(prepared);next.phase='review';next.events.push({at:now,kind:'assisted_batch_opened'});
 }else if(action.action==='retry'){
  throw new Error('Esta ação está disponível apenas na geração pela API.');
 }else{
  if(data.phase!=='review'&&!(data.flow==='blitz'&&data.pieces.length))throw new Error('O lote ainda não está disponível para revisão.');
  const piece=next.pieces.find(p=>p.id===action.pieceId);
  if(!piece)throw new Error('Peça não encontrada neste lote.');
  if((action.status==='changes'||action.status==='rejected')&&!action.feedback)throw new Error('Conte o que precisa mudar ou por que não usaria esta peça.');
  piece.caption=action.caption;piece.status=action.status;piece.feedback=action.feedback;piece.reviewSeconds+=action.seconds;
  next.events.push({at:now,kind:'piece_reviewed',pieceId:piece.id,status:piece.status});
 }
 return next;
}
