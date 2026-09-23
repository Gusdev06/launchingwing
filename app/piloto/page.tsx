import type {Metadata} from 'next';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {PilotWorkspace} from './workspace';
import {BlitzWorkspace} from './blitz-workspace';
import {normalizeProductUrl} from '@/lib/pilot-model';
import './pilot.css';
import './blitz.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Launchwing — teste privado',robots:{index:false,follow:false}};

async function PilotGate({returnTo,url,legacy}:{returnTo:string;url:string;legacy:boolean}){
 const user=await requireChatGPTUser(returnTo);
 return legacy?<PilotWorkspace/>:<BlitzWorkspace ownerKey={user.userId} initialUrl={url} initialName={user.userId==='local_seedy'?'':user.fullName||''}/>;
}
export default async function PilotPage({searchParams}:{searchParams:Promise<{caso?:string;url?:string;legacy?:string;tela?:string;peca?:string}>}){
 const {caso,url:raw,legacy,tela,peca}=await searchParams;let url='';try{if(raw)url=normalizeProductUrl(raw)}catch{}
 const query=new URLSearchParams();if(caso)query.set('caso',caso);if(url)query.set('url',url);if(legacy==='1')query.set('legacy','1');if(tela)query.set('tela',tela);if(peca)query.set('peca',peca);
 return <PilotGate returnTo={`/piloto${query.size?'?'+query.toString():''}`} url={url} legacy={legacy==='1'}/>;
}
