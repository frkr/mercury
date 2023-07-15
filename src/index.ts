import fluxoWhatsAppGPT from "./fluxoWhatsAppGPT";

export {WAID} from "./db/WAID";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        try {
            return new fluxoWhatsAppGPT(request, env).fluxo();
        } catch (e) {
            console.error("mercury", e, e.stack);
        }
    }
}
