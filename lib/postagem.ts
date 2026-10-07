// Postagem das peças aprovadas (sem Cloudflare aqui, para provar em Node: scripts/pilot/esqueleto-smoke.mjs).
// No esqueleto ela é simulada: ainda não há contas das redes. A fatia da postagem real troca POSTAGEM_SIMULADA.
import type {PilotData} from './pilot-model';
export const POSTAGEM_SIMULADA=true;
// Prazo para desfazer (frente 3, 07/10): a aprovação só vira post depois disso. O Fastlane não tem desfazer nenhum.
export const PRAZO_DESFAZER_MS=5*60_000;
// Hora em que a peça foi aprovada pela última vez (evento da revisão). Peça antiga sem evento conta como aprovada há muito tempo.
const aprovadaEm=(data:PilotData,id:string)=>data.events.filter(e=>e.pieceId===id&&e.status==='approved').at(-1)?.at??'1970-01-01T00:00:00.000Z';

export function postarAprovadas(data:PilotData,agora:string,prazoMs=PRAZO_DESFAZER_MS):PilotData|null{
 const pronta=(p:PilotData['pieces'][number])=>p.status==='approved'&&!p.postagem&&Date.parse(agora)-Date.parse(aprovadaEm(data,p.id))>=prazoMs;
 if(!data.pieces.some(pronta))return null;
 const next=structuredClone(data);
 for(const p of next.pieces)if(pronta(p)){p.postagem={status:'postada',em:agora,simulacao:POSTAGEM_SIMULADA};next.events.push({at:agora,kind:'piece_posted',pieceId:p.id})}
 return next;
}


// O que o cartão da Galeria mostra sobre a postagem (F1 na tela, 07/10). Hora de Brasília.
export function rotuloDaPostagem(p:{status:string;postagem?:{em:string;simulacao:boolean}}):string|undefined{
 if(p.postagem){const quando=new Date(p.postagem.em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});return p.postagem.simulacao?'Pronta para postar':`Postada em ${quando}`}
 // Sem as redes ligadas nada é postado de verdade (reunião de 07/10): o cartão nunca diz "Postada" nem "na fila".
 return p.status==='approved'?(POSTAGEM_SIMULADA?'Pronta para postar':'Na fila para postar'):undefined;
}
