import fluxoWhatsAppGPT from "./fluxoWhatsAppGPT";
import {readRequestBody} from "./util-js/util";

export {WAID} from "./db/WAID";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        let data = await readRequestBody(request);
        try {
            // XXX DESVIO DE FLUXO PARA OUTRO SERVIDOR
            if (data.entry[0].changes[0].value.metadata.phone_number_id === env.CELL_DEMO) {
                return env.GRGPT.fetch(request, {
                        method: 'POST',
                        body: JSON.stringify(data)
                    }
                );
            }
        } catch (e) {
        }
        try {
            return new fluxoWhatsAppGPT(request, data, env).fluxo();
        } catch (e) {
            console.error("mercury", e, e.stack);
        }
    }
}
