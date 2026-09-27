// RunPod falso para testar a tela sem gastar: node scripts/painel/runpod-falso.mjs (porta 8790).
// Todo pedido fica 1 consulta "gerando" e depois devolve um PNG de 1 pixel.
import {createServer} from 'node:http';
const MP4=Buffer.concat([Buffer.from('0000001c667479706d703432','hex'),Buffer.alloc(4000,7)]).toString('base64');
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const jobs=new Map();let runs=0;
createServer((req,res)=>{
 const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(req.method==='POST'&&/\/run$/.test(req.url)){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const id=`fake-${++runs}`;const wf=JSON.parse(body).input.workflow;const video=/video/.test(req.url);jobs.set(id,{polls:0,video});console.log('run',id,video?wf['5'].inputs.prompt:wf['4'].inputs.text);send(200,{id,status:'IN_QUEUE'})});return}
 const m=req.url.match(/\/status\/(.+)$/);if(m&&jobs.has(m[1])){const j=jobs.get(m[1]);j.polls++;send(200,j.polls===1?{status:'IN_PROGRESS'}:{status:'COMPLETED',output:{images:j.video?[{filename:'video/minimax_h3_00001_.mp4',type:'base64',data:MP4}]:[{filename:'krea2_00001_.png',type:'base64',data:PNG}]}});return}
 send(404,{error:'rota'});
}).listen(8790,'127.0.0.1',()=>console.log('RunPod falso em http://127.0.0.1:8790'));
