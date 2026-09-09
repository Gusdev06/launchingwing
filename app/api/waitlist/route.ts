import {registerInterest} from '@/lib/waitlist';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Envio não permitido.'},{status:403,headers});
 if(!request.headers.get('Content-Type')?.includes('application/json'))return Response.json({error:'Formato inválido.'},{status:415,headers});
 let payload:unknown;
 try{const body=await request.text();if(body.length>2048)return Response.json({error:'Envio muito grande.'},{status:413,headers});payload=JSON.parse(body)}catch{return Response.json({error:'Confira o e-mail e tente novamente.'},{status:400,headers})}
 if(!payload||typeof payload!=='object')return Response.json({error:'Confira o e-mail e tente novamente.'},{status:400,headers});
 const {email:value,website}=payload as Record<string,unknown>;
 if(website)return Response.json({ok:true},{headers});
 const email=typeof value==='string'?value.trim().toLowerCase():'';
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:'Digite um e-mail válido para entrar na lista.'},{status:400,headers});
 try{await registerInterest(email);return Response.json({ok:true},{headers})}catch{console.error('Waitlist registration failed');return Response.json({error:'Não conseguimos registrar agora. Seu e-mail continua aqui; tente novamente em instantes.'},{status:503,headers})}
}
