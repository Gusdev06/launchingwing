import {env} from 'cloudflare:workers';
import type {PilotData,PilotRun} from './pilot-model';
type Row={id:string;data:string;revision:number;created_at:string;updated_at:string};
function db(){const database=(env as unknown as {DB?:D1Database}).DB;if(!database)throw new Error('Pilot database unavailable');return database}
function decode(row:Row):PilotRun{return {...JSON.parse(row.data),id:row.id,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at}}
export async function listRuns(owner:string){
 const result=await db().prepare('SELECT id,data,revision,created_at,updated_at FROM pilot_runs WHERE owner_id=? ORDER BY created_at DESC LIMIT 30').bind(owner).all<Row>();
 return result.results.map(decode);
}
export async function findRun(owner:string,id:string){
 const row=await db().prepare('SELECT id,data,revision,created_at,updated_at FROM pilot_runs WHERE owner_id=? AND id=?').bind(owner,id).first<Row>();return row?decode(row):null;
}
export async function createRun(owner:string,data:PilotData){
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await db().prepare('INSERT INTO pilot_runs (id,owner_id,data,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(id,owner,JSON.stringify(data),now,now).run();
 return {...data,id,revision:0,createdAt:now,updatedAt:now};
}
export async function saveRun(owner:string,id:string,revision:number,data:PilotData){
 const now=new Date().toISOString();
 const result=await db().prepare('UPDATE pilot_runs SET data=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?').bind(JSON.stringify(data),now,id,owner,revision).run();
 return result.meta.changes===1;
}
// Casos com o motor (mode api) criados pela conta nas últimas 24 horas, para o limite por conta.
export async function casosNasUltimas24h(owner:string){
 const desde=new Date(Date.now()-86400000).toISOString();
 const r=await db().prepare("SELECT COUNT(*) AS n FROM pilot_runs WHERE owner_id=? AND created_at>? AND json_extract(data,'$.mode')='api'").bind(owner,desde).first<{n:number}>();
 return r?.n??0;
}
