// Apaga uma conta inteira (DAD-04). Só com a chave interna no cabeçalho x-chave, a mesma da busca de fundo verde. Corpo: {email}.
import {apagarConta} from '@/lib/apagar-conta';
import {chaveValida,cabecalhos} from '@/lib/fundo-verde/acesso';
import {registrarErro} from '@/lib/registrar-erro';
export async function POST(request:Request){
 if(!await chaveValida(request))return Response.json({codigo:'sem_acesso',mensagem:'Chave ausente ou inválida.'},{status:401,headers:cabecalhos});
 const corpo=await request.json().catch(()=>null) as {email?:unknown}|null;
 if(typeof corpo?.email!=='string'||!corpo.email.trim())return Response.json({codigo:'pedido_invalido',mensagem:'Mande {email} da conta a apagar.'},{status:400,headers:cabecalhos});
 try{
  const apagados=await apagarConta(corpo.email);
  if(!apagados)return Response.json({codigo:'sem_conta',mensagem:'Nenhuma conta com este e-mail.'},{status:404,headers:cabecalhos});
  console.warn(JSON.stringify({evento:'conta_apagada',apagados}));
  return Response.json({ok:true,apagados},{headers:cabecalhos});
 }catch(error){registrarErro('apagar_conta',error);return Response.json({codigo:'erro_interno',mensagem:'Não foi possível apagar agora. Tente de novo.'},{status:500,headers:cabecalhos})}
}
