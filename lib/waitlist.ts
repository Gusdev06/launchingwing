import {env} from 'cloudflare:workers';
export async function registerInterest(email:string){
 const db=(env as unknown as {DB?:D1Database}).DB;
 if(!db)throw new Error('Waitlist database unavailable');
 await db.prepare('INSERT INTO waitlist (email, consent_version) VALUES (?, ?) ON CONFLICT(email) DO NOTHING').bind(email,'early-access-v1').run();
}
