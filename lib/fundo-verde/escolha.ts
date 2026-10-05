import jpeg from 'jpeg-js';
import type {Candidato} from './fonte';
// Mede o verde de chroma nos quadros de prévia que as fontes já entregam (o Worker não roda ffmpeg).
// Mede a moldura (15% de cada borda), que num fundo verde de verdade é quase toda verde, e o peito da pessoa (faixa estreita no centro).
// Peito com verde quer dizer roupa verde: a pessoa sumiria junto com o fundo.
export const DURACAO_MIN=2,DURACAO_MAX=30,VERDE_MIN=0.6,MEIO_MAX=0.2,QUADROS=3;
export type Avaliado=Candidato&{verde:number;aprovado:boolean;motivo:string|null};
const ehVerde=(r:number,g:number,b:number)=>g>90&&g>r*1.4&&g>b*1.4;
export function medirQuadro(bytes:Uint8Array){
 const {width:w,height:h,data}=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:20,maxMemoryUsageInMB:256});
 const bx=Math.floor(w*0.15),by=Math.floor(h*0.15),passo=Math.max(1,Math.floor(Math.min(w,h)/60));let total=0,verdes=0,meio=0,meioVerde=0;
 for(let y=0;y<h;y+=passo)for(let x=0;x<w;x+=passo){const i=(y*w+x)*4,verde=ehVerde(data[i],data[i+1],data[i+2]);if(x>=bx&&x<w-bx&&y>=by&&y<h-by){if(x>w*0.44&&x<w*0.56&&y>h*0.5&&y<h*0.7){meio++;if(verde)meioVerde++}continue}total++;if(verde)verdes++}
 return {moldura:total?verdes/total:0,meio:meio?meioVerde/meio:1};
}
async function medir(c:Candidato){
 const urls=c.quadros.length<=QUADROS?c.quadros:[0,Math.floor(c.quadros.length/2),c.quadros.length-1].map(i=>c.quadros[i]);
 const notas=await Promise.all(urls.map(async u=>{try{const r=await fetch(u,{signal:AbortSignal.timeout(10000)});if(!r.ok)return null;return medirQuadro(new Uint8Array(await r.arrayBuffer()))}catch{return null}}));
 const validas=notas.filter(n=>n!==null);
 // Nota do vídeo é a do pior quadro: um quadro sem verde já basta para descartar.
 return validas.length?{moldura:Math.min(...validas.map(n=>n.moldura)),meio:Math.max(...validas.map(n=>n.meio))}:{moldura:0,meio:1};
}
export async function avaliar(candidatos:Candidato[]):Promise<Avaliado[]>{
 return Promise.all(candidatos.map(async (c):Promise<Avaliado>=>{
  if(c.duracao>DURACAO_MAX)return {...c,verde:0,aprovado:false,motivo:`Vídeo longo demais (${c.duracao} s, máximo ${DURACAO_MAX} s).`};
  if(c.duracao<DURACAO_MIN)return {...c,verde:0,aprovado:false,motivo:`Vídeo curto demais (${c.duracao} s).`};
  if(!c.quadros.length)return {...c,verde:0,aprovado:false,motivo:'Sem quadro de prévia para medir o verde.'};
  const m=await medir(c),verde=Math.round(m.moldura*100)/100;
  if(verde>=VERDE_MIN&&m.meio>MEIO_MAX)return {...c,verde,aprovado:false,motivo:'O meio do quadro também é verde (roupa verde): a pessoa sumiria com o fundo.'};
  return verde>=VERDE_MIN?{...c,verde,aprovado:true,motivo:null}:{...c,verde,aprovado:false,motivo:`Pouco fundo verde (${Math.round(verde*100)}% da borda).`};
 }));
}
// Melhor candidato: mais verde na borda; empate fica com o mais curto.
export function escolher(avaliados:Avaliado[]){return avaliados.filter(a=>a.aprovado).sort((a,b)=>b.verde-a.verde||a.duracao-b.duracao)[0]??null}
