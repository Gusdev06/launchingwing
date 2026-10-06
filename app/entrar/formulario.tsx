'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
// Dois passos: pede o código e confere. O cookie da sessão é gravado pelo servidor (HttpOnly).
export function FormularioDeEntrada({destino}:{destino:string}){
 const [email,setEmail]=useState(''),[codigo,setCodigo]=useState(''),[passo,setPasso]=useState<'email'|'codigo'>('email');
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[ocupado,setOcupado]=useState(false);
 async function enviar(caminho:string,corpo:object){
  setOcupado(true);setErro('');
  try{const r=await fetch(caminho,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});const d=await r.json().catch(()=>({})) as {error?:string};if(!r.ok){setErro(d.error||'Algo deu errado. Tente de novo.');return false}return true}
  catch{setErro('Sem conexão. Tente de novo.');return false}finally{setOcupado(false)}
 }
 return <form className="lw-form" onSubmit={async e=>{e.preventDefault();
  if(passo==='email'){if(await enviar('/api/entrar/codigo',{email})){setPasso('codigo');setAviso(`Mandamos o código para ${email.trim().toLowerCase()}.`)}}
  else if(await enviar('/api/entrar/verificar',{email,codigo}))window.location.assign(destino);
 }}>
  {passo==='email'?<label>Seu e-mail<Input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   :<><p role="status">{aviso}</p><label>Código de 6 números<Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,''))}/></label></>}
  {erro&&<p className="lw-error" role="alert">{erro}</p>}
  <Button type="submit" disabled={ocupado} style={{width:'100%'}}>{passo==='email'?'Mandar código':'Entrar'}</Button>
  {passo==='codigo'&&<Button type="button" variant="outline" disabled={ocupado} onClick={()=>{setPasso('email');setCodigo('');setAviso('')}} style={{width:'100%'}}>Usar outro e-mail</Button>}
 </form>;
}
