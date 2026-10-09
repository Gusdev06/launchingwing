// Exclusão de uma conta inteira (DAD-04, direito de apagar da LGPD): tudo que a pessoa deixou no D1 e as mídias das peças no KV.
// Chamada só pela rota interna app/api/interno/apagar-conta (chave no cabeçalho x-chave). Prova: scripts/login/apagar-conta-smoke.mjs.
import {env} from 'cloudflare:workers';
import {normalizarEmail} from './login-codigo';
import {apagarMidia,loteDaUrl} from './midia';
const db=()=>(env as unknown as {DB:D1Database}).DB;
export const TABELAS=['workspace_file_chunks','workspace_files','art_jobs','workspaces','pilot_runs','sessoes','login_codigos','rate_limits','usuarios'] as const;
export type Apagados=Record<(typeof TABELAS)[number]|'midia',number>;

// Lotes das peças da pessoa: a mídia fica no KV por jobId (lib/midia.ts), lido dos endereços das peças e da geração em curso.
function lotesDosCasos(dados:string[]){
 const jobs=new Set<string>();
 for(const d of dados){
  let run:{pieces?:{assets?:{url?:string;poster?:string}[]}[];generation?:{jobId?:string}};try{run=JSON.parse(d)}catch{continue}
  for(const p of run.pieces??[])for(const a of p.assets??[])for(const u of [a.url,a.poster]){const l=u?loteDaUrl(u):null;if(l)jobs.add(l.jobId)}
  if(run.generation?.jobId)jobs.add(run.generation.jobId);
 }
 return jobs;
}

// Devolve null se o e-mail não tem conta. As mídias saem antes das linhas: se o lote falhar no meio, os jobIds continuam no banco para tentar de novo.
export async function apagarConta(emailBruto:string):Promise<Apagados|null>{
 const email=normalizarEmail(emailBruto);
 const dono=await db().prepare('SELECT id FROM usuarios WHERE email=?').bind(email).first<{id:string}>();if(!dono)return null;
 const casos=await db().prepare('SELECT data FROM pilot_runs WHERE owner_id=?').bind(dono.id).all<{data:string}>();
 let midia=0;for(const job of lotesDosCasos(casos.results.map(r=>r.data)))midia+=await apagarMidia(job);
 const sqls:Record<(typeof TABELAS)[number],string>={
  workspace_file_chunks:'DELETE FROM workspace_file_chunks WHERE file_id IN (SELECT id FROM workspace_files WHERE owner_id=?)',
  workspace_files:'DELETE FROM workspace_files WHERE owner_id=?',
  art_jobs:'DELETE FROM art_jobs WHERE owner_id=?',
  workspaces:'DELETE FROM workspaces WHERE owner_id=?',
  pilot_runs:'DELETE FROM pilot_runs WHERE owner_id=?',
  sessoes:'DELETE FROM sessoes WHERE user_id=?',
  login_codigos:'DELETE FROM login_codigos WHERE email=?',
  // Limites de taxa com o e-mail ou o id da pessoa na chave (app/api/entrar/codigo, app/api/painel, app/api/painel/arquivo). Os por IP saem na rotina.
  rate_limits:"DELETE FROM rate_limits WHERE key IN ('entrar-email:'||?2,'painel:'||?1,'arquivo:'||?1)",
  usuarios:'DELETE FROM usuarios WHERE id=?',
 };
 const resultados=await db().batch(TABELAS.map(t=>t==='rate_limits'?db().prepare(sqls[t]).bind(dono.id,email):db().prepare(sqls[t]).bind(t==='login_codigos'?email:dono.id)));
 const apagados={midia} as Apagados;
 TABELAS.forEach((t,i)=>{apagados[t]=resultados[i].meta.changes});
 return apagados;
}
