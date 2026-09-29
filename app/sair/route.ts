import {redirect} from 'next/navigation';
import {chatGPTSignOutPath} from '@/app/chatgpt-auth';
// O botão "Sair da conta" passa por aqui: o servidor sabe qual login está ativo (Access ou o de teste).
export function GET(){redirect(chatGPTSignOutPath('/cadastro'))}
