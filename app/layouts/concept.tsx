"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUpRight,Check,ChevronLeft,ChevronRight,Link2,Layers,Play,Pause} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

type Example={label:string;title:string;tone:string;caption:string;cta:string;url:string;images:{src:string;srcset?:string;alt:string}[]};
const examples:Example[]=[
 {label:'GERAEW · Carrossel com dicas',title:'Uma boa animação começa na imagem.',tone:'ink',caption:'Antes de animar, confira as mãos e o produto, reserve espaço para a legenda e escolha um movimento simples. Cinco slides com o mesmo avatar aranha para transformar uma ideia em conteúdo com continuidade visual.',cta:'Conheça a GERAEW',url:'https://www.geraew.com.br/',images:[
  {src:'/examples/avatar-animacao/slide-01.webp',alt:'Avatar aranha apresenta: antes de animar, três coisas para conferir.'},
  {src:'/examples/avatar-animacao/slide-02.webp',alt:'Primeira dica: confira mãos e produto na imagem-base antes de animar.'},
  {src:'/examples/avatar-animacao/slide-03.webp',alt:'Segunda dica: deixe espaço na composição para a legenda.'},
  {src:'/examples/avatar-animacao/slide-04.webp',alt:'Terceira dica: escolha um movimento claro para a animação.'},
  {src:'/examples/avatar-animacao/slide-05.webp',alt:'Anime, assista e confira o resultado. Explore suas ideias na GERAEW.'}
 ]},
 {label:'FeelRun · POV',title:'A trilha do seu treino.',tone:'blue',caption:'POV: você só quer correr e deixar a próxima música com o Feel Run. A proposta do app conecta a trilha ao seu batimento, com um monitor cardíaco.',cta:'Conheça o FeelRun · beta fechado',url:'https://feelrunbr.com/',images:[{src:'/examples/feelrun-batimento-800.webp',srcset:'/examples/feelrun-batimento-400.webp 400w, /examples/feelrun-batimento-800.webp 800w',alt:'POV: o Feel Run escolhe a próxima música pelo seu batimento e você só continua correndo. Corredora com fones em um parque.'}]},
 {label:'FeelRun · POV',title:'Qual música estava tocando?',tone:'citron',caption:'POV: acabou o treino e você quer descobrir qual música tocou no seu km mais rápido. O Feel Run propõe conectar as músicas ao percurso para você revisitar esse momento.',cta:'Conheça o FeelRun · beta fechado',url:'https://feelrunbr.com/',images:[{src:'/examples/feelrun-km-800.webp',srcset:'/examples/feelrun-km-400.webp 400w, /examples/feelrun-km-800.webp 800w',alt:'POV: o Feel Run te mostra qual música tocou no seu km mais rápido e você já quer ouvir de novo. Corredor olhando o celular.'}]},
 {label:'GERAEW · Carrossel',title:'A ideia é sua. O rosto pode ser um avatar.',tone:'ink',caption:'POV: você tem uma ideia de vídeo, mas não quer ligar a câmera. A GERAEW oferece criação de influencers, imagens e vídeos com IA. Um jeito de explorar suas ideias sem precisar aparecer.',cta:'Conheça a GERAEW',url:'https://www.geraew.com.br/',images:[{src:'/examples/geraew-01-800.webp',srcset:'/examples/geraew-01-400.webp 400w, /examples/geraew-01-800.webp 800w',alt:'POV: você precisa de vídeo mas não quer aparecer. Foi aí que a GERAEW entrou na conversa.'},{src:'/examples/geraew-02-800.webp',srcset:'/examples/geraew-02-400.webp 400w, /examples/geraew-02-800.webp 800w',alt:'POV: o rosto do vídeo pode ser um avatar. Na GERAEW, dá pra criar influencers com IA.'},{src:'/examples/geraew-03-800.webp',srcset:'/examples/geraew-03-400.webp 400w, /examples/geraew-03-800.webp 800w',alt:'POV: a ideia é sua. O vídeo não precisa ser uma gravação sua. GERAEW: imagens e vídeos com IA.'}]},
];


const heroVideos=[
 {id:'pedro',label:'Meme · Pedro Pascal',description:'Eu de boa enquanto meu avatar da GERAEW apresenta o produto por mim.'},
 {id:'avatar-descoberta',label:'Avatar aranha · descoberta',description:'Avatar aranha em vídeo estilo UGC: descobrindo como criar conteúdo sem gravar o próprio rosto.'},
 {id:'02-desconfiado',label:'Meme · The Rock',description:'“Pra vender você tem que aparecer.” Eu depois de conhecer a GERAEW.'},
 {id:'avatar-surpresa',label:'Avatar aranha · surpresa',description:'Avatar aranha reage com surpresa: você não precisa ser a pessoa do anúncio.'},
 {id:'snoop-ideia',label:'Meme · Snoop Dogg',description:'Quando a ideia sai do rascunho e vira conteúdo na GERAEW.'},
];

export function VideoStage(){
 const [active,setActive]=useState(0),[playing,setPlaying]=useState(false);
 const video=useRef<HTMLVideoElement>(null);
 const current=heroVideos[active];
 // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a preferência do sistema só no navegador, depois da montagem
 useEffect(()=>{const preference=window.matchMedia('(prefers-reduced-motion: reduce)');setPlaying(!preference.matches);const change=()=>setPlaying(!preference.matches);preference.addEventListener('change',change);return()=>preference.removeEventListener('change',change)},[]);
 useEffect(()=>{
  const el=video.current;if(!el)return;
  let visible=false,disposed=false;
  const sync=()=>{if(playing&&visible&&!document.hidden){void el.play().catch(()=>{if(!disposed)setPlaying(false)})}else el.pause()};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.25});
  observer.observe(el);document.addEventListener('visibilitychange',sync);
  return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',sync);el.pause()};
 },[active,playing]);
 const select=(index:number)=>setActive((index+heroVideos.length)%heroVideos.length);
 return <div className="lw-video-showcase">
  <div className="lw-video-stage">
   <div className="lw-format-float lw-format-pov"><span className="lw-format-icon"><Layers aria-hidden="true"/></span><span><strong>Memes + vídeos com avatar</strong><small>O seu produto na conversa</small></span></div>
   <div className="lw-format-float lw-format-meme"><span className="lw-format-icon"><Check aria-hidden="true"/></span><span><strong>Você tem a última palavra</strong><small>Revise antes de publicar</small></span></div>
   <div className="lw-format-float lw-format-demo"><span className="lw-format-icon"><Link2 aria-hidden="true"/></span><span><strong>O seu produto em cena</strong><small>Tudo começa com uma URL</small></span></div>
   <div className="lw-video-stack">
    <div className="lw-video-back lw-video-back-two" aria-hidden="true"><img src={`/videos/${heroVideos[(active+2)%heroVideos.length].id}.jpg`} alt="" width="720" height="1280" loading="lazy"/></div>
    <div className="lw-video-back lw-video-back-one" aria-hidden="true"><img src={`/videos/${heroVideos[(active+1)%heroVideos.length].id}.jpg`} alt="" width="720" height="1280" loading="lazy"/></div>
    <div className="lw-video-front lw-video-live">
     <video key={current.id} ref={video} src={`/videos/${current.id}.mp4`} poster={`/videos/${current.id}.jpg`} muted playsInline preload="metadata" aria-label={current.description} onEnded={()=>{if(playing)select(active+1)}} onError={()=>setPlaying(false)}/>
     <button className="lw-video-play-toggle" type="button" aria-label={playing?'Pausar vídeo':'Reproduzir vídeo'} onClick={()=>setPlaying(!playing)}>{playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}</button>
    </div>
   </div>
  </div>
  <div className="lw-video-actions"><button type="button" onClick={()=>select(active-1)} aria-label="Ver conteúdo anterior"><ChevronLeft aria-hidden="true"/></button><div role="group" aria-label="Escolha um conteúdo">{heroVideos.map((item,i)=><button type="button" key={item.id} aria-label={`Ver ${item.label}`} aria-pressed={active===i} onClick={()=>select(i)}><span/></button>)}</div><button type="button" onClick={()=>select(active+1)} aria-label="Ver próximo conteúdo"><ChevronRight aria-hidden="true"/></button></div>
  <p className="lw-video-current" aria-live="polite">{active+1} / {heroVideos.length} <span>GERAEW · {current.label}</span></p>
  <p className="lw-video-disclaimer">Estudos editoriais · exemplos da direção de conteúdo.</p>
 </div>
}

export function Signup(){const [status,setStatus]=useState('idle'),[message,setMessage]=useState('');async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(status==='loading')return;const data=new FormData(event.currentTarget);setStatus('loading');setMessage('');try{const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),website:data.get('website')||''})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Não foi possível registrar agora. Tente novamente.');setStatus('success');setMessage('Seu interesse foi registrado. Você está na lista de acesso antecipado.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:'Confira sua conexão e tente novamente.')}}return <div className="lw-signup">{status==='success'?<div className="lw-success" role="status"><Check aria-hidden="true"/><h3>Você está na lista.</h3><p>{message}</p><span>Sem cobrança ou criação de assinatura.</span></div>:<form onSubmit={submit}><label htmlFor="lw-email">Seu melhor e-mail</label><div className="lw-input-row"><Input type="email" id="lw-email" name="email" placeholder="voce@exemplo.com" required maxLength={254} autoComplete="email" aria-describedby="lw-consent lw-status"/><Button type="submit" className="lw-cta" disabled={status==='loading'}>{status==='loading'?'Registrando…':'Quero acesso antecipado'}<ArrowUpRight aria-hidden="true"/></Button></div><div className="lw-honey" aria-hidden="true"><label htmlFor="lw-website">Website</label><input id="lw-website" name="website" tabIndex={-1} autoComplete="off"/></div><p id="lw-consent">Ao entrar, você pede para receber um aviso por e-mail quando o acesso abrir. Cadastro gratuito, sem cartão.</p><p id="lw-status" role="status" className="lw-form-status">{message}</p></form>}</div>}
export function Deck({contextual=false}:{contextual?:boolean}){
 const [active,setActive]=useState(contextual?1:0),[slide,setSlide]=useState(0);const item=examples[active];
 function select(index:number){setActive(index);setSlide(0)}
 return <div className="lw-deck-demo lw-real-examples">
  <div className="lw-example-media"><img key={item.images[slide].src} src={item.images[slide].src} srcSet={item.images[slide].srcset} sizes="(max-width:700px) 300px, 340px" alt={item.images[slide].alt} width="800" height="1421" loading="lazy"/>
   {item.images.length>1&&<div className="lw-slide-controls"><Button variant="outline" size="icon" aria-label="Slide anterior" onClick={()=>setSlide((slide+item.images.length-1)%item.images.length)}><ChevronLeft/></Button><span aria-live="polite">Slide {slide+1} de {item.images.length}</span><Button variant="outline" size="icon" aria-label="Próximo slide" onClick={()=>setSlide((slide+1)%item.images.length)}><ChevronRight/></Button></div>}
  </div>
  <div className="lw-deck-copy"><p className="lw-kicker">EXEMPLO EDITORIAL · {item.label}</p>{contextual&&<dl className="lw-example-context"><div><dt>O produto</dt><dd>{active===1||active===2?'FeelRun · música e corrida':'GERAEW · criação visual com IA'}</dd></div><div><dt>O público</dt><dd>{active===1||active===2?'Quem corre ouvindo música.':'Quem precisa criar imagens e vídeos.'}</dd></div><div><dt>A situação</dt><dd>{['Preparar uma imagem antes de animar.','Correr sem precisar escolher a próxima música.','Descobrir qual música tocou no trecho mais rápido.','Produzir um vídeo sem gravar o próprio rosto.'][active]}</dd></div></dl>}<h3 className="lw-example-title">{item.title}</h3><p className="lw-caption" aria-live="polite">{item.caption}</p><a className="lw-caption-cta" href={item.url} target="_blank" rel="noreferrer"><ArrowUpRight size={17} aria-hidden="true"/>{item.cta}</a><div className="lw-deck-controls"><Button variant="outline" size="icon" aria-label="Exemplo anterior" onClick={()=>select((active+examples.length-1)%examples.length)}><ChevronLeft/></Button><div className="lw-dots">{examples.map((example,i)=><button key={i} aria-label={`Ver exemplo ${i+1}: ${example.label}`} aria-pressed={active===i} onClick={()=>select(i)}>{i+1}</button>)}</div><Button variant="outline" size="icon" aria-label="Próximo exemplo" onClick={()=>select((active+1)%examples.length)}><ChevronRight/></Button></div><p className="lw-note">POVs da FeelRun e carrosséis da GERAEW, com três ou cinco slides. Estudos editoriais para revisão privada; não são resultados de um produto Launchwing já disponível.</p></div>
 </div>
}
