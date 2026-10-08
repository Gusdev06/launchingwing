import {env} from 'cloudflare:workers';
import {registrarErro} from './registrar-erro';
// Limite de taxa por chave (IP ou usuário) numa tabela do D1, sem KV. Janela fixa: a primeira chamada
// abre a janela, as seguintes contam até o teto. Se o banco falhar, deixa passar e registra.
export async function rateLimited(key:string,limit:number,windowMs:number):Promise<boolean>{
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)return false;
 const now=Date.now(),cutoff=now-windowMs;
 try{
  const row=await db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END RETURNING count').bind(key,now,cutoff,cutoff,now).first<{count:number}>();
  return (row?.count??0)>limit;
 }catch(error){registrarErro('rate_limit',error);return false}
}
export function clientKey(request:Request){return request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0].trim()||'local'}
