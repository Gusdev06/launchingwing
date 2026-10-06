import Link from 'next/link';
import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {loginProprioLigado} from '@/lib/login-d1';
import {FormularioDeEntrada} from './formulario';
import '../piloto/blitz.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Entrar · Launchwing',robots:{index:false,follow:false}};
// Entrada por código no e-mail (login próprio). Desligado, a página não existe e vale o login de antes (Access).
export default async function Entrar({searchParams}:{searchParams:Promise<{return_to?:string}>}){
 if(!loginProprioLigado())redirect('/cadastro');
 const {return_to:volta}=await searchParams;const destino=volta&&volta.startsWith('/')&&!volta.startsWith('//')?volta:'/piloto';
 if(await getChatGPTUser())redirect(destino);
 return <div className="lw-app"><header className="lw-top"><Link href="/"><img src="/brand/logo-primary.svg" alt="Launchwing" width="162" height="37"/></Link></header><main className="lw-main"><section className="lw-onboarding"><div className="lw-intro"><span className="lw-eyebrow">ENTRAR</span><h1>Um código no seu e-mail, sem senha.</h1><p>Digite seu e-mail. Mandamos um código de 6 números que vale por 10 minutos.</p></div><FormularioDeEntrada destino={destino}/></section></main></div>;
}
