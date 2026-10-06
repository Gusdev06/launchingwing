// Login próprio no D1: a Loja de lib/login-codigo.ts, o carteiro do e-mail e o cookie da sessão.
// Liga com LOGIN_PROPRIO=1. Envio: Resend (RESEND_API_KEY e LOGIN_EMAIL_DE). Sem eles, só no computador local com
// LOGIN_EMAIL_TESTE=1, o código aparece no registro do servidor (prova de ponta a ponta: scripts/login/rotas-smoke.mjs).
import {env} from 'cloudflare:workers';
import {enviarPorResend,SESSAO_MS,type Enviar,type Loja} from './login-codigo';
type Config={DB?:D1Database;LOGIN_PROPRIO?:string;RESEND_API_KEY?:string;LOGIN_EMAIL_DE?:string;LOGIN_EMAIL_TESTE?:string;LOGIN_SEGREDO?:string};
const config=()=>env as unknown as Config;
export const loginProprioLigado=()=>config().LOGIN_PROPRIO==='1';
export const segredoDoLogin=()=>config().LOGIN_SEGREDO??'';
export const COOKIE='lw_sessao';

export function lojaD1():Loja{
 const db=config().DB;if(!db)throw new Error('Banco indisponível.');
 return {
  pegarCodigo:email=>db.prepare('SELECT hash,expira,tentativas FROM login_codigos WHERE email=?').bind(email).first(),
  salvarCodigo:async(email,hash,expira)=>{await db.prepare('INSERT INTO login_codigos (email,hash,expira,tentativas) VALUES (?,?,?,0) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,expira=excluded.expira,tentativas=0').bind(email,hash,expira).run()},
  somarTentativa:async email=>(await db.prepare('UPDATE login_codigos SET tentativas=tentativas+1 WHERE email=? RETURNING tentativas').bind(email).first<{tentativas:number}>())?.tentativas??0,
  apagarCodigo:async email=>{await db.prepare('DELETE FROM login_codigos WHERE email=?').bind(email).run()},
  acharUsuario:email=>db.prepare('SELECT id,email FROM usuarios WHERE email=?').bind(email).first(),
  criarUsuario:async(id,email)=>{await db.prepare('INSERT INTO usuarios (id,email,criado_em) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING').bind(id,email,Date.now()).run();return (await db.prepare('SELECT id,email FROM usuarios WHERE email=?').bind(email).first<{id:string;email:string}>())!},
  salvarSessao:async(hash,u,expira)=>{await db.prepare('INSERT INTO sessoes (hash,user_id,email,expira) VALUES (?,?,?,?)').bind(hash,u.userId,u.email,expira).run()},
  acharSessao:async hash=>{const r=await db.prepare('SELECT user_id,email,expira FROM sessoes WHERE hash=?').bind(hash).first<{user_id:string;email:string;expira:number}>();return r?{userId:r.user_id,email:r.email,expira:r.expira}:null},
  apagarSessao:async hash=>{await db.prepare('DELETE FROM sessoes WHERE hash=?').bind(hash).run()},
 };
}

const local=(url:string)=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
// Carteiro do e-mail. O de teste só existe no computador local, para um descuido de configuração no ar nunca expor código.
export function carteiro(url:string):Enviar{
 const c=config();
 if(c.RESEND_API_KEY&&c.LOGIN_EMAIL_DE)return enviarPorResend(fetch,{chave:c.RESEND_API_KEY,de:c.LOGIN_EMAIL_DE});
 if(c.LOGIN_EMAIL_TESTE==='1'&&local(url))return async(email,codigo)=>{console.log(`[login-teste] codigo para ${email}: ${codigo}`)};
 throw new Error('O envio do código por e-mail ainda não está configurado.');
}

export function tokenDoCookie(cookie:string|null):string|null{
 for(const parte of (cookie??'').split(';')){const [k,...v]=parte.trim().split('=');if(k===COOKIE)return v.join('=')||null}
 return null;
}
export function cookieDaSessao(token:string,url:string){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSAO_MS/1000)}${new URL(url).protocol==='https:'?'; Secure':''}`}
export function cookieApagado(url:string){return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(url).protocol==='https:'?'; Secure':''}`}
