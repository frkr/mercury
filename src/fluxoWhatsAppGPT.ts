import {fetchWithTimeout} from "./util-js/util";
import {challenge, readMessage, sendMessage, sendMessageMultiPart, sendTemplate} from "./whatsapp-ts/src";
import DurableObjectService from "./db/DurableObjectService";
import {chat} from "./simple-chatgpt/chatgpt";
import {DeleteInstanceSnapshotCommand, GetInstanceSnapshotsCommand, LightsailClient} from "@aws-sdk/client-lightsail";
import {DatabaseDO} from "./db/WAID";

//region Constants
const amazon = [];
const poc_gpt = []
const status = "status_servidor";
//endregion

export default class {

    //region Boot
    private readonly request: Request;
    private readonly env: Env;
    private readonly dao: DurableObjectService;
    private readonly data: WhatsAppNotification;
    private telefone: string;
    private prompt: string;
    private tipoMsg: MessageTypes;
    private documento: DatabaseDO;
    private whatsappMessageId: string;
    private whatsappUser: string;

    private proxFluxo: boolean = true;
    private retornoDebug: string;
    private awsConfig: LightsailClient = null;

    constructor(request: Request, data, env: Env) {
        this.request = request;
        this.data = data;
        this.env = env;
        this.dao = new DurableObjectService(request.url, 'whatsapp', this.env.WAID);
    }

    boot() {
        this.telefone = this.data.entry[0].changes[0].value.contacts[0].wa_id;
        this.whatsappMessageId = this.data.entry[0].changes[0].value.messages[0].id;
        this.whatsappUser = this.data.entry[0].changes[0].value.contacts[0].profile.name;
    }

    //endregion

    async provisionarIdentificacao() {
        this.documento = await this.dao.verify(this.telefone, "nome", this.whatsappUser);
    }

    async fluxo() {
        try {

            if (
                this.request.method === 'POST'
                && this.request.cf.asOrganization === "Facebook" // Cloudflare
            ) {

                this.tipoMsg = null;
                try {
                    this.tipoMsg = this.data.entry[0].changes[0].value.messages[0].type;
                } catch (e) {
                }

                if (this.tipoMsg) {

                    this.boot();
                    await this.provisionarIdentificacao();

                    if (this.tipoMsg === "text") {
                        this.documento = await this.dao.put(this.telefone, "idMsg", this.whatsappMessageId);

                        this.prompt = this.data.entry[0].changes[0].value.messages[0].text.body;

                        this.documento = await this.dao.patch(this.telefone, "chat", {
                            role: "user",
                            content: this.prompt
                        } as MessageChat);

                        await this.debug();

                        if (this.proxFluxo) {

                            await this.gpt();

                        }

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
        let reposta: MessageChat = await chat(this.telefone, this.documento.chat, this.env.OPENAI_API_KEY);

        if (reposta !== null) {
            await readMessage(this.documento.idMsg, this.env.IDEIAS_CASA, this.env.W_API_KEY);
            await this.dao.patch(this.telefone, "chat", reposta);
            await sendMessageMultiPart(this.telefone, reposta.content, this.env.IDEIAS_CASA, this.env.W_API_KEY);
        }
        // else {
        //     await sendMessageMultiPart(this.telefone, "_ChatGPT: Mensagem não entregue_", this.env.IDEIAS_CASA, this.env.W_API_KEY);
        // }
        //TODO analitcs
        // this.env.MERCURY.writeDataPoint({
        //     indexes: [telefone],
        //     blobs: [tipoMsg, prompt, reposta?.response]
        // });
    }

    async debug() {
        this.retornoDebug = this.prompt;
        if (telefones.find(t => t === this.telefone)) {

            if (this.prompt.toLowerCase() === "debug") {

                this.proxFluxo = false;

                this.documento = await this.dao.put(this.telefone, "chat", [
                    {
                        content: "debug",
                        role: "system"
                    } as MessageChat
                ]);
                await sendMessageMultiPart(this.telefone, "_DEBUG iniciado_", this.env.IDEIAS_CASA, this.env.W_API_KEY);
                await this.sendDebug();

                await readMessage(this.documento.idMsg, this.env.IDEIAS_CASA, this.env.W_API_KEY);

            } else if (this.documento.chat[0]?.content === "debug") {

                this.proxFluxo = false;

                if (this.prompt === "?") {
                    await this.sendDebug();
                } else if (this.prompt.toLowerCase() === "genc") {
                    await this.deleteSnaps();
                } else if (this.prompt.toLowerCase() === "gen") {
                    let resp = await fetchWithTimeout(fetch("http://gen.abaccusapi.com.br:8080/actuator/health"))
                    if (resp !== null && resp.status === 200) {
                        this.retornoDebug = "NOAR Genesis";
                    } else {
                        this.retornoDebug = "FORA Genesis";
                    }
                    await sendTemplate(status, this.telefone, this.retornoDebug, this.env.IDEIAS_CASA, this.env.W_API_KEY);
                } else if (this.prompt.toLowerCase() === "dev") {
                    let resp = await fetchWithTimeout(fetch("http://dev.abaccusapi.com.br:8080/actuator/health"))
                    if (resp !== null && resp.status === 200) {
                        this.retornoDebug = "NOAR Dev";
                    } else {
                        this.retornoDebug = "FORA Dev";
                    }
                    await sendTemplate(status, this.telefone, this.retornoDebug, this.env.IDEIAS_CASA, this.env.W_API_KEY);
                } else if (this.prompt.toLowerCase() === "exit") {
                    await this.dao.delete(this.telefone);

                    await sendMessageMultiPart(this.telefone, "_DEBUG finalizado_", this.env.IDEIAS_CASA, this.env.W_API_KEY);
                } else {
                    this.retornoDebug = "error";
                    await sendMessageMultiPart(this.telefone, "_DEBUG Mensagem não entregue_", this.env.IDEIAS_CASA, this.env.W_API_KEY);
                }
                await readMessage(this.documento.idMsg, this.env.IDEIAS_CASA, this.env.W_API_KEY);

            }
        }
        //TODO analitcs
        // if (!proxFluxo) {
        //     this.env.MERCURY.writeDataPoint({
        //         indexes: [telefone],
        //         blobs: ["debug", prompt, retornoDebug]
        //     });
        // }
    }

    awsClient(): LightsailClient {
        if (this.awsConfig === null) {
            this.awsConfig = new LightsailClient({
                region: this.env.AWS_REGION,
                credentials: {
                    accessKeyId: this.env.AWS_KEY_ID,
                    secretAccessKey: this.env.AWS_KEY_ACC
                }
            })
        }
        return this.awsConfig;
    }

    async deleteSnaps() {

        let response =
            await this.awsClient().send(new GetInstanceSnapshotsCommand({}))

        let genmq = response.instanceSnapshots
            .filter(snap => snap.fromInstanceName === "gen-mq")
            .filter(snap => snap.name !== "gen-mq-snapshot")
            .map(snap => snap.name)
            .sort()

        if (genmq.length > 2) {
            genmq = genmq.slice(0, -2)
        } else {
            genmq = []
        }

        for (const snap of genmq) {
            try {
                await this.awsClient().send(new DeleteInstanceSnapshotCommand({
                    instanceSnapshotName: snap
                }))
            } catch (e) {
                await sendMessageMultiPart(this.telefone, "_" + e + ": " + snap + "_", this.env.IDEIAS_CASA, this.env.W_API_KEY);
            }
        }

        if (genmq.length > 0) {
            this.retornoDebug = "Snapshots antigos Deletados: \n\n_" + genmq.join("_\n_") + "_";
        } else {
            this.retornoDebug = "_Não há Snapshots antigos_";
        }
        await sendMessageMultiPart(this.telefone, this.retornoDebug, this.env.IDEIAS_CASA, this.env.W_API_KEY);
    }

    async sendDebug() {
        await sendMessageMultiPart(this.telefone, "*gen*\n\n*genc*  _Apagar snapshots_\n\n*dev*\n\n*?*\n\n*exit*", this.env.IDEIAS_CASA, this.env.W_API_KEY);
    }

}