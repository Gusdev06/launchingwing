"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Sparkles} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Action} from './ui';
type Job={id:string;status:'na_fila'|'gerando'|'pronto'|'erro';url:string|null;error:string|null};
const tamanhos=[['1:1','Quadrado 1:1'],['9:16','Vertical 9:16'],['4:5','Retrato 4:5'],['16:9','Paisagem 16:9']] as const;
const legenda:Record<Job['status'],string>={na_fila:'Na fila. Se o servidor estava parado, o primeiro pedido leva 1 a 4 minutos.',gerando:'Gerando…',pronto:'Pronto.',erro:'Não deu certo.'};
const tamanhosVideo=[['16:9','Paisagem 16:9'],['9:16','Vertical 9:16'],['1:1','Quadrado 1:1']] as const;
export type Tipo='imagem'|'video';
function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){return <label className="fw-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
// Foto da biblioteca pública do site vira arquivo da conta antes de servir de ponto de partida.
async function garantirNaConta(chave:string,src:string){
 if(src.startsWith('/api/painel/arquivo/'))return src;
 const blob=await(await fetch(src)).blob();
 const response=await fetch(`/api/painel/arquivo?chave=${encodeURIComponent(chave)}`,{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg','X-Nome':encodeURIComponent(src.split('/').pop()||'foto')},body:blob});
 return (await json<{url:string}>(response)).url;
}
async function json<T>(response:Response):Promise<T>{const body=await response.json().catch(()=>null) as (T&{error?:string})|null;if(!response.ok||!body)throw new Error(body?.error||'Não foi possível falar com o servidor.');return body}
// Gera uma imagem por IA (RunPod, conta do Gustavo) e devolve a URL do arquivo salvo na conta.
export type Fonte={name:string;src:string};
export function ArtDialog({open,onOpenChange,chave,initialPrompt,onUse,sourceImage,library=[],tipo='imagem'}:{open:boolean;onOpenChange:(v:boolean)=>void;chave:string;initialPrompt:string;onUse:(url:string,prompt:string)=>void;sourceImage?:string;library?:Fonte[];tipo?:Tipo}){
 return <Dialog open={open} onOpenChange={onOpenChange}>{open&&<ArtForm key={initialPrompt} chave={chave} initialPrompt={initialPrompt} onUse={onUse} close={()=>onOpenChange(false)} sourceImage={sourceImage} library={library} tipo={tipo}/>}</Dialog>;
}
const usable=(src:string)=>src.startsWith('/')&&!src.startsWith('//');
function ArtForm({chave,initialPrompt,onUse,close,sourceImage,library,tipo}:{chave:string;initialPrompt:string;onUse:(url:string,prompt:string)=>void;close:()=>void;sourceImage?:string;library:Fonte[];tipo:Tipo}){
 const video=tipo==='video';
 const fontes:Fonte[]=[...(sourceImage&&usable(sourceImage)?[{name:'Foto atual do slide',src:sourceImage}]:[]),...library.filter(f=>usable(f.src)&&f.src!==sourceImage)];
 const [origem,setOrigem]=useState(''),[forca,setForca]=useState(65),[duracao,setDuracao]=useState(5),[prompt,setPrompt]=useState(initialPrompt),[tamanho,setTamanho]=useState<typeof tamanhos[number][0]>(video?'9:16':'1:1'),[job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[connected,setConnected]=useState<boolean|null>(null),[saldoBaixo,setSaldoBaixo]=useState(false),[busy,setBusy]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{let live=true;fetch('/api/painel/arte').then(r=>json<{conectado:boolean;video:boolean;saldoBaixo:boolean|null}>(r)).then(i=>{if(live){setConnected(video?i.video:i.conectado);setSaldoBaixo(i.saldoBaixo===true)}}).catch(()=>{if(live)setConnected(false)});return()=>{live=false}},[]);
 useEffect(()=>{if(!job||job.status==='pronto'||job.status==='erro')return;timer.current=setTimeout(()=>{fetch(`/api/painel/arte/${job.id}`).then(r=>json<{job:Job}>(r)).then(({job})=>setJob(job)).catch(e=>{setError(e instanceof Error?e.message:'Falha ao consultar.');setJob(j=>j?{...j,status:'erro'}:j)})},3000);return()=>{if(timer.current)clearTimeout(timer.current)}},[job]);
 async function generate(){if(busy)return;setBusy(true);setError('');setJob(null);try{const imagemUrl=origem?await garantirNaConta(chave,origem):'';const {job}=await json<{job:Job}>(await fetch('/api/painel/arte',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chave,tipo,prompt,tamanho,...(video?{duracaoS:duracao}:{}),...(imagemUrl?{imagemUrl,forca:forca/100}:{})})}));setJob({...job,url:null,error:null})}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar.')}finally{setBusy(false)}}
 const working=!!job&&(job.status==='na_fila'||job.status==='gerando');
 return <DialogContent className="fw-dialog fw-wide-dialog" onInteractOutside={e=>{if(working)e.preventDefault()}}><DialogTitle>{video?'Criar vídeo com IA':'Criar imagem com IA'}</DialogTitle><DialogDescription>{video?'Descreva a cena e o som. O vídeo com áudio entra na sua galeria e vira o vídeo deste conteúdo. Leva de 1 a 4 minutos.':'Descreva a cena. A imagem entra na sua galeria e substitui a foto deste slide.'}</DialogDescription>
  {connected===false&&<p className="fw-alert" role="alert">{video?'A geração de vídeo ainda não está conectada nesta conta.':'A geração de imagem ainda não está conectada nesta conta.'}</p>}
  {saldoBaixo&&<p className="fw-alert" role="alert">O crédito do servidor de geração está acabando. Avise o administrador antes de gerar muitas peças.</p>}
  <Field label={video?'O que acontece no vídeo':'O que aparece na imagem'} hint={video?'Escreva em inglês para o vídeo. Diga cena, movimento de câmera e o som (fala, ambiente, música).':'Em português ou inglês. Diga cenário, luz e o que está acontecendo.'}><textarea rows={4} maxLength={1500} value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={working}/></Field>
  {fontes.length>0&&<Field label={video?'Primeiro quadro':'Ponto de partida'} hint={video?(origem?'O vídeo começa nesta foto.':'Sem foto, o vídeo nasce só da descrição.'):(origem?'A foto é redimensionada para o formato escolhido e serve de base.':'Sem foto, a imagem nasce só da descrição.')}><select value={origem} onChange={e=>setOrigem(e.target.value)} disabled={working}><option value="">Nenhum, só a descrição</option>{fontes.map(f=><option key={f.src} value={f.src}>{f.name}</option>)}</select></Field>}
  {origem&&!video&&<Field label={`Quanto mudar · ${forca}%`} hint="10% fica quase igual à foto; 100% ignora a foto."><input type="range" min={10} max={100} step={5} value={forca} onChange={e=>setForca(Number(e.target.value))} disabled={working}/></Field>}
  <Field label="Formato"><select value={tamanho} onChange={e=>setTamanho(e.target.value as typeof tamanho)} disabled={working}>{(video?tamanhosVideo:tamanhos).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>
  {video&&<Field label={`Duração · ${duracao} s`} hint="Cada segundo a mais leva mais tempo para gerar."><input type="range" min={2} max={15} step={1} value={duracao} onChange={e=>setDuracao(Number(e.target.value))} disabled={working}/></Field>}
  {job&&<p className="fw-muted" role="status">{legenda[job.status]}{job.status==='erro'&&job.error?` ${job.error}`:''}</p>}
  {error&&<p className="fw-alert" role="alert">{error}</p>}
  {job?.status==='pronto'&&job.url&&<div className="fw-art-preview">{video?<video src={job.url} controls playsInline preload="metadata"/>:<img src={job.url} alt={prompt}/>}</div>}
  <div className="fw-dialog-actions">{job?.status==='pronto'&&job.url?<Action onClick={()=>{onUse(job.url!,prompt);close()}}>{video?'Usar este vídeo':'Usar esta imagem'}</Action>:<Action onClick={generate} disabled={busy||working||connected===false||prompt.trim().length<3}><Sparkles size={17}/>{working?'Gerando…':video?'Gerar vídeo':'Gerar imagem'}</Action>}<Action secondary onClick={close}>Fechar</Action></div>
 </DialogContent>;
}
