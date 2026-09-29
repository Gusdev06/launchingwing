import {env} from 'cloudflare:workers';
import {pedirFonte,noFormato,type Fonte,type Candidato} from './fonte';
// API oficial de vídeo da Pixabay: https://pixabay.com/api/docs/ (100 buscas por minuto, cache de 24 h obrigatório, sem download em massa).
type Arquivo={url:string;width:number;height:number;size:number;thumbnail:string};
type Hit={id:number;pageURL:string;duration:number;user:string;user_id:number;videos:Partial<Record<'large'|'medium'|'small'|'tiny',Arquivo>>};
export const pixabay:Fonte={nome:'pixabay',async buscar({termo,formato,idioma}){
 const e=env as unknown as {PIXABAY_API_KEY?:string;PIXABAY_BASE_URL?:string};if(!e.PIXABAY_API_KEY)return [];
 const base=(e.PIXABAY_BASE_URL||'https://pixabay.com/api').replace(/\/$/,'');
 const params=new URLSearchParams({key:e.PIXABAY_API_KEY,q:termo.slice(0,100),lang:idioma,video_type:'film',safesearch:'true',per_page:'20'});
 const body=await pedirFonte('Pixabay',`${base}/videos/?${params}`) as {hits?:Hit[]};
 return (body.hits??[]).flatMap((h):Candidato[]=>{
  const arquivo=h.videos.medium??h.videos.small??h.videos.large;if(!arquivo?.url||!noFormato(formato,arquivo.width,arquivo.height))return [];
  return [{fonte:'pixabay',fonteId:String(h.id),autor:h.user,autorUrl:`https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/`,pagina:h.pageURL,licenca:'Pixabay Content License (https://pixabay.com/service/license-summary/)',largura:arquivo.width,altura:arquivo.height,duracao:h.duration,arquivoUrl:arquivo.url,quadros:[h.videos.tiny?.thumbnail||arquivo.thumbnail].filter(Boolean)}];
 });
}};
