import {env} from 'cloudflare:workers';
import {pedirFonte,noFormato,type Fonte,type Candidato} from './fonte';
// API oficial de vídeo da Pexels: https://www.pexels.com/api/documentation/ (200 buscas por hora, 20.000 por mês).
type Video={id:number;width:number;height:number;duration:number;url:string;user:{name:string;url:string};video_files:{link:string;quality:string|null;file_type:string;width:number;height:number}[];video_pictures:{picture:string}[]};
export const pexels:Fonte={nome:'pexels',async buscar({termo,formato,idioma}){
 const e=env as unknown as {PEXELS_API_KEY?:string;PEXELS_BASE_URL?:string};if(!e.PEXELS_API_KEY)return [];
 const base=(e.PEXELS_BASE_URL||'https://api.pexels.com').replace(/\/$/,'');
 const params=new URLSearchParams({query:termo,orientation:formato==='vertical'?'portrait':'landscape',per_page:'15',locale:idioma==='pt'?'pt-BR':'en-US'});
 const body=await pedirFonte('Pexels',`${base}/videos/search?${params}`,{headers:{authorization:e.PEXELS_API_KEY}}) as {videos?:Video[]};
 return (body.videos??[]).flatMap((v):Candidato[]=>{
  // Arquivo MP4 do tamanho certo: o menor com lado curto de pelo menos 720, senão o maior disponível.
  const mp4=v.video_files.filter(f=>f.file_type==='video/mp4'&&f.width&&f.height&&noFormato(formato,f.width,f.height)).sort((a,b)=>Math.min(a.width,a.height)-Math.min(b.width,b.height));
  const arquivo=mp4.find(f=>Math.min(f.width,f.height)>=720)??mp4.at(-1);if(!arquivo)return [];
  return [{fonte:'pexels',fonteId:String(v.id),autor:v.user.name,autorUrl:v.user.url,pagina:v.url,licenca:'Pexels License (https://www.pexels.com/license/)',largura:arquivo.width,altura:arquivo.height,duracao:v.duration,arquivoUrl:arquivo.link,quadros:v.video_pictures.map(p=>p.picture).slice(0,6)}];
 });
}};
