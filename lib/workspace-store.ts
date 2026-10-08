import {env} from 'cloudflare:workers';
import type {WorkspaceData} from '@/app/piloto/frontend/model';
import {CHUNK_BYTES,COTA_BYTES,COTA_BYTES_SISTEMA,COTA_CHAVES} from './workspace-model';
export type StoredWorkspace={data:WorkspaceData;revision:number;updatedAt:string};
export type StoredFile={id:string;name:string;mime:string;size:number;chunks:number};
type Row={data:string;revision:number;updated_at:string};
function db(){const database=(env as unknown as {DB?:D1Database}).DB;if(!database)throw new Error('Workspace database unavailable');return database}
// A conta passou da cota: as rotas respondem 413 com a mensagem.
export class CotaExcedida extends Error{}
// Cotas de bytes: a variável de ambiente só existe nas provas (scripts/pilot/cota-concorrente-smoke.mjs); no ar valem as constantes.
const cota=(nome:'COTA_BYTES_CONTA'|'COTA_BYTES_SISTEMA',padrao:number)=>{const n=Number((env as unknown as Record<string,string|undefined>)[nome]);return n>0?n:padrao};
// Bytes de arquivo que o sistema inteiro já ocupa. Só escolhe a mensagem: a cota de verdade é conferida dentro do INSERT, em createFile.
async function bytesDoSistema(){
 const r=await db().prepare('SELECT COALESCE(SUM(size),0) AS bytes FROM workspace_files').first<{bytes:number}>();
 return r?.bytes??0;
}
export async function findWorkspace(owner:string,key:string):Promise<StoredWorkspace|null>{
 const row=await db().prepare('SELECT data,revision,updated_at FROM workspaces WHERE owner_id=? AND key=?').bind(owner,key).first<Row>();
 return row?{data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:null;
}
// revision -1 cria; qualquer outro valor só grava se a linha ainda estiver naquela revisão.
export async function saveWorkspace(owner:string,key:string,revision:number,data:WorkspaceData):Promise<number|null>{
 const now=new Date().toISOString(),json=JSON.stringify(data);
 if(revision<0){
  // A cota de chaves vai na mesma instrução que grava: dois pedidos ao mesmo tempo não criam a 11ª. Nada gravado: chave já existe (409) ou conta cheia (413).
  const result=await db().prepare('INSERT INTO workspaces (owner_id,key,data,revision,created_at,updated_at) SELECT ?,?,?,0,?,? WHERE (SELECT COUNT(*) FROM workspaces WHERE owner_id=?)<? ON CONFLICT(owner_id,key) DO NOTHING').bind(owner,key,json,now,now,owner,COTA_CHAVES).run();
  if(result.meta.changes===1)return 0;
  if(await findWorkspace(owner,key))return null;
  throw new CotaExcedida(`Sua conta já tem ${COTA_CHAVES} espaços. Apague um para criar outro.`);
 }
 const result=await db().prepare('UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE owner_id=? AND key=? AND revision=?').bind(json,now,owner,key,revision).run();
 return result.meta.changes===1?revision+1:null;
}
export async function deleteWorkspace(owner:string,key:string){
 const files=await db().prepare('SELECT id FROM workspace_files WHERE owner_id=? AND workspace_key=?').bind(owner,key).all<{id:string}>();
 const statements=files.results.flatMap(f=>[db().prepare('DELETE FROM workspace_file_chunks WHERE file_id=?').bind(f.id),db().prepare('DELETE FROM workspace_files WHERE id=? AND owner_id=?').bind(f.id,owner)]);
 statements.push(db().prepare('DELETE FROM art_jobs WHERE owner_id=? AND workspace_key=?').bind(owner,key),db().prepare('DELETE FROM workspaces WHERE owner_id=? AND key=?').bind(owner,key));
 await db().batch(statements);
}
export async function createFile(owner:string,key:string,name:string,mime:string,bytes:Uint8Array):Promise<StoredFile>{
 const id=crypto.randomUUID(),chunks=Math.max(1,Math.ceil(bytes.byteLength/CHUNK_BYTES)),now=new Date().toISOString(),cotaConta=cota('COTA_BYTES_CONTA',COTA_BYTES),cotaSistema=cota('COTA_BYTES_SISTEMA',COTA_BYTES_SISTEMA);
 // As duas somas (a conta e o sistema inteiro) vão na mesma instrução que grava a linha do arquivo: envios ao mesmo tempo não passam juntos da cota.
 // Os pedaços só entram se a linha entrou, e o batch é uma transação: nada fica pela metade.
 const statements=[db().prepare('INSERT INTO workspace_files (id,owner_id,workspace_key,name,mime,size,chunks,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM workspace_files WHERE owner_id=?)+?<=? AND (SELECT COALESCE(SUM(size),0) FROM workspace_files)+?<=?').bind(id,owner,key,name,mime,bytes.byteLength,chunks,now,owner,bytes.byteLength,cotaConta,bytes.byteLength,cotaSistema)];
 for(let seq=0;seq<chunks;seq++){const part=bytes.slice(seq*CHUNK_BYTES,(seq+1)*CHUNK_BYTES);statements.push(db().prepare('INSERT INTO workspace_file_chunks (file_id,seq,bytes) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM workspace_files WHERE id=?)').bind(id,seq,part.buffer.slice(part.byteOffset,part.byteOffset+part.byteLength),id))}
 const [linha]=await db().batch(statements);
 if(linha.meta.changes!==1){
  if(await bytesDoSistema()+bytes.byteLength>cotaSistema)throw new CotaExcedida('O site está sem espaço para novos arquivos agora. Tente mais tarde.');
  throw new CotaExcedida(`Sua conta chegou a ${Math.round(cotaConta/1024/1024)} MB de arquivos. Apague arquivos antes de enviar outro.`);
 }
 return {id,name,mime,size:bytes.byteLength,chunks};
}
export async function findFile(owner:string,id:string):Promise<StoredFile|null>{
 return db().prepare('SELECT id,name,mime,size,chunks FROM workspace_files WHERE owner_id=? AND id=?').bind(owner,id).first<StoredFile>();
}
export async function readChunk(id:string,seq:number):Promise<ArrayBuffer|null>{
 const row=await db().prepare('SELECT bytes FROM workspace_file_chunks WHERE file_id=? AND seq=?').bind(id,seq).first<{bytes:ArrayBuffer}>();return row?row.bytes:null;
}
export async function readFileBytes(owner:string,id:string):Promise<{mime:string;bytes:Uint8Array}|null>{
 const file=await findFile(owner,id);if(!file)return null;
 const out=new Uint8Array(file.size);let offset=0;
 for(let seq=0;seq<file.chunks;seq++){const chunk=await readChunk(id,seq);if(!chunk)return null;out.set(new Uint8Array(chunk),offset);offset+=chunk.byteLength}
 return {mime:file.mime,bytes:out};
}
