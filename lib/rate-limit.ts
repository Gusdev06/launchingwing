import {env} from 'cloudflare:workers';
import {registrarErro} from './registrar-erro';
// Limite de taxa por chave (IP ou usuário) numa tabela do D1, sem KV. Janela fixa: a primeira chamada
// abre a janela, as seguintes contam até o teto. Se o banco falhar, deixa passar e registra.
// Janela mais longa em uso (pilot-ip, motor-global, entrar-global): a rotina apaga linhas mais velhas que ela (lib/rotina.ts).
export const JANELA_MAIS_LONGA_MS=86400000;
export async function rateLimited(key:string,limit:number,windowMs:number):Promise<boolean>{
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)return false;
 const now=Date.now(),cutoff=now-windowMs;
 try{
  const row=await db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END RETURNING count').bind(key,now,cutoff,cutoff,now).first<{count:number}>();
  return (row?.count??0)>limit;
 }catch(error){registrarErro('rate_limit',error);return false}
}
// Devolve a vaga de quem contou e não chegou a gastar (o caso não foi gravado, o pedido não chegou ao motor).
export async function devolverVaga(key:string){
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)return;
 try{await db.prepare('UPDATE rate_limits SET count=count-1 WHERE key=? AND count>0').bind(key).run()}catch(error){registrarErro('rate_limit',error)}
}
// IPv6 conta pela faixa /64 (revisão R4-P1): quem tem uma faixa troca de endereço à vontade dentro dela.
export function faixaDoIp(ip:string){if(!ip.includes(':'))return ip;const [a,b]=ip.split('::'),esq=a?a.split(':'):[],dir=b?b.split(':'):[];
 const todos=b===undefined?esq:[...esq,...Array(Math.max(0,8-esq.length-dir.length)).fill('0'),...dir];return todos.slice(0,4).map(g=>g.toLowerCase().replace(/^0+(?=.)/,'')).join(':')+'::/64'}
export function clientKey(request:Request){return faixaDoIp(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0].trim()||'local')}
