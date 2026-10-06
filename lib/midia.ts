// Imagens e vídeos das peças guardados na Cloudflare (KV MIDIA), copiados do motor quando o lote fica pronto.
// Sem isso, a peça dependia do Mac ligado para aparecer e sumia quando o motor apagava o pedido (30 dias).
import {env} from 'cloudflare:workers';
import {engineFetch} from './pilot-engine';
const kv=()=>(env as unknown as {MIDIA?:KVNamespace}).MIDIA;
const chave=(jobId:string,file:string)=>`${jobId}/${file}`;
const NOME=/^[a-z0-9_-]+\.(mp4|png|jpe?g|webp)$/;

export async function lerMidia(jobId:string,file:string){
 const loja=kv();if(!loja||!NOME.test(file))return null;
 const r=await loja.getWithMetadata<{tipo:string}>(chave(jobId,file),'arrayBuffer');
 return r.value?{corpo:r.value,tipo:r.metadata?.tipo||'application/octet-stream'}:null;
}

// Copia do motor os arquivos que ainda não estão guardados. Devolve quantos copiou.
export async function guardarMidia(jobId:string,files:string[]){
 const loja=kv();if(!loja)return 0;
 let copiados=0;
 for(const file of new Set(files)){
  if(!NOME.test(file)||await loja.get(chave(jobId,file),'stream').then(s=>{void s?.cancel();return !!s}))continue;
  const r=await engineFetch(`/jobs/${jobId}/assets/${file}`);if(!r.ok)throw new Error(`motor respondeu ${r.status} para ${jobId}/${file}`);
  await loja.put(chave(jobId,file),await r.arrayBuffer(),{metadata:{tipo:r.headers.get('Content-Type')||'application/octet-stream'}});
  copiados++;
 }
 return copiados;
}

// Lote e arquivo tirados do endereço de uma peça: /api/pilot/{run}/assets/{job}/{arquivo}.
export function loteDaUrl(url:string){const [,,,,pasta,jobId,file]=url.split('/');return pasta==='assets'&&jobId&&file?{jobId,file}:null}
export function arquivosDoLote(pieces:{assets:{url:string;poster?:string}[]}[],jobId:string){
 return pieces.flatMap(p=>p.assets.flatMap(a=>[a.url,a.poster])).flatMap(u=>{const l=u?loteDaUrl(u):null;return l?.jobId===jobId?[l.file]:[]});
}
