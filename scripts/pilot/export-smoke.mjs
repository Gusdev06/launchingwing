import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createPilotExport} from '../../lib/pilot-export.ts';

const radar=JSON.parse(await readFile('lib/pilot-insta-radar.json','utf8'));
const geraew=JSON.parse(await readFile('lib/pilot-geraew.json','utf8'));
const editedCaption='Legenda salva na revisão — ação, comparação e coração.\nSegunda linha.';
const run={...radar,id:'qa-export',revision:7,url:'https://insta-radar-two.vercel.app/',pieces:radar.pieces.map((piece,index)=>({...piece,status:index<2?'approved':'pending',caption:index===1?editedCaption:piece.caption}))};
const reader=async url=>new Response(await readFile(`public${url}`),{headers:{'Content-Type':url.endsWith('.mp4')?'video/mp4':'image/png'}});
await mkdir('outputs/export-qa',{recursive:true});
for(const [name,current,id] of [
 ['approved',run,undefined],
 ['amiga',run,run.pieces[2].id],
 ['geraew',{...run,...geraew,pieces:geraew.pieces.map(piece=>({...piece,status:'approved'}))},undefined]
]){
 const result=await createPilotExport(current,id,reader);
 assert.equal(result.blob.type,'application/zip');
 await writeFile(`outputs/export-qa/${name}.zip`,new Uint8Array(await result.blob.arrayBuffer()));
}
await assert.rejects(()=>createPilotExport({...run,pieces:run.pieces.map(p=>({...p,status:'pending'}))},undefined,reader),/Aprove/);
await assert.rejects(()=>createPilotExport(run,undefined,async()=>new Response('missing',{status:404})),/Não foi possível/);
await assert.rejects(()=>createPilotExport(run,undefined,async()=>new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html'}})),/Não foi possível/);
await assert.rejects(()=>createPilotExport(run,undefined,async()=>new Response('',{headers:{'Content-Type':'video/mp4'}})),/vazio/);
const inspection=execFileSync('python3',['-c',`
import json, zipfile, hashlib
from pathlib import Path
for name,expected_pieces,expected_media in [('approved',2,7),('amiga',1,6),('geraew',3,7)]:
    with zipfile.ZipFile('outputs/export-qa/'+name+'.zip') as archive:
        assert archive.testzip() is None
        manifest=json.loads(archive.read('revisao.json'))
        assert len(manifest['pieces'])==expected_pieces
        assert sum(len(p['assets']) for p in manifest['pieces'])==expected_media
        for piece in manifest['pieces']:
            folder=piece['assets'][0]['file'].rsplit('/',1)[0]
            assert archive.read(folder+'/legenda.txt').decode()==piece['caption']
            catalog=json.loads(Path('lib/pilot-'+('geraew' if name=='geraew' else 'insta-radar')+'.json').read_text())
            original=next(p for p in catalog['pieces'] if p['id']==piece['id'])
            for exported,asset in zip(piece['assets'],original['assets']):
                assert hashlib.sha256(archive.read(exported['file'])).digest()==hashlib.sha256(Path('public'+asset['url']).read_bytes()).digest()
        if name=='approved':
            assert all(p['status']=='approved' for p in manifest['pieces'])
            assert manifest['pieces'][1]['caption']==${JSON.stringify(editedCaption)}
        if name=='amiga':
            assert manifest['pieces'][0]['status']=='pending'
print('ZIP: CRC, seleção, ordem, mídias idênticas e legendas editadas conferidos nos 3 pacotes.')
`],{encoding:'utf8'});
console.log(inspection.trim());
console.log('Sem aprovação, arquivo ausente, resposta HTML e mídia vazia: exportação bloqueada.');
