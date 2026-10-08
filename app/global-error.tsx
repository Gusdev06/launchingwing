'use client';
// Erro no layout raiz: o html inteiro precisa ser desenhado aqui, porque o layout não chegou a montar.
export default function ErroGlobal({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <html lang="pt-BR"><body style={{fontFamily:'Manrope,Arial,sans-serif',background:'#f7f8fb',color:'#161b2b',margin:0,minHeight:'100dvh',display:'grid',placeItems:'center',textAlign:'center',padding:24}}><main><h1 style={{fontSize:28,margin:'0 0 12px'}}>Algo deu errado nesta tela.</h1><p style={{color:'#687084',margin:'0 0 24px'}}>Tente de novo; se continuar, recarregue a página.</p><button type="button" onClick={()=>reset()} style={{background:'#2547ff',color:'white',border:0,borderRadius:9,minHeight:48,padding:'13px 20px',fontSize:15,cursor:'pointer'}}>Tentar de novo</button></main></body></html>;
}
