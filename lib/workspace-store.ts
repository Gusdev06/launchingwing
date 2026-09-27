import {env} from 'cloudflare:workers';
import type {WorkspaceData} from '@/app/piloto/frontend/model';
import {CHUNK_BYTES} from './workspace-model';
export type StoredWorkspace={data:WorkspaceData;revision:number;updatedAt:string};
export type StoredFile={id:string;name:string;mime:string;size:number;chunks:number};
type Row={data:string;revision:number;updated_at:string};
function db(){const database=(env as unknown as {DB?:D1Database}).DB;if(!database)throw new Error('Workspace database unavailable');return database}
export async function findWorkspace(owner:string,key:string):Promise<StoredWorkspace|null>{
 const row=await db().prepare('SELECT data,revision,updated_at FROM workspaces WHERE owner_id=? AND key=?').bind(owner,key).first<Row>();
 return row?{data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:null;
}
// revision -1 cria; qualquer outro valor só grava se a linha ainda estiver naquela revisão.
export async function saveWorkspace(owner:string,key:string,revision:number,data:WorkspaceData):Promise<number|null>{
 const now=new Date().toISOString(),json=JSON.stringify(data);
 if(revision<0){
  const result=await db().prepare('INSERT INTO workspaces (owner_id,key,data,revision,created_at,updated_at) VALUES (?,?,?,0,?,?) ON CONFLICT(owner_id,key) DO NOTHING').bind(owner,key,json,now,now).run();
  return result.meta.changes===1?0:null;
 }
 const result=await db().prepare('UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE owner_id=? AND key=? AND revision=?').bind(json,now,owner,key,revision).run();
 return result.meta.changes===1?revision+1:null;
}
export async function deleteWorkspace(owner:string,key:string){
 const files=await db().prepare('SELECT id FROM workspace_files WHERE owner_id=? AND workspace_key=?').bind(owner,key).all<{id:string}>();
 const statements=files.results.flatMap(f=>[db().prepare('DELETE FROM workspace_file_chunks WHERE file_id=?').bind(f.id),db().prepare('DELETE FROM workspace_files WHERE id=? AND owner_id=?').bind(f.id,owner)]);
 statements.push(db().prepare('DELETE FROM workspaces WHERE owner_id=? AND key=?').bind(owner,key));
 await db().batch(statements);
}
export async function createFile(owner:string,key:string,name:string,mime:string,bytes:Uint8Array):Promise<StoredFile>{
 const id=crypto.randomUUID(),chunks=Math.max(1,Math.ceil(bytes.byteLength/CHUNK_BYTES)),now=new Date().toISOString();
 const statements=[db().prepare('INSERT INTO workspace_files (id,owner_id,workspace_key,name,mime,size,chunks,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,owner,key,name,mime,bytes.byteLength,chunks,now)];
 for(let seq=0;seq<chunks;seq++){const part=bytes.slice(seq*CHUNK_BYTES,(seq+1)*CHUNK_BYTES);statements.push(db().prepare('INSERT INTO workspace_file_chunks (file_id,seq,bytes) VALUES (?,?,?)').bind(id,seq,part.buffer.slice(part.byteOffset,part.byteOffset+part.byteLength)))}
 await db().batch(statements);
 return {id,name,mime,size:bytes.byteLength,chunks};
}
export async function findFile(owner:string,id:string):Promise<StoredFile|null>{
 return db().prepare('SELECT id,name,mime,size,chunks FROM workspace_files WHERE owner_id=? AND id=?').bind(owner,id).first<StoredFile>();
}
export async function readChunk(id:string,seq:number):Promise<ArrayBuffer|null>{
 const row=await db().prepare('SELECT bytes FROM workspace_file_chunks WHERE file_id=? AND seq=?').bind(id,seq).first<{bytes:ArrayBuffer}>();return row?row.bytes:null;
}
