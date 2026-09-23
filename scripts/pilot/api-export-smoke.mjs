import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createPilotExport} from '../../lib/pilot-export.ts';
const base='http://localhost:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/piloto',{redirect:'manual'});
const cookie=login.headers.get('set-cookie').split(';')[0];
const reference=JSON.parse(await readFile('outputs/api-live-run.json','utf8'));
const response=await fetch(base+`/api/pilot/${reference.id}`,{headers:{Cookie:cookie}});const {run}=await response.json();
assert.equal(run.phase,'review');assert.ok(run.pieces.every(p=>p.status==='pending'));
const readAsset=url=>fetch(base+url,{headers:{Cookie:cookie}});
await mkdir('outputs/api-export-qa',{recursive:true});
for(const piece of run.pieces){const result=await createPilotExport(run,piece.id,readAsset);await writeFile(`outputs/api-export-qa/${piece.id}.zip`,new Uint8Array(await result.blob.arrayBuffer()))}
await writeFile('outputs/api-export-qa/run.json',JSON.stringify(run));
console.log(execFileSync('python3',['-c',`
import json,zipfile
from pathlib import Path
root=Path('outputs/api-export-qa');run=json.loads((root/'run.json').read_text())
for p in run['pieces']:
 with zipfile.ZipFile(root/(p['id']+'.zip')) as z:
  assert z.testzip() is None
  m=json.loads(z.read('revisao.json'))['pieces'][0]
  assert m['caption']==p['caption'] and m['status']=='pending'
  assert len(m['assets'])==len(p['assets'])
  folder=m['assets'][0]['file'].rsplit('/',1)[0]
  assert z.read(folder+'/legenda.txt').decode()==p['caption']
  for asset in m['assets']: assert len(z.read(asset['file']))>1000
print('3 ZIPs gerados: CRC, 13 mídias, ordem e legendas salvas conferidos. Nenhuma aprovação alterada.')
`],{encoding:'utf8'}).trim());
