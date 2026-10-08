// Saúde pública do Launchwing (08/10): o que a sentinela guardou na última rodada. Não chama o motor.
import {resumoDaSaude} from '@/lib/saude';
export async function GET(){
 try{return Response.json(await resumoDaSaude(),{headers:{'Cache-Control':'no-store'}})}
 catch{return Response.json({site:'ok',motor:null,erro:'estado da sentinela indisponível'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
