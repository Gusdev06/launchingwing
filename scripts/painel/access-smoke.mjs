// Prova da verificação do JWT do Cloudflare Access com uma chave RSA gerada aqui: aceita o token certo e
// recusa aud errado, emissor errado, expirado, assinatura adulterada e chave desconhecida.
import assert from 'node:assert/strict';
import {verifyAccessJwt} from '../../lib/access-jwt.ts';
const {subtle}=globalThis.crypto;
const pair=await subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await subtle.exportKey('jwk',pair.publicKey)),kid:'k1',alg:'RS256',use:'sig'};
const b64=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
const config={team:'launchwing',aud:'aud-do-app'};
async function token({kid='k1',aud='aud-do-app',iss='https://launchwing.cloudflareaccess.com',exp=Math.floor(Date.now()/1000)+600,sub='user-1',email='ana@exemplo.com',key=pair.privateKey}={}){
 const h=b64({alg:'RS256',kid,typ:'JWT'}),p=b64({sub,email,aud,iss,exp});
 const sig=Buffer.from(await subtle.sign('RSASSA-PKCS1-v1_5',key,Buffer.from(`${h}.${p}`))).toString('base64url');
 return `${h}.${p}.${sig}`;
}
const keys=async()=>[jwk];const marks=[];
const ok=await verifyAccessJwt(await token(),config,keys);assert.deepEqual(ok,{userId:'user-1',email:'ana@exemplo.com',fullName:null,displayName:'ana@exemplo.com'});marks.push('valid_token_accepted');
assert.equal(await verifyAccessJwt(await token({aud:'outro-app'}),config,keys),null);marks.push('wrong_audience_rejected');
assert.equal(await verifyAccessJwt(await token({iss:'https://outro.cloudflareaccess.com'}),config,keys),null);marks.push('wrong_issuer_rejected');
assert.equal(await verifyAccessJwt(await token({exp:Math.floor(Date.now()/1000)-5}),config,keys),null);marks.push('expired_rejected');
const t=await token();const parts=t.split('.');const forged=`${parts[0]}.${b64({sub:'user-2',email:'x@y.z',aud:'aud-do-app',iss:'https://launchwing.cloudflareaccess.com',exp:Math.floor(Date.now()/1000)+600})}.${parts[2]}`;
assert.equal(await verifyAccessJwt(forged,config,keys),null);marks.push('tampered_payload_rejected');
assert.equal(await verifyAccessJwt(await token({kid:'desconhecida'}),config,keys),null);marks.push('unknown_key_rejected');
const other=await subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
assert.equal(await verifyAccessJwt(await token({key:other.privateKey}),config,keys),null);marks.push('foreign_signature_rejected');
assert.equal(await verifyAccessJwt('lixo',config,keys),null);marks.push('garbage_rejected');
console.log(JSON.stringify({passed:marks}));
