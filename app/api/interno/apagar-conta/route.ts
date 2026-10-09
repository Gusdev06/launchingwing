// Apaga uma conta inteira (DAD-04). Só com APAGAR_CONTA_CHAVE no cabeçalho x-chave (chave própria, nunca a do fundo verde). Corpo: {email}.
// Sem a variável configurada no Worker, a rota não existe (404).
import {env} from 'cloudflare:workers';
import {apagarConta} from '@/lib/apagar-conta';
import {chaveValida,cabecalhos} from '@/lib/fundo-verde/acesso';
import {registrarErro} from '@/lib/registrar-erro';
export async function POST(request:Request){
 const chave=(env as unknown as {APAGAR_CONTA_CHAVE?:string}).APAGAR_CONTA_CHAVE;
 if(!chave)return Response.json({codigo:'nao_existe',mensagem:'Rota desligada.'},{status:404,headers:cabecalhos});
 if(!await chaveValida(request,chave))return Response.json({codigo:'sem_acesso',mensagem:'Chave ausente ou inválida.'},{status:401,headers:cabecalhos});
 const corpo=await request.json().catch(()=>null) as {email?:unknown}|null;
 if(typeof corpo?.email!=='string'||!corpo.email.trim())return Response.json({codigo:'pedido_invalido',mensagem:'Mande {email} da conta a apagar.'},{status:400,headers:cabecalhos});
 try{
  const apagados=await apagarConta(corpo.email);
  if(!apagados)return Response.json({codigo:'sem_conta',mensagem:'Nenhuma conta com este e-mail.'},{status:404,headers:cabecalhos});
  console.warn(JSON.stringify({evento:'conta_apagada',apagados}));
  return Response.json({ok:true,apagados},{headers:cabecalhos});
 }catch(error){registrarErro('apagar_conta',error);return Response.json({codigo:'erro_interno',mensagem:'Não foi possível apagar agora. Tente de novo.'},{status:500,headers:cabecalhos})}
}
