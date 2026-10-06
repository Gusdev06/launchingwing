// Postagem das peças aprovadas (sem Cloudflare aqui, para provar em Node: scripts/pilot/esqueleto-smoke.mjs).
// No esqueleto ela é simulada: ainda não há contas das redes. A fatia da postagem real troca POSTAGEM_SIMULADA.
import type {PilotData} from './pilot-model';
export const POSTAGEM_SIMULADA=true;

export function postarAprovadas(data:PilotData,agora:string):PilotData|null{
 const faltam=data.pieces.filter(p=>p.status==='approved'&&!p.postagem);if(!faltam.length)return null;
 const next=structuredClone(data);
 for(const p of next.pieces)if(p.status==='approved'&&!p.postagem){p.postagem={status:'postada',em:agora,simulacao:POSTAGEM_SIMULADA};next.events.push({at:agora,kind:'piece_posted',pieceId:p.id})}
 return next;
}

