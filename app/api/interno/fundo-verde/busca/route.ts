import {buscarFundoVerde} from '@/lib/fundo-verde/busca';
import {chaveValida,pedidoSchema,cabecalhos} from '@/lib/fundo-verde/acesso';
const STATUS={sem_resultado:404,limite:429,fonte_fora:502} as const;
export async function POST(request:Request){
 if(!await chaveValida(request))return Response.json({codigo:'sem_acesso',mensagem:'Chave ausente ou inválida.'},{status:401,headers:cabecalhos});
 const parsed=pedidoSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return Response.json({codigo:'pedido_invalido',mensagem:parsed.error.issues[0]?.message||'Confira o pedido.'},{status:400,headers:cabecalhos});
 try{
  const r=await buscarFundoVerde(parsed.data.tema,parsed.data.formato);
  if(!r.ok)return Response.json({codigo:r.codigo,mensagem:r.mensagem},{status:STATUS[r.codigo],headers:cabecalhos});
  return Response.json({termo:r.termo,escolhido:r.escolhido,candidatos:r.candidatos},{headers:cabecalhos});
 }catch(error){console.error('Fundo verde busca failed',error instanceof Error?error.message:'');return Response.json({codigo:'erro_interno',mensagem:'Não foi possível buscar agora.'},{status:500,headers:cabecalhos})}
}
