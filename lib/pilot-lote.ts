// Conferência do lote que o motor devolve (sem Cloudflare, para provar em Node: scripts/pilot/lote-smoke.mjs).
import {z} from 'zod';
import type {PilotPiece} from './pilot-model';
const pieceSchema=z.object({id:z.string().regex(/^[a-z0-9_-]{1,60}$/),format:z.string().max(150),hook:z.string().min(1).max(500),caption:z.string().min(1).max(2200),rationale:z.string().max(5000),copy:z.enum(['PAS','BAB','AIDA','FAB','4Ps','QUEST']).optional(),provenance:z.string().max(10000),assets:z.array(z.object({file:z.string().max(2000),kind:z.enum(['image','video']),alt:z.string().max(1500),poster:z.string().max(2000).optional()})).min(1).max(6)});
function mediaUrl(runId:string,jobId:string,file:string){const name=file.split('/').pop()!;if(!/^[a-z0-9_-]+\.(mp4|png|jpe?g|webp)$/.test(name))throw new Error('O gerador retornou um arquivo inválido.');return `/api/pilot/${runId}/assets/${jobId}/${name}`}
export function generatedPieces(runId:string,jobId:string,result:unknown,partial=false,unique=false):PilotPiece[]{
 const {pieces,semMeme,semCarrossel}=z.object({pieces:z.array(pieceSchema).min(partial?0:1).max(3),semMeme:z.string().max(1000).optional(),semCarrossel:z.string().max(1000).optional()}).parse(result);
 // Sem meme só com motivo do motor (semMeme): nenhum vídeo. Sem um carrossel (semCarrossel, F4 07/10): um carrossel a menos.
 const videos=pieces.filter(p=>p.assets[0].kind==='video').length,carrosseis=pieces.length-videos,completo=videos===(semMeme?0:1)&&carrosseis===(semCarrossel?1:2);
 if(new Set(pieces.map(p=>p.id)).size!==pieces.length||pieces.some(p=>!(p.assets.length===1&&p.assets[0].kind==='video')&&!(p.assets.length===6&&p.assets.every(a=>a.kind==='image')))||(!partial&&!completo)||(semMeme&&videos>0))throw new Error('O lote não contém os três formatos esperados.');
 return pieces.map(piece=>({...piece,id:unique?`${jobId}-${piece.id}`:piece.id,status:'pending',feedback:'',reviewSeconds:0,assets:piece.assets.map(a=>({url:mediaUrl(runId,jobId,a.file),kind:a.kind,alt:a.alt,...(a.poster?{poster:mediaUrl(runId,jobId,a.poster)}:{})}))}));
}
// Por que o meme ou um carrossel não veio (portão reprovou, fotos ou texto falharam); vira aviso na tela de revisão.
export function avisoDoLote(result:unknown):string|undefined{const r=result as {semMeme?:unknown;semCarrossel?:unknown}|null;const t=[r?.semMeme,r?.semCarrossel].filter((s):s is string=>typeof s==='string'&&!!s.trim()).map(s=>s.trim()).join(' ');return t?t.slice(0,2000):undefined}
// O que o motor recebe do histórico do dono: os últimos ganchos (para não repetir) e os reprovados com o motivo (para aprender).
// copiasAnteriores: o modelo de copy das peças do último lote (id sem o prefixo do pedido), para o motor não repetir na mesma peça.
export function historicoDoDono(pieces:(Pick<PilotPiece,'hook'|'status'|'feedback'>&{id?:string;copy?:string})[]):{previousHooks?:string[];reprovados?:{hook:string;motivo:string}[];copiasAnteriores?:{id:string;copy:string}[]}{
 const reprovados=pieces.filter(p=>p.status==='changes'||p.status==='rejected').slice(-8).map(p=>({hook:p.hook,motivo:p.feedback}));
 const copiasAnteriores=pieces.slice(-3).filter(p=>p.id&&p.copy).map(p=>({id:p.id!.split('-').pop()!,copy:p.copy!}));
 return {...(pieces.length?{previousHooks:pieces.slice(-8).map(p=>p.hook)}:{}),...(reprovados.length?{reprovados}:{}),...(copiasAnteriores.length?{copiasAnteriores}:{})};
}
