import {env} from 'cloudflare:workers';
import {ErroFonte,type Candidato,type Fonte,type Formato} from './fonte';
import {pexels} from './pexels';
import {pixabay} from './pixabay';
import {avaliar,escolher,type Avaliado} from './escolha';
// Fonte nova entra só aqui, depois de conferida (API oficial e licença que libere uso comercial).
export const FONTES:Fonte[]=[pexels,pixabay];
const CACHE_MS=24*60*60*1000;
// Temas comuns de meme em inglês, que é como as fontes descrevem os vídeos. Tema fora da lista vai em português.
const TRADUCAO:Record<string,string>={surpresa:'surprised',surpreso:'surprised',susto:'scared',medo:'scared',risada:'laughing',rindo:'laughing',feliz:'happy',alegria:'happy',triste:'sad',tristeza:'sad',raiva:'angry',bravo:'angry',chorando:'crying',choro:'crying',comemoracao:'celebration',comemorar:'celebration',festa:'party',danca:'dancing',dancando:'dancing',duvida:'confused',confuso:'confused',pensando:'thinking',ideia:'idea',aplauso:'applause',aplausos:'applause',brinde:'cheers',tchau:'waving goodbye',oi:'waving hello',sim:'nodding yes',nao:'shaking head no',cansado:'tired',sono:'sleepy',dinheiro:'money',explosao:'explosion',fogo:'fire',gato:'cat',cachorro:'dog'};
const semAcento=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function termoDaBusca(tema:string):{termo:string;idioma:'pt'|'en'}{
 const limpo=semAcento(tema);const ingles=TRADUCAO[limpo];
 return ingles?{termo:`green screen ${ingles}`,idioma:'en'}:{termo:`green screen ${limpo}`,idioma:'pt'};
}
function db(){const database=(env as unknown as {DB?:D1Database}).DB;if(!database)throw new Error('Banco indisponível');return database}
async function comCache(fonte:Fonte,termo:string,formato:Formato,idioma:'pt'|'en'):Promise<Candidato[]>{
 const chave=`${fonte.nome}|${idioma}|${formato}|${termo}`,agora=Date.now();
 const salvo=await db().prepare('SELECT resposta,criado_em FROM fundo_verde_buscas WHERE chave=?').bind(chave).first<{resposta:string;criado_em:number}>();
 if(salvo&&agora-salvo.criado_em<CACHE_MS)return JSON.parse(salvo.resposta);
 const candidatos=await fonte.buscar({termo,formato,idioma});
 await db().prepare('INSERT INTO fundo_verde_buscas (chave,resposta,criado_em) VALUES (?,?,?) ON CONFLICT(chave) DO UPDATE SET resposta=excluded.resposta,criado_em=excluded.criado_em').bind(chave,JSON.stringify(candidatos),agora).run();
 return candidatos;
}
export type ResultadoBusca={ok:true;termo:string;escolhido:Avaliado;candidatos:Avaliado[]}|{ok:false;codigo:'sem_resultado'|'limite'|'fonte_fora';mensagem:string};
// Busca em todas as fontes ao mesmo tempo. Uma fonte fora não derruba a busca se outra respondeu.
export async function buscarFundoVerde(tema:string,formato:Formato):Promise<ResultadoBusca>{
 const {termo,idioma}=termoDaBusca(tema);
 const respostas=await Promise.allSettled(FONTES.map(f=>comCache(f,termo,formato,idioma)));
 const candidatos=respostas.flatMap(r=>r.status==='fulfilled'?r.value:[]);
 if(candidatos.length){
  const avaliados=await avaliar(candidatos),escolhido=escolher(avaliados);
  if(escolhido)return {ok:true,termo,escolhido,candidatos:avaliados};
  return {ok:false,codigo:'sem_resultado',mensagem:`Achamos vídeos para "${tema}", mas nenhum com fundo verde de verdade. Tente outro tema.`};
 }
 const erros=respostas.flatMap(r=>r.status==='rejected'?[r.reason]:[]);
 if(erros.some(e=>e instanceof ErroFonte&&e.codigo==='limite'))return {ok:false,codigo:'limite',mensagem:'As fontes de vídeo chegaram ao limite de buscas. Tente de novo em alguns minutos.'};
 if(erros.length)return {ok:false,codigo:'fonte_fora',mensagem:'As fontes de vídeo não responderam agora. Tente de novo em instantes.'};
 return {ok:false,codigo:'sem_resultado',mensagem:`Nenhum vídeo de fundo verde encontrado para "${tema}". Tente outro tema.`};
}
