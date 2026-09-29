// Prova da busca de fundo verde (A2) com Pexels e Pixabay falsas em 127.0.0.1:8791.
// O dev precisa rodar com, em .dev.vars: FUNDO_VERDE_CHAVE=chave-interna-teste, PEXELS_API_KEY=pexels-falsa,
// PIXABAY_API_KEY=pixabay-falsa, PEXELS_BASE_URL=http://127.0.0.1:8791/pexels, PIXABAY_BASE_URL=http://127.0.0.1:8791/pixabay
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import jpeg from 'jpeg-js';
const base='http://localhost:5173',rota=`${base}/api/interno/fundo-verde/busca`,CHAVE='chave-interna-teste';
const pedidos=[];let modo='normal';
// Quadro 90x160: fundo verde de chroma com um retângulo cinza no meio (a pessoa), ou uma cena sem verde.
function quadro(verde,roupaVerde=false){const w=90,h=160,data=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,meio=x>30&&x<60&&y>50&&y<130;const [R,G,B]=verde?(meio&&!roupaVerde?[120,110,100]:[20,200,40]):[150,120,90];data[i]=R;data[i+1]=G;data[i+2]=B;data[i+3]=255}return jpeg.encode({data,width:w,height:h},90).data}
const QUADRO_VERDE=quadro(true),QUADRO_CENA=quadro(false),QUADRO_TUDO_VERDE=quadro(true,true);
const pexelsVideo=(id,w,h,dur)=>({id,width:w,height:h,duration:dur,url:`https://www.pexels.com/video/${id}/`,user:{name:`Autor ${id}`,url:`https://www.pexels.com/@a${id}`},video_files:[{link:`http://127.0.0.1:8791/arquivo/${id}.mp4`,quality:'hd',file_type:'video/mp4',width:w,height:h}],video_pictures:[{picture:`http://127.0.0.1:8791/quadro/${id}.jpg`}]});
const fake=createServer((req,res)=>{
 const url=new URL(req.url,'http://x');pedidos.push(url);
 const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(url.pathname==='/pexels/videos/search'){
  if(req.headers.authorization!=='pexels-falsa'){send(401,{});return}
  if(modo==='pexels_fora'||modo==='todas_fora'){send(500,{});return}
  if(modo==='limite'){send(429,{});return}
  if(url.searchParams.get('query').includes('xyzzy')){send(200,{videos:[],total_results:0});return}
  send(200,{videos:[pexelsVideo(103,1080,1920,7),pexelsVideo(104,1080,1920,5),pexelsVideo(101,1080,1920,8),pexelsVideo(102,1080,1920,60)],total_results:3});return;
 }
 if(url.pathname==='/pixabay/videos/'){
  if(url.searchParams.get('key')!=='pixabay-falsa'){send(400,{});return}
  if(modo==='todas_fora'){send(500,{});return}
  if(modo==='limite'){send(429,{});return}
  if(url.searchParams.get('q').includes('xyzzy')){send(200,{hits:[],total:0});return}
  send(200,{hits:[{id:201,pageURL:'https://pixabay.com/videos/id-201/',duration:6,user:'autor201',user_id:9,videos:{medium:{url:'http://127.0.0.1:8791/arquivo/201.mp4',width:1080,height:1920,size:900000,thumbnail:'http://127.0.0.1:8791/quadro/201.jpg'}}}],total:1});return;
 }
 const q=url.pathname.match(/^\/quadro\/(\d+)\.jpg$/);if(q){res.writeHead(200,{'content-type':'image/jpeg'});res.end(q[1]==='103'?QUADRO_CENA:q[1]==='104'?QUADRO_TUDO_VERDE:QUADRO_VERDE);return}
 send(404,{});
});
await new Promise(r=>fake.listen(8791,'127.0.0.1',r));
const buscar=(body,chave=CHAVE)=>fetch(rota,{method:'POST',headers:{'content-type':'application/json',...(chave?{'x-chave':chave}:{})},body:JSON.stringify(body)}).then(async r=>({status:r.status,data:await r.json().catch(()=>({}))}));
const marks=[];const unico=()=>`surpresa ${crypto.randomUUID().slice(0,6)}`;
try{
 assert.equal((await buscar({tema:'surpresa'},null)).status,401);marks.push('sem_chave_recusado');
 assert.equal((await buscar({tema:'surpresa'},'errada')).status,401);marks.push('chave_errada_recusada');
 assert.equal((await buscar({tema:'a'})).status,400);marks.push('tema_curto_recusado');
 assert.equal((await buscar({tema:'x'.repeat(61)})).status,400);marks.push('tema_longo_recusado');
 assert.equal((await buscar({tema:'surpresa<script>'})).status,400);marks.push('caractere_estranho_recusado');
 const tema=unico();pedidos.length=0;
 const r=await buscar({tema,formato:'vertical'});assert.equal(r.status,200,JSON.stringify(r.data));
 const px=pedidos.find(u=>u.pathname.startsWith('/pexels')),pb=pedidos.find(u=>u.pathname.startsWith('/pixabay'));
 assert.ok(px.searchParams.get('query').startsWith('green screen'));assert.equal(px.searchParams.get('orientation'),'portrait');
 assert.ok(pb.searchParams.get('q').startsWith('green screen'));
 const fontes=new Set(r.data.candidatos.map(c=>c.fonte));assert.ok(fontes.has('pexels')&&fontes.has('pixabay'));marks.push('busca_nas_duas_fontes');
 const c=r.data.candidatos.find(c=>c.fonteId==='101');
 assert.equal(c.autor,'Autor 101');assert.equal(c.pagina,'https://www.pexels.com/video/101/');assert.ok(c.arquivoUrl&&c.quadros.length>=1&&c.licenca);marks.push('dados_de_origem_no_candidato');
 const traduzido=await buscar({tema:'surpresa',formato:'vertical'});assert.equal(traduzido.status,200);
 assert.equal(traduzido.data.termo,'green screen surprised','tema conhecido vai traduzido');marks.push('tema_traduzido');
 pedidos.length=0;const again=await buscar({tema,formato:'vertical'});assert.equal(again.status,200);assert.equal(pedidos.filter(u=>!u.pathname.startsWith('/quadro')).length,0,'segunda busca igual nao chama as fontes');assert.deepEqual(again.data.candidatos,r.data.candidatos);marks.push('cache_de_busca');
 // A3: escolha do melhor vídeo.
 const porId=Object.fromEntries(r.data.candidatos.map(c=>[c.fonteId,c]));
 assert.equal(porId['103'].aprovado,false);assert.match(porId['103'].motivo,/verde/);marks.push('sem_fundo_verde_descartado');
 assert.equal(porId['104'].aprovado,false);assert.match(porId['104'].motivo,/meio/);marks.push('roupa_verde_descartada');
 assert.equal(porId['102'].aprovado,false);assert.match(porId['102'].motivo,/longo/);marks.push('video_longo_descartado');
 assert.ok(porId['101'].verde>0.8,`verde medido ${porId['101'].verde}`);assert.equal(porId['101'].aprovado,true);marks.push('fundo_verde_medido');
 assert.ok(['101','201'].includes(r.data.escolhido?.fonteId));assert.equal(r.data.escolhido.aprovado,true);marks.push('melhor_escolhido');
 modo='pexels_fora';const meia=await buscar({tema:unico()});assert.equal(meia.status,200);assert.ok(meia.data.candidatos.every(c=>c.fonte==='pixabay'));marks.push('uma_fonte_fora_nao_derruba');
 modo='todas_fora';const fora=await buscar({tema:unico()});assert.equal(fora.status,502);assert.equal(fora.data.codigo,'fonte_fora');marks.push('fontes_fora_erro_claro');
 modo='limite';const lim=await buscar({tema:unico()});assert.equal(lim.status,429);assert.equal(lim.data.codigo,'limite');marks.push('limite_erro_claro');
 modo='normal';const nada=await buscar({tema:'xyzzy nada'});assert.equal(nada.status,404);assert.equal(nada.data.codigo,'sem_resultado');marks.push('sem_resultado_erro_claro');
 console.log(JSON.stringify({passed:marks}));
}catch(error){console.error(JSON.stringify({passed:marks}));throw error}
finally{fake.close()}
