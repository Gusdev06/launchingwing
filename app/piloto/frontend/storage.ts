import {readWorkspace,clearWorkspace,type WorkspaceData} from './model';
export type Loaded={data:WorkspaceData;revision:number};
export class Conflict extends Error{}
async function fail(response:Response,fallback:string){const body=await response.json().catch(()=>null) as {error?:string}|null;return new Error(body?.error||fallback)}
// Percorre todos os campos que guardam imagem ou vídeo. Qualquer `data:` vira arquivo no servidor antes de salvar.
export async function replaceUrls(data:WorkspaceData,map:(value:string)=>Promise<string>|string):Promise<WorkspaceData>{
 const one=async(value:string|undefined)=>value&&value.startsWith('data:')?await map(value):value;
 return {...data,brand:{...data.brand,logo:(await one(data.brand.logo))||''},media:await Promise.all(data.media.map(async m=>({...m,src:(await one(m.src))||m.src}))),contents:await Promise.all(data.contents.map(async c=>({...c,slides:await Promise.all(c.slides.map(async s=>({...s,image:(await one(s.image))||s.image}))),...(c.video?{video:await one(c.video)}:{}),...(c.poster?{poster:await one(c.poster)}:{})})))};
}
async function upload(chave:string,dataUrl:string){
 const blob=await(await fetch(dataUrl)).blob();
 const response=await fetch(`/api/painel/arquivo?chave=${encodeURIComponent(chave)}`,{method:'POST',headers:{'Content-Type':blob.type||'application/octet-stream','X-Nome':encodeURIComponent('arquivo')},body:blob});
 if(!response.ok)throw await fail(response,'Não foi possível enviar o arquivo.');
 return (await response.json() as {url:string}).url;
}
export async function storeWorkspace(chave:string,data:WorkspaceData,revision:number){
 const replacements=new Map<string,string>();
 const prepared=await replaceUrls(data,async value=>{let url=replacements.get(value);if(!url){url=await upload(chave,value);replacements.set(value,url)}return url});
 const response=await fetch('/api/painel',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({chave,revision,data:prepared})});
 if(response.status===409)throw new Conflict('Este espaço mudou em outra aba. Carregamos a versão mais recente.');
 if(!response.ok)throw await fail(response,'Não foi possível salvar. Suas edições continuam na tela; tente novamente.');
 return {data:prepared,revision:(await response.json() as {revision:number}).revision,replacements};
}
export async function fetchWorkspace(chave:string):Promise<Loaded|null>{
 const response=await fetch(`/api/painel?chave=${encodeURIComponent(chave)}`,{cache:'no-store'});
 if(!response.ok)throw await fail(response,'Não foi possível abrir seu espaço.');
 const {workspace}=await response.json() as {workspace:{data:WorkspaceData;revision:number}|null};
 return workspace?{data:workspace.data,revision:workspace.revision}:null;
}
// Primeira abertura depois desta versão: o rascunho que estava só no navegador sobe uma vez para a conta.
export async function loadWorkspace(localKey:string,chave:string):Promise<Loaded|null>{
 const remote=await fetchWorkspace(chave);if(remote)return remote;
 const local=await readWorkspace(localKey).catch(()=>null);if(!local)return null;
 const stored=await storeWorkspace(chave,local,-1);await clearWorkspace(localKey).catch(()=>{});
 return {data:stored.data,revision:stored.revision};
}
