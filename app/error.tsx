'use client';
// Erro ao desenhar uma página: em vez de tela branca, a mensagem e o botão de tentar de novo. O servidor já registra a causa.
import './piloto/blitz.css';
export default function Erro({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="lw-app"><main className="lw-main"><section className="lw-onboarding"><div className="lw-intro"><h1>Algo deu errado nesta tela.</h1><p>Suas edições salvas continuam guardadas. Tente de novo; se continuar, recarregue a página.</p></div><button type="button" className="lw-primary" onClick={()=>reset()}>Tentar de novo</button></section></main></div>;
}
