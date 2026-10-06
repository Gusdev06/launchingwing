import {verificarCodigo} from '@/lib/login-codigo';
import {lojaD1,loginProprioLigado,segredoDoLogin,cookieDaSessao} from '@/lib/login-d1';
import {rateLimited,clientKey} from '@/lib/rate-limit';
// Confere o código e abre a sessão (cookie só do servidor, HttpOnly). Cada código aceita 5 tentativas.
export async function POST(request:Request){
 const headers:Record<string,string>={'Cache-Control':'no-store'};
 if(!loginProprioLigado())return Response.json({error:'Não encontrado.'},{status:404,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Envio não permitido.'},{status:403,headers});
 if(await rateLimited(`entrar-codigo:${clientKey(request)}`,30,3600000))return Response.json({error:'Muitas tentativas. Tente de novo em uma hora.'},{status:429,headers});
 let email='',codigo='';
 try{const body=await request.text();if(body.length>1024)throw 0;const d=JSON.parse(body) as {email?:unknown;codigo?:unknown};email=String(d.email??'');codigo=String(d.codigo??'')}catch{return Response.json({error:'Confira o código.'},{status:400,headers})}
 const r=await verificarCodigo(lojaD1(),email,codigo,Date.now,segredoDoLogin());
 if(!r.ok)return Response.json({error:r.erro},{status:401,headers});
 return Response.json({ok:true},{headers:{...headers,'Set-Cookie':cookieDaSessao(r.token,request.url)}});
}
