// Registro de erro no servidor: uma linha JSON por falha, no molde dos eventos 'lote' e 'motor', com a causa original.
// Nunca passe e-mail nem o corpo do pedido no extra; por garantia, todo e-mail que aparecer vira '[e-mail]'.
const EMAIL=/[^\s<>"'()[\]{},;:]+@[^\s<>"'()[\]{},;:]+\.[a-z]{2,}/gi;
const semEmail=(valor:unknown):unknown=>typeof valor==='string'?valor.replace(EMAIL,'[e-mail]'):Array.isArray(valor)?valor.map(semEmail):valor&&typeof valor==='object'?Object.fromEntries(Object.entries(valor as Record<string,unknown>).map(([k,v])=>[k,semEmail(v)])):valor;
export function registrarErro(evento:string,erro:unknown,extra?:Record<string,unknown>){
 const mensagem=erro instanceof Error?erro.message:typeof erro==='string'?erro:String(erro);
 const status=(erro as {status?:unknown}|null)?.status;
 console.error(JSON.stringify(semEmail({evento,erro:mensagem,...(typeof status==='number'?{status}:{}),...extra})));
}
