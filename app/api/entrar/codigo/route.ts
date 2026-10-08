import {pedirCodigo,normalizarEmail} from '@/lib/login-codigo';
import {lojaD1,carteiro,loginProprioLigado,segredoDoLogin} from '@/lib/login-d1';
import {rateLimited,clientKey} from '@/lib/rate-limit';
// Pede o código de 6 dígitos por e-mail. Limites: 10 pedidos por hora por endereço de rede, 5 por e-mail
// e 300 por dia no sistema inteiro (saúde P1, 08/10: cada pedido é um e-mail da cota da Resend).
const CODIGOS_POR_DIA=300;
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(!loginProprioLigado())return Response.json({error:'Não encontrado.'},{status:404,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Envio não permitido.'},{status:403,headers});
 let email='';
 try{const body=await request.text();if(body.length>1024)throw 0;email=String((JSON.parse(body) as {email?:unknown}).email??'')}catch{return Response.json({error:'Digite um e-mail válido.'},{status:400,headers})}
 if(await rateLimited(`entrar:${clientKey(request)}`,10,3600000)||await rateLimited(`entrar-email:${normalizarEmail(email)}`,5,3600000)||await rateLimited('entrar-global',CODIGOS_POR_DIA,86400000))return Response.json({error:'Muitos pedidos de código. Tente de novo em uma hora.'},{status:429,headers});
 let enviar;try{enviar=carteiro(request.url)}catch(e){return Response.json({error:(e as Error).message},{status:503,headers})}
 try{const r=await pedirCodigo(lojaD1(),email,enviar,Date.now,segredoDoLogin());return r.ok?Response.json({ok:true},{headers}):Response.json({error:r.erro},{status:400,headers})}
 catch{console.error('Envio do codigo de login falhou');return Response.json({error:'Não conseguimos mandar o código agora. Tente de novo em instantes.'},{status:502,headers})}
}
