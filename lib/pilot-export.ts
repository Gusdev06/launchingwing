import type {PilotRun} from './pilot-model';

export type ZipEntry = {name:string;data:Uint8Array<ArrayBuffer>};
type AssetReader = (url:string)=>Promise<Response>;
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,index)=>{
 let value=index;
 for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
 return value>>>0;
});
function crc32(data:Uint8Array){
 let crc=0xffffffff;
 for(const byte of data)crc=(crc>>>8)^crcTable[(crc^byte)&255];
 return (crc^0xffffffff)>>>0;
}
export function safeName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'peca'}

// Stored ZIP: PNGs and MP4s are already compressed. UTF-8 names and CRCs keep
// the download readable by standard archive tools without another dependency.
export function zip(entries:ZipEntry[]){
 const files:BlobPart[]=[],directory:BlobPart[]=[];
 let offset=0,directorySize=0;
 for(const entry of entries){
  const name=encoder.encode(entry.name),size=entry.data.length,crc=crc32(entry.data);
  const local=new ArrayBuffer(30),header=new DataView(local);
  header.setUint32(0,0x04034b50,true);header.setUint16(4,20,true);header.setUint16(6,0x0800,true);
  header.setUint16(12,33,true);header.setUint32(14,crc,true);header.setUint32(18,size,true);header.setUint32(22,size,true);header.setUint16(26,name.length,true);
  files.push(local,name,entry.data);
  const central=new ArrayBuffer(46),record=new DataView(central);
  record.setUint32(0,0x02014b50,true);record.setUint16(4,20,true);record.setUint16(6,20,true);record.setUint16(8,0x0800,true);
  record.setUint16(14,33,true);record.setUint32(16,crc,true);record.setUint32(20,size,true);record.setUint32(24,size,true);record.setUint16(28,name.length,true);record.setUint32(42,offset,true);
  directory.push(central,name);directorySize+=46+name.length;offset+=30+name.length+size;
 }
 const end=new ArrayBuffer(22),record=new DataView(end);
 record.setUint32(0,0x06054b50,true);record.setUint16(8,entries.length,true);record.setUint16(10,entries.length,true);record.setUint32(12,directorySize,true);record.setUint32(16,offset,true);
 return new Blob([...files,...directory,end],{type:'application/zip'});
}

export async function createPilotExport(run:PilotRun,pieceId?:string,readAsset:AssetReader=url=>fetch(url)){
 const pieces=pieceId?run.pieces.filter(piece=>piece.id===pieceId):run.pieces.filter(piece=>piece.status==='approved');
 if(!pieces.length)throw new Error(pieceId?'Peça não encontrada.':'Aprove ao menos uma peça antes de exportar.');
 const entries:ZipEntry[]=[],manifest=[];
 for(const [index,piece] of pieces.entries()){
  const folder=`${String(index+1).padStart(2,'0')}-${safeName(piece.id)}`,assets=[];
  for(const [slide,asset] of piece.assets.entries()){
   // Both demo files and owner-authenticated generated media are exportable.
   if(!/^\/pilot\/[a-zA-Z0-9/_-]+\.(mp4|png|jpe?g|webp)$/i.test(asset.url)&&!/^\/api\/pilot\/[0-9a-f-]{36}\/assets\/[0-9a-f-]{36}\/[a-z0-9_-]+\.(mp4|png|jpe?g|webp)$/.test(asset.url))throw new Error('Esta mídia não está disponível para exportação.');
   const response=await readAsset(asset.url);
   if(!response.ok||!response.headers.get('content-type')?.startsWith(`${asset.kind}/`))throw new Error(`Não foi possível baixar ${piece.hook}, arquivo ${slide+1}. Tente novamente.`);
   const data=new Uint8Array(await response.arrayBuffer());
   if(!data.length)throw new Error('Um arquivo veio vazio. Tente baixar novamente.');
   const extension=asset.url.split('.').pop()!.toLowerCase();
   const name=`${folder}/${asset.kind==='video'?'video':'slide'}-${String(slide+1).padStart(2,'0')}.${extension}`;
   entries.push({name,data});assets.push({file:name,alt:asset.alt});
  }
  entries.push({name:`${folder}/legenda.txt`,data:encoder.encode(piece.caption)});
  entries.push({name:`${folder}/sobre-a-peca.txt`,data:encoder.encode(`${piece.hook}\nFormato: ${piece.format}\n\n${piece.rationale}\n\nOrigem: ${piece.provenance}\n`)});
  manifest.push({id:piece.id,format:piece.format,hook:piece.hook,status:piece.status,caption:piece.caption,assets,provenance:piece.provenance});
 }
 entries.push({name:'LEIA-ME.txt',data:encoder.encode(`LAUNCHWING: ${run.context.name}\nProduto: ${run.url}\n\n${pieceId?'Peça individual; confira sua decisão de revisão.':'Este pacote contém apenas as peças aprovadas nesta revisão.'}\nAs legendas são as versões salvas no caso. Os slides estão numerados na ordem de postagem.\n\nA origem das mídias está em sobre-a-peca.txt. Baixar ou aprovar não publica o conteúdo.\n`)});
 entries.push({name:'revisao.json',data:encoder.encode(JSON.stringify({runId:run.id,revision:run.revision,exportedAt:new Date().toISOString(),pieces:manifest},null,2))});
 return {blob:zip(entries),fileName:`launchwing-${safeName(run.context.name)}-${run.id}-${pieceId?safeName(pieceId):'aprovadas'}.zip`};
}

export function downloadPilotExport({blob,fileName}:{blob:Blob;fileName:string}){
 const href=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=href;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(href),60_000);
}
