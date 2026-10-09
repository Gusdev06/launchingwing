import {env} from 'cloudflare:workers';
import {z} from 'zod';
// API interna: só responde a quem manda a chave secreta no cabeçalho x-chave. Sem FUNDO_VERDE_CHAVE configurada, recusa tudo.
export const cabecalhos={'Cache-Control':'private, no-store'};
// Outra chave no mesmo molde (ex.: APAGAR_CONTA_CHAVE em app/api/interno/apagar-conta): passe a esperada; cada rota interna tem a sua.
export async function chaveValida(request:Request,esperada=(env as unknown as {FUNDO_VERDE_CHAVE?:string}).FUNDO_VERDE_CHAVE){
 const recebida=request.headers.get('x-chave');
 if(!esperada||esperada.length<16||!recebida)return false;
 const [a,b]=await Promise.all([esperada,recebida].map(t=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))));
 return (crypto.subtle as SubtleCrypto&{timingSafeEqual:(a:ArrayBuffer,b:ArrayBuffer)=>boolean}).timingSafeEqual(a,b);
}
export const pedidoSchema=z.object({
 tema:z.string().trim().min(2,'Tema curto demais.').max(60,'Tema longo demais: até 60 letras.').regex(/^[\p{L}\p{N} -]+$/u,'Use só letras, números, espaço e hífen no tema.'),
 formato:z.enum(['vertical','horizontal']).default('vertical'),
});
