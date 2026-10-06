// Login próprio por código no e-mail (substitui o convite do Cloudflare Access quando LOGIN_PROPRIO=1).
// Sem Cloudflare aqui: o banco entra pela Loja (D1 em lib/login-d1.ts), para provar em Node (scripts/login/regras-smoke.mjs).
// O banco guarda só resumos (SHA-256) do código e da sessão: quem ler o banco não consegue entrar com o que achar lá.
export const CODIGO_MS=10*60_000,SESSAO_MS=30*24*60*60_000,TENTATIVAS=5;
export type UsuarioDaSessao={userId:string;email:string};
export type Loja={
 pegarCodigo(email:string):Promise<{hash:string;expira:number;tentativas:number}|null>;
 salvarCodigo(email:string,hash:string,expira:number):Promise<void>;
 somarTentativa(email:string):Promise<number>;
 apagarCodigo(email:string):Promise<void>;
 acharUsuario(email:string):Promise<{id:string;email:string}|null>;
 // Cria se não existir; se o e-mail já tem dono, devolve o dono que já estava.
 criarUsuario(id:string,email:string):Promise<{id:string;email:string}>;
 salvarSessao(hash:string,usuario:UsuarioDaSessao,expira:number):Promise<void>;
 acharSessao(hash:string):Promise<(UsuarioDaSessao&{expira:number})|null>;
 apagarSessao(hash:string):Promise<void>;
};
export type Enviar=(email:string,codigo:string)=>Promise<void>;
type Relogio=()=>number;

const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
export const normalizarEmail=(email:string)=>email.trim().toLowerCase();
async function resumo(texto:string){const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto)));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
const resumoDoCodigo=(email:string,codigo:string,segredo='')=>resumo(`codigo:${segredo}:${email}:${codigo}`);
const resumoDaSessao=(token:string)=>resumo(`sessao:${token}`);
// 6 dígitos sem viés: descarta sorteios acima do maior múltiplo de 1.000.000.
function gerarCodigo(){const n=new Uint32Array(1);do crypto.getRandomValues(n);while(n[0]>=4_294_000_000);return String(n[0]%1_000_000).padStart(6,'0')}
function gerarToken(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}

export async function pedirCodigo(loja:Loja,emailBruto:string,enviar:Enviar,agora:Relogio=Date.now,segredo=''):Promise<{ok:boolean;erro?:string}>{
 const email=normalizarEmail(emailBruto);if(!EMAIL.test(email))return {ok:false,erro:'Digite um e-mail válido.'};
 const codigo=gerarCodigo();
 await loja.salvarCodigo(email,await resumoDoCodigo(email,codigo,segredo),agora()+CODIGO_MS);
 await enviar(email,codigo);
 return {ok:true};
}

export async function verificarCodigo(loja:Loja,emailBruto:string,codigoBruto:string,agora:Relogio=Date.now,segredo=''):Promise<{ok:true;token:string;usuario:UsuarioDaSessao}|{ok:false;erro:string}>{
 const email=normalizarEmail(emailBruto),codigo=String(codigoBruto).replace(/\D/g,'');
 const falha={ok:false as const,erro:'Código errado ou vencido. Peça um novo código.'};
 const salvo=await loja.pegarCodigo(email);if(!salvo)return falha;
 if(salvo.expira<=agora()||salvo.tentativas>=TENTATIVAS){await loja.apagarCodigo(email);return falha}
 if(codigo.length!==6||await resumoDoCodigo(email,codigo,segredo)!==salvo.hash){if(await loja.somarTentativa(email)>=TENTATIVAS)await loja.apagarCodigo(email);return falha}
 await loja.apagarCodigo(email);
 const dono=await loja.acharUsuario(email)??await loja.criarUsuario(crypto.randomUUID(),email);
 const usuario={userId:dono.id,email},token=gerarToken();
 await loja.salvarSessao(await resumoDaSessao(token),usuario,agora()+SESSAO_MS);
 return {ok:true,token,usuario};
}

export async function usuarioDaSessao(loja:Loja,token:string|null|undefined,agora:Relogio=Date.now):Promise<UsuarioDaSessao|null>{
 if(!token||token.length>100)return null;
 const hash=await resumoDaSessao(token),s=await loja.acharSessao(hash);if(!s)return null;
 if(s.expira<=agora()){await loja.apagarSessao(hash);return null}
 return {userId:s.userId,email:s.email};
}
export async function sair(loja:Loja,token:string|null|undefined){if(token&&token.length<=100)await loja.apagarSessao(await resumoDaSessao(token))}
// Quem entra pelo Access fica gravado com o identificador dele: ao passar para o código no e-mail, continua dono dos mesmos dados.
export async function lembrarUsuario(loja:Loja,id:string,email:string){await loja.criarUsuario(id,normalizarEmail(email))}

export function enviarPorResend(f:typeof fetch,o:{chave:string;de:string}):Enviar{
 return async(email,codigo)=>{
  const r=await f('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${o.chave}`,'Content-Type':'application/json'},
   body:JSON.stringify({from:o.de,to:[email],subject:'Seu código para entrar na Launchwing',text:`Seu código é ${codigo}. Ele vale por 10 minutos.\n\nSe não foi você que pediu, ignore este e-mail.`})});
  if(!r.ok)throw new Error(`O envio do e-mail falhou (${r.status}).`);
 };
}
