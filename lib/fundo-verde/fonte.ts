// Molde comum das fontes de vídeo de fundo verde. Fonte nova: um arquivo que exporta um objeto Fonte e entra na lista de busca.ts.
export type Formato='vertical'|'horizontal';
export type Candidato={fonte:string;fonteId:string;autor:string;autorUrl:string|null;pagina:string;licenca:string;largura:number;altura:number;duracao:number;arquivoUrl:string;quadros:string[]};
export type Busca={termo:string;formato:Formato;idioma:'pt'|'en'};
export type Fonte={nome:string;buscar:(busca:Busca)=>Promise<Candidato[]>};
export class ErroFonte extends Error{constructor(public codigo:'limite'|'fora',message:string){super(message)}}
// Resposta HTTP de uma fonte vira erro com código: 429 é limite, o resto é fonte fora.
export async function pedirFonte(nome:string,url:string,init?:RequestInit){
 let response:Response;
 try{response=await fetch(url,{...init,signal:AbortSignal.timeout(15000)})}catch{throw new ErroFonte('fora',`${nome} não respondeu.`)}
 if(response.status===429)throw new ErroFonte('limite',`${nome} chegou ao limite de buscas.`);
 if(!response.ok)throw new ErroFonte('fora',`${nome} respondeu ${response.status}.`);
 return response.json();
}
export const noFormato=(formato:Formato,largura:number,altura:number)=>formato==='vertical'?altura>largura:largura>altura;
