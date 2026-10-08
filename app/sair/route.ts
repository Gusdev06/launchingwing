import {redirect} from 'next/navigation';
import {chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {sair} from '@/lib/login-codigo';
import {lojaD1,loginProprioLigado,tokenDoCookie,cookieApagado} from '@/lib/login-d1';
import {registrarErro} from '@/lib/registrar-erro';
// O botão "Sair da conta" passa por aqui: o servidor sabe qual login está ativo (o próprio, o Access ou o de teste).
export async function GET(request:Request){
 if(loginProprioLigado()){
  try{await sair(lojaD1(),tokenDoCookie(request.headers.get('Cookie')))}catch(error){registrarErro('sair',error)}
  return new Response(null,{status:303,headers:{Location:'/entrar','Set-Cookie':cookieApagado(request.url),'Cache-Control':'no-store'}});
 }
 redirect(chatGPTSignOutPath('/cadastro'));
}
