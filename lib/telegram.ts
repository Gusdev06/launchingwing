// Aviso no Telegram (08/10, escolha do dono). Sem TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (secrets do Worker), não faz nada.
// Falha do Telegram nunca derruba a rotina: vai só para o registro.
import {env} from 'cloudflare:workers';
export async function avisarTelegram(texto:string){
 const e=env as unknown as {TELEGRAM_BOT_TOKEN?:string;TELEGRAM_CHAT_ID?:string};
 if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_CHAT_ID)return false;
 try{
  const r=await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:e.TELEGRAM_CHAT_ID,text:texto}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)console.error(JSON.stringify({evento:'telegram_falhou',status:r.status}));
  return r.ok;
 }catch{console.error(JSON.stringify({evento:'telegram_falhou',status:'rede'}));return false}
}
