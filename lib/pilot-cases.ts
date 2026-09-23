import geraew from './pilot-geraew.json';
import radar from './pilot-insta-radar.json';
import type {PilotData,PilotPiece} from './pilot-model';
type PreparedCase=Pick<PilotData,'context'|'facts'|'sources'> & {id:string;pieces:PilotPiece[]};
const catalog:{hosts:string[];data:PreparedCase}[]=[
 {hosts:['insta-radar-two.vercel.app'],data:radar as PreparedCase},
 {hosts:['geraew.ai','www.geraew.ai','geraew.com.br','www.geraew.com.br'],data:geraew as PreparedCase},
];
export function initialPilotData(url:string):PilotData{
 const prepared=catalog.find(entry=>entry.hosts.includes(new URL(url).hostname))?.data;
 return {url,caseId:prepared?.id??null,phase:prepared?'context':'queued',
 context:prepared?structuredClone(prepared.context):{name:'',description:'',audience:'',situations:''},
 facts:prepared?[...prepared.facts]:[],sources:prepared?structuredClone(prepared.sources):[],pieces:[],contextConfirmedAt:null,
 events:[{at:new Date().toISOString(),kind:prepared?'prepared_context_loaded':'url_received'}]};
}
export function preparedPieces(caseId:string|null):PilotPiece[]{
 const prepared=catalog.find(entry=>entry.data.id===caseId)?.data;
 return prepared?structuredClone(prepared.pieces):[];
}
