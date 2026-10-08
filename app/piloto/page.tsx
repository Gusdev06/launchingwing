import type {Metadata} from 'next';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {BlitzWorkspace} from './blitz-workspace';
import {normalizeProductUrl} from '@/lib/pilot-model';
import './pilot.css';
import './blitz.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Launchwing · teste privado',robots:{index:false,follow:false}};

async function PilotGate({returnTo,url}:{returnTo:string;url:string}){
 const user=await requireChatGPTUser(returnTo);
 return <BlitzWorkspace ownerKey={user.userId} initialUrl={url} initialName={user.userId==='local_seedy'?'':user.fullName||''}/>;
}
export default async function PilotPage({searchParams}:{searchParams:Promise<{caso?:string;url?:string;tela?:string;peca?:string}>}){
 const {caso,url:raw,tela,peca}=await searchParams;let url='';try{if(raw)url=normalizeProductUrl(raw)}catch{}
 const query=new URLSearchParams();if(caso)query.set('caso',caso);if(url)query.set('url',url);if(tela)query.set('tela',tela);if(peca)query.set('peca',peca);
 return <PilotGate returnTo={`/piloto${query.size?'?'+query.toString():''}`} url={url}/>;
}
