// Regras do aviso de saúde (08/10), sem Cloudflare para a prova rodar no Node (scripts/saude/regras.mjs).
export type EstadoDoMotor={falhas:number;fora:boolean;desde:string};
export type Canario={em:string;ok:boolean;motivo:string;job?:string};
// A rotina roda a cada 2 min: 5 falhas seguidas são 10 min fora. Menos que isso é túnel piscando e não vale acordar ninguém.
export const FALHAS_PARA_AVISAR=5;

export function proximoEstado(e:EstadoDoMotor,ok:boolean,agora:string):{estado:EstadoDoMotor;aviso?:string}{
 if(ok)return {estado:{falhas:0,fora:false,desde:e.fora?agora:e.desde},...(e.fora?{aviso:`O motor do Launchwing voltou (estava fora desde ${e.desde.slice(11,16)} UTC).`}:{})};
 const falhas=e.falhas+1;
 if(!e.fora&&falhas>=FALHAS_PARA_AVISAR)return {estado:{falhas,fora:true,desde:agora},aviso:'O motor do Launchwing está fora do ar há 10 min. O site mostra "gerador indisponível" e guarda os casos. Confira se o Mac está ligado, o motor e o túnel.'};
 return {estado:{...e,falhas}};
}

// Canário novo que falhou avisa uma vez; o mesmo canário (mesma hora) não repete.
export function avisoDoCanario(ultimoAvisado:string|undefined,c:Canario|null):string|undefined{
 if(!c||c.ok||c.em===ultimoAvisado)return undefined;
 return `O lote de teste falhou: ${c.motivo}${c.job?` (job ${c.job.slice(0,8)})`:''}.`;
}
