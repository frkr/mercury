import {fetchWithTimeout, JSON_HEADER, readRequestBody} from "./util-js/util";
import {challenge, readMessage, sendMessage, sendMessageMultiPart, sendTemplate} from "./whatsapp-ts/src";
import DurableObjectService from "./db/DurableObjectService";
import {chat} from "./simple-chatgpt/chatgpt";
import {DeleteInstanceSnapshotCommand, GetInstanceSnapshotsCommand, LightsailClient} from "@aws-sdk/client-lightsail";
import {DatabaseDO} from "./db/DatabaseDO";
import {WAAuth} from "./whatsapp-ts";

//region Constants
const amazon = [
    "5511920044039"
];
const status = "status_servidor";
//endregion

export default class {

    //region Boot
    private readonly request: Request;
    private readonly env: Env;
    private readonly dao: DurableObjectService;
    private readonly wauth: WAAuth;
    private data: WhatsAppNotification;
    private telefone: string;
    private prompt: string;
    private tipoMsg: MessageTypes;
    private documento: DatabaseDO;
    private whatsappMessageId: string;
    private whatsappUser: string;

    private proxFluxo: boolean = true;
    private retornoDebug: string;
    private awsConfig: LightsailClient = null;

    constructor(request: Request, env: Env) {
        this.request = request;
        this.env = env;
        this.dao = new DurableObjectService(request.url, 'whatsapp', this.env.WAID);
        this.wauth = {
            apikey: this.env.W_API_KEY,
            accid: this.env.IDEIAS_CASA,
        } as WAAuth;
    }

    boot() {
        this.telefone = this.data.entry[0].changes[0].value.contacts[0].wa_id;
        this.whatsappMessageId = this.data.entry[0].changes[0].value.messages[0].id;
        this.whatsappUser = this.data.entry[0].changes[0].value.contacts[0].profile.name;
    }

    async provisionarIdentificacao() {
        this.documento = await this.dao.verify(this.telefone, "whatsappUser", this.whatsappUser);
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
                    await this.provisionarIdentificacao();

                    if (this.tipoMsg === "text") {

                        this.prompt = this.data.entry[0].changes[0].value.messages[0].text.body;

                        if (this.prompt === 'ping') {

                                this.sendMessage({content: "pong", role: "system"}, false)

                        } else {
                            this.documento = await this.dao.patch(this.telefone, "chat", {
                                role: "user",
                                content: this.prompt,
                            } as MessageChat);

                            await this.debug();

                            if (this.proxFluxo) {

                                await this.gpt();

                            }
                        }

                    } else if (this.tipoMsg === "image") {

                        await this.imageMsg();

                    }
                } else {
                    await sendMessageMultiPart(this.wauth, this.telefone, "_Mensagem não suportada_");
                }

            } else {
                return challenge(this.env.META_VERIFY, this.request);
            }
        } catch (e) {
            console.error("Fluxo WhatsApp: ", e, e.stack);
        }
        return new Response(JSON.stringify(this.data), {status: 200, headers: JSON_HEADER});
    }

    async imageMsg() {
        await sendMessage(
            this.wauth,
            {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: this.telefone,
                type: "image",
                image: {
                    id: this.data.entry[0].changes[0].value.messages[0].image.id
                }
            },
        );
    }

    async gpt() {

        let resposta: MessageChat = await chat(this.telefone, this.documento.chat, this.env.OPENAI_API_KEY);

        this.sendMessage(resposta);
    }

    async sendMessage(resposta: MessageChat, save = true) {
        if (resposta !== null) {
            if (save) {
                await readMessage(this.wauth, this.whatsappMessageId);
                await this.dao.patch(this.telefone, "chat", resposta);
            }
            await sendMessageMultiPart(this.wauth, this.telefone, resposta.content);
        } else {
            await sendMessageMultiPart(this.wauth, this.telefone, '*_Mensagem não entregue_*');
        }
    }

    //region Debug
    async debug() {
        this.retornoDebug = this.prompt;
        if (amazon.includes(this.telefone)) {

            if (this.prompt.toLowerCase() === "debug") {

                this.proxFluxo = false;

                this.documento = await this.dao.put(this.telefone, "chat", [
                    {
                        content: "debug",
                        role: "system"
                    } as MessageChat
                ]);
                await sendMessageMultiPart(this.wauth, this.telefone, "_DEBUG iniciado_");
                await this.sendDebug();

                await readMessage(this.wauth, this.whatsappMessageId);

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
                    await sendTemplate(this.wauth, status, this.telefone, this.retornoDebug);
                } else if (this.prompt.toLowerCase() === "dev") {
                    let resp = await fetchWithTimeout(fetch("http://dev.abaccusapi.com.br:8080/actuator/health"))
                    if (resp !== null && resp.status === 200) {
                        this.retornoDebug = "NOAR Dev";
                    } else {
                        this.retornoDebug = "FORA Dev";
                    }
                    await sendTemplate(this.wauth, status, this.telefone, this.retornoDebug);
                } else if (this.prompt.toLowerCase() === "exit") {
                    await this.dao.delete(this.telefone);

                    await sendMessageMultiPart(this.wauth, this.telefone, "_DEBUG finalizado_");
                } else {
                    this.retornoDebug = "error";
                    await sendMessageMultiPart(this.wauth, this.telefone, "_DEBUG Mensagem não entregue_");
                }
                await readMessage(this.wauth, this.whatsappMessageId);

            }
        }
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
                await sendMessageMultiPart(this.wauth, this.telefone, "_" + e + ": " + snap + "_");
            }
        }

        if (genmq.length > 0) {
            this.retornoDebug = "Snapshots antigos Deletados: \n\n_" + genmq.join("_\n_") + "_";
        } else {
            this.retornoDebug = "_Não há Snapshots antigos_";
        }
        await sendMessageMultiPart(this.wauth, this.telefone, this.retornoDebug);
    }

    async sendDebug() {
        await sendMessageMultiPart(this.wauth, this.telefone, "*gen*\n\n*genc*  _Apagar snapshots_\n\n*dev*\n\n*?*\n\n*exit*");
    }

    //endregion
}