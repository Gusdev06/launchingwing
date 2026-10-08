// Sentinela (08/10): a rotina de 2 minutos pergunta ao motor (/health), guarda o estado no D1 (tabela saude) e avisa no
// Telegram quando ele some por 10 min, quando volta e quando o lote de teste diário falha. /api/saude só lê o que ficou guardado:
// visita na página nunca bate no Mac.
import {env} from 'cloudflare:workers';
import {engineFetch} from './pilot-engine';
import {avisarTelegram} from './telegram';
import {proximoEstado,avisoDoCanario,type EstadoDoMotor,type Canario} from './saude-regras';

const db=()=>(env as unknown as {DB:D1Database}).DB;
async function ler<T>(chave:string):Promise<T|null>{const r=await db().prepare('SELECT valor FROM saude WHERE chave=?').bind(chave).first<{valor:string}>();return r?JSON.parse(r.valor) as T:null}
async function gravar(chave:string,valor:unknown,agora:string){await db().prepare('INSERT INTO saude(chave,valor,atualizado) VALUES(?,?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,atualizado=excluded.atualizado').bind(chave,JSON.stringify(valor),agora).run()}

export async function sentinela(agora=new Date().toISOString()){
 let saudeDoMotor:{canario?:Canario|null}&Record<string,unknown>|null=null;
 try{saudeDoMotor=await(await engineFetch('/health')).json()}catch{saudeDoMotor=null}
 const antes=await ler<EstadoDoMotor>('motor')??{falhas:0,fora:false,desde:agora};
 const {estado,aviso}=proximoEstado(antes,!!saudeDoMotor,agora);
 await gravar('motor',estado,agora);
 if(saudeDoMotor)await gravar('motor_health',saudeDoMotor,agora);
 if(aviso){console.warn(JSON.stringify({evento:'motor',fora:estado.fora,falhas:estado.falhas}));await avisarTelegram(aviso)}
 const canario=saudeDoMotor?.canario??null,avisado=await ler<string>('canario_avisado');
 const avisoCanario=avisoDoCanario(avisado??undefined,canario);
 if(avisoCanario&&canario){console.warn(JSON.stringify({evento:'canario_falhou',job:canario.job,motivo:canario.motivo}));await avisarTelegram(avisoCanario);await gravar('canario_avisado',canario.em,agora)}
}

// O que /api/saude mostra: sem segredo e sem dado de cliente.
export async function resumoDaSaude(){
 const r=await db().prepare('SELECT chave,valor,atualizado FROM saude').all<{chave:string;valor:string;atualizado:string}>();
 const m=new Map(r.results.map(x=>[x.chave,{v:JSON.parse(x.valor),em:x.atualizado}]));
 const motor=m.get('motor'),h=m.get('motor_health')?.v as {acervo?:unknown;lotes24h?:unknown;canario?:Canario|null}|undefined;
 return {site:'ok',conferidoEm:motor?.em??null,motor:motor?{noAr:!motor.v.fora,falhasSeguidas:motor.v.falhas,desde:motor.v.desde}:null,
  acervo:h?.acervo??null,lotes24h:h?.lotes24h??null,canario:h?.canario?{em:h.canario.em,ok:h.canario.ok,motivo:h.canario.motivo}:null};
}
