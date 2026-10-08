import {z} from 'zod';
import type {WorkspaceData} from '@/app/piloto/frontend/model';
// Limites do D1: 2.000.000 bytes por linha. O documento fica abaixo de 900 KB porque nenhuma
// imagem entra nele: todo `data:` vira arquivo em workspace_files antes de gravar.
export const MAX_DOC_BYTES=900_000,MAX_FILE_BYTES=20*1024*1024,CHUNK_BYTES=900_000;
// Cota por conta (saúde P1, 08/10): 10 chaves de espaço e 200 MB de arquivos. Conta é grátis; o banco é um só para todos.
export const COTA_CHAVES=10,COTA_BYTES=200*1024*1024;
export const keySchema=z.string().regex(/^[a-z0-9-]{1,60}$/,'Chave do espaço inválida.');
const short=z.string().max(300),long=z.string().max(5000),url=z.string().max(2000).refine(v=>!v.startsWith('data:'),'Imagem ainda não enviada.');
const format=z.enum(['meme','educativo','amiga']),platform=z.enum(['TikTok','Instagram']);
const slide=z.object({id:short,image:url,text:z.string().max(1000),position:z.enum(['top','center','bottom']),size:z.number().min(1).max(200)});
const content=z.object({id:short,title:z.string().max(500),format,caption:z.string().max(2200),slides:z.array(slide).max(12),video:url.optional(),poster:url.optional(),origin:z.enum(['example','pilot','local']),status:z.enum(['draft','saved','discarded']),createdAt:short,sourceId:short.optional(),reference:long.optional()});
const media=z.object({id:short,name:short,src:url,kind:z.enum(['image','video']),collection:short,origin:short});
const plan=z.object({id:short,contentId:short,platform,date:short,time:short,timezone:short,note:z.string().max(1000)});
const campaign=z.object({id:short,name:short,objective:z.string().max(1000),formats:z.array(format).max(3),days:z.array(z.number().int().min(0).max(6)).max(7),perDay:z.number().int().min(1).max(20),weeks:z.number().int().min(1).max(52),start:short,platform,source:z.enum(['mix','own','pinterest']),status:z.enum(['draft','paused'])});
const brand=z.object({name:short,site:z.string().max(2000),description:long,audience:long,problem:long,benefit:long,tone:long,angles:z.array(short).max(30),avoid:long,mention:short,color:short,logo:url});
export const workspaceSchema:z.ZodType<WorkspaceData>=z.object({version:z.literal(1),brand,brandEdited:z.boolean().optional(),contents:z.array(content).max(500),media:z.array(media).max(1000),plans:z.array(plan).max(1000),campaigns:z.array(campaign).max(100),favorites:z.array(short).max(1000),collections:z.array(short).max(100),preferences:z.object({language:short,timezone:short,readyAlerts:z.boolean(),failureAlerts:z.boolean(),weeklyAlerts:z.boolean()})});
export const saveSchema=z.object({chave:keySchema,revision:z.number().int().min(-1),data:workspaceSchema});
export const fileMimes=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']);
// Confere os primeiros bytes do arquivo contra o tipo declarado pelo navegador, que o usuário pode forjar.
function startsWith(bytes:Uint8Array,sig:number[],at=0){return sig.every((b,i)=>bytes[at+i]===b)}
const ascii=(text:string)=>[...text].map(c=>c.charCodeAt(0));
export function contentMatchesMime(bytes:Uint8Array,mime:string){
 switch(mime){
  case 'image/png':return startsWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  case 'image/jpeg':return startsWith(bytes,[0xff,0xd8,0xff]);
  case 'image/gif':return startsWith(bytes,ascii('GIF87a'))||startsWith(bytes,ascii('GIF89a'));
  case 'image/webp':return startsWith(bytes,ascii('RIFF'))&&startsWith(bytes,ascii('WEBP'),8);
  case 'video/mp4':return startsWith(bytes,ascii('ftyp'),4);
  case 'video/webm':return startsWith(bytes,[0x1a,0x45,0xdf,0xa3]);
  default:return false;
 }
}
