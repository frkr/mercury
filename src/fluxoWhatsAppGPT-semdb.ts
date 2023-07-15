import {readRequestBody} from "./util-js/util";
import {challenge, readMessage, sendMessage, sendMessageMultiPart} from "./whatsapp-ts/src";
import {chat} from "./simple-chatgpt/chatgpt";

export default class {

    //region Boot
    private readonly request: Request;
    private readonly env: Env;
    private data: WhatsAppNotification;
    private telefone: string;
    private prompt: string;
    private tipoMsg: MessageTypes;
    private whatsappMessageId: string;
    private whatsappUser: string;

    constructor(request: Request, env: Env) {
        this.request = request;
        this.env = env;
    }

    boot() {
        this.telefone = this.data.entry[0].changes[0].value.contacts[0].wa_id;
        this.whatsappMessageId = this.data.entry[0].changes[0].value.messages[0].id;
        this.whatsappUser = this.data.entry[0].changes[0].value.contacts[0].profile.name;
    }

    //endregion

    async fluxo() {
        try {
            this.data = await readRequestBody(this.request);

            if (this.request.method === 'POST') {

                this.tipoMsg = null;
                try {
                    this.tipoMsg = this.data.entry[0].changes[0].value.messages[0].type;
                } catch (e) {
                }

                if (this.tipoMsg) {

                    this.boot();

                    if (this.tipoMsg === "text") {

                        this.prompt = this.data.entry[0].changes[0].value.messages[0].text.body;

                        await this.gpt();

                    } else if (this.tipoMsg === "image") {

                        await this.imageMsg();

                    }
                } else {
                    //TODO outros tipos de msg
                    //console.log("Mensagem nao suportada: ", JSON.stringify(this.data, null, 2));
                }

            } else {
                return challenge(this.request, this.env.META_VERIFY);
            }
        } catch (e) {
            console.error("mercury: ", e, e.stack);
        }
        return new Response(JSON.stringify(this.data), {status: 200});
    }

    async imageMsg() {
        await sendMessage(
            {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: this.telefone,
                type: "image",
                image: {
                    id: this.data.entry[0].changes[0].value.messages[0].image.id
                }
            },
            this.env.IDEIAS_CASA,
            this.env.W_API_KEY
        );
    }

    async gpt() {
        let reposta: MessageChat = await chat(this.telefone, [{
            role: "user",
            content: this.prompt
        }], this.env.OPENAI_API_KEY);

        if (reposta !== null) {
            await readMessage(this.whatsappMessageId, this.env.IDEIAS_CASA, this.env.W_API_KEY);
            await sendMessageMultiPart(this.telefone, reposta.content, this.env.IDEIAS_CASA, this.env.W_API_KEY);

            // TODO gravação de respostas para outro link
            // await fetch("", {
            //     method: "POST",
            //     body: JSON.stringify({
            //         mensagem: this.prompt,
            //         telefone: this.telefone,
            //         nome: this.whatsappUser,
            //         resposta: reposta.content,
            //     })
            // });
        }
    }

}