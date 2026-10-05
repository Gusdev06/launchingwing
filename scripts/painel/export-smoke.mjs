// Prova do pacote do painel: monta ZIPs com o exportador real, lendo as mídias do disco, e confere
// com o leitor de ZIP do Python (independente do nosso escritor).
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createWorkspaceExport} from '../../lib/workspace-export.ts';
const brand={name:'Insta Radar',site:'https://exemplo.com'};
const slide=(image,text,i)=>({id:`s${i}`,image,text,position:i?'center':'top',size:30});
const carrossel={id:'c1',title:'Antes de olhar um perfil',format:'educativo',caption:'Legenda do carrossel',slides:['/workspace/01-celular-cafe-cama.jpg','/workspace/02-quarto-celular.jpg','/workspace/03-cafe-rotina.jpg'].map((img,i)=>slide(img,i?`Texto ${i}`:'',i)),origin:'local',status:'saved',createdAt:'2026-09-27T00:00:00Z'};
const meme={id:'c2',title:'Quando você tenta lembrar',format:'meme',caption:'Legenda do meme',slides:[slide('/workspace/01-celular-cafe-cama.jpg','',0)],video:'/pilot/insta-radar/v2-casual/insta-radar-meme.mp4',poster:'/pilot/insta-radar/v2-casual/capa.jpg',origin:'example',status:'saved',createdAt:'2026-09-27T00:00:00Z'};
const reader=async url=>new Response(await readFile(`public${url}`),{headers:{'Content-Type':url.endsWith('.mp4')?'video/mp4':url.endsWith('.jpg')?'image/jpeg':'image/png'}});
await mkdir('outputs/painel-export',{recursive:true});
const marks=[];
const both=await createWorkspaceExport([carrossel,meme],brand,reader);assert.equal(both.blob.type,'application/zip');assert.equal(both.fileName,'launchwing-insta-radar-conteudos.zip');
await writeFile('outputs/painel-export/dois.zip',new Uint8Array(await both.blob.arrayBuffer()));marks.push('two_contents_zipped');
const one=await createWorkspaceExport([carrossel],brand,reader);assert.equal(one.fileName,'launchwing-insta-radar-antes-de-olhar-um-perfil.zip');
await writeFile('outputs/painel-export/um.zip',new Uint8Array(await one.blob.arrayBuffer()));marks.push('single_content_named_by_title');
await assert.rejects(()=>createWorkspaceExport([],brand,reader),/Salve ao menos/);marks.push('empty_rejected');
await assert.rejects(()=>createWorkspaceExport([{...carrossel,slides:[slide('https://evil.example/x.png','',0)]}],brand,reader),/não está disponível/);marks.push('foreign_url_rejected');
await assert.rejects(()=>createWorkspaceExport([{...carrossel,slides:[slide('data:image/png;base64,AAAA','',0)]}],brand,reader),/não está disponível/);marks.push('data_url_rejected');
await assert.rejects(()=>createWorkspaceExport([carrossel],brand,async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}})),/não foi possível baixar/);marks.push('wrong_type_rejected');
await assert.rejects(()=>createWorkspaceExport([carrossel],brand,async()=>new Response('',{headers:{'Content-Type':'image/jpeg'}})),/vazio/);marks.push('empty_file_rejected');
const inspection=execFileSync('python3',['-c',`
import json,zipfile,hashlib
with zipfile.ZipFile('outputs/painel-export/dois.zip') as z:
    assert z.testzip() is None
    names=z.namelist()
    assert '01-antes-de-olhar-um-perfil/slide-01.jpg' in names and '01-antes-de-olhar-um-perfil/slide-03.jpg' in names
    assert '01-antes-de-olhar-um-perfil/legenda.txt' in names and '01-antes-de-olhar-um-perfil/textos-dos-slides.txt' in names
    assert '02-quando-voce-tenta-lembrar/video.mp4' in names and 'LEIA-ME.txt' in names and 'conteudos.json' in names
    assert 'Slide 2 (no meio): Texto 1' in z.read('01-antes-de-olhar-um-perfil/textos-dos-slides.txt').decode()
    assert z.read('01-antes-de-olhar-um-perfil/legenda.txt').decode()=='Legenda do carrossel'
    src=open('public/pilot/insta-radar/v2-casual/insta-radar-meme.mp4','rb').read()
    assert hashlib.sha256(z.read('02-quando-voce-tenta-lembrar/video.mp4')).hexdigest()==hashlib.sha256(src).hexdigest()
    m=json.loads(z.read('conteudos.json'))
    assert len(m['contents'])==2 and m['contents'][1]['files']==['02-quando-voce-tenta-lembrar/video.mp4']
print('ok',len(names))
`],{encoding:'utf8'});
assert.match(inspection,/^ok 9/);marks.push('zip_valid_and_bytes_identical');
console.log(JSON.stringify({passed:marks}));
