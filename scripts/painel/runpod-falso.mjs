// RunPod falso para testar a tela sem gastar: node scripts/painel/runpod-falso.mjs (porta 8790).
// Todo pedido fica 1 consulta "gerando" e depois devolve um PNG de 1 pixel.
import {createServer} from 'node:http';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const jobs=new Map();let runs=0;
createServer((req,res)=>{
 const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(req.method==='POST'&&/\/run$/.test(req.url)){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const id=`fake-${++runs}`;jobs.set(id,{polls:0});console.log('run',id,JSON.parse(body).input.workflow['4'].inputs.text);send(200,{id,status:'IN_QUEUE'})});return}
 const m=req.url.match(/\/status\/(.+)$/);if(m&&jobs.has(m[1])){const j=jobs.get(m[1]);j.polls++;send(200,j.polls===1?{status:'IN_PROGRESS'}:{status:'COMPLETED',output:{images:[{filename:'krea2_00001_.png',type:'base64',data:PNG}]}});return}
 send(404,{error:'rota'});
}).listen(8790,'127.0.0.1',()=>console.log('RunPod falso em http://127.0.0.1:8790'));
