// Ponto de entrada do Worker: o site do vinext (fetch) mais a rotina agendada (scheduled), que avança o que o cliente
// deixou andando sem precisar do navegador aberto (lotes do motor e fila de postagem).
import site from 'vinext/server/fetch-handler';
import {rotina} from '../lib/rotina';
export default {
 ...site,
 async scheduled(_evento:ScheduledController,_env:unknown,ctx:ExecutionContext){ctx.waitUntil(rotina())},
};
