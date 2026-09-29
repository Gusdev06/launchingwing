import type {Brand,Content} from '@/app/piloto/frontend/model';
import {zip,safeName,type ZipEntry} from './pilot-export.ts';
type AssetReader=(url:string)=>Promise<Response>;
const encoder=new TextEncoder();
// Mídias que podem sair no pacote: biblioteca de exemplo, arquivos da conta e mídias do piloto.
const allowed=[/^\/(workspace|pilot|examples)\/[a-zA-Z0-9/_.-]+\.(mp4|png|jpe?g|webp)$/i,/^\/api\/painel\/arquivo\/[0-9a-f-]{36}$/,/^\/api\/pilot\/[0-9a-f-]{36}\/assets\/[0-9a-f-]{36}\/[a-z0-9_-]+\.(mp4|png|jpe?g|webp)$/];
const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
async function pull(readAsset:AssetReader,url:string,kind:'image'|'video',label:string){
 if(!allowed.some(rx=>rx.test(url)))throw new Error(`${label}: esta mídia não está disponível para exportação.`);
 const response=await readAsset(url);const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()||'';
 if(!response.ok||!type.startsWith(`${kind}/`))throw new Error(`${label}: não foi possível baixar a mídia. Tente novamente.`);
 const data=new Uint8Array(await response.arrayBuffer());if(!data.length)throw new Error(`${label}: um arquivo veio vazio. Tente novamente.`);
 return {data,extension:extensions[type]||url.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g,'')||'bin'};
}
// Pacote para postar à mão: por conteúdo, uma pasta com as fotos numeradas, o vídeo quando houver,
// a legenda e os textos de cada slide (o texto sobre a foto não é gravado na imagem aqui).
export async function createWorkspaceExport(contents:Content[],brand:Brand,readAsset:AssetReader=url=>fetch(url)){
 if(!contents.length)throw new Error('Salve ao menos um conteúdo na galeria antes de baixar.');
 const entries:ZipEntry[]=[],manifest=[];
 for(const [index,content] of contents.entries()){
  const folder=`${String(index+1).padStart(2,'0')}-${safeName(content.title)}`,files:string[]=[];
  if(content.video){const {data,extension}=await pull(readAsset,content.video,'video',content.title);const name=`${folder}/video.${extension}`;entries.push({name,data});files.push(name)}
  else for(const [i,slide] of content.slides.entries()){const {data,extension}=await pull(readAsset,slide.image,'image',`${content.title}, slide ${i+1}`);const name=`${folder}/slide-${String(i+1).padStart(2,'0')}.${extension}`;entries.push({name,data});files.push(name)}
  entries.push({name:`${folder}/legenda.txt`,data:encoder.encode(content.caption)});
  if(!content.video)entries.push({name:`${folder}/textos-dos-slides.txt`,data:encoder.encode(content.slides.map((s,i)=>`Slide ${i+1} (${s.position==='top'?'em cima':s.position==='bottom'?'embaixo':'no meio'}): ${s.text||'(sem texto)'}`).join('\n'))});
  manifest.push({id:content.id,title:content.title,format:content.format,status:content.status,caption:content.caption,files});
 }
 entries.push({name:'LEIA-ME.txt',data:encoder.encode(`LAUNCHWING · ${brand.name}\n${brand.site?`Site: ${brand.site}\n`:''}\nCada pasta é um conteúdo: fotos numeradas na ordem de postagem (ou o vídeo), a legenda em legenda.txt e, nos carrosséis, o texto de cada slide em textos-dos-slides.txt. O texto sobre a foto não vem gravado na imagem: adicione no app em que for postar.\n\nBaixar não publica nada.\n`)});
 entries.push({name:'conteudos.json',data:encoder.encode(JSON.stringify({exportedAt:new Date().toISOString(),brand:brand.name,contents:manifest},null,2))});
 return {blob:zip(entries),fileName:`launchwing-${safeName(brand.name)}-${contents.length===1?safeName(contents[0].title):'conteudos'}.zip`};
}
