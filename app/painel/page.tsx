import type {Metadata} from 'next';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {FrontendWorkspace} from '../piloto/frontend/workspace';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Meu espaço · Launchwing',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{tela?:string;peca?:string}>}){
 const params=await searchParams;
 const query=new URLSearchParams();
 if(params.tela)query.set('tela',params.tela);
 if(params.peca)query.set('peca',params.peca);
 const user=await requireChatGPTUser(`/painel${query.size?'?'+query.toString():''}`);
 return <FrontendWorkspace ownerKey={user.userId}/>;
}
