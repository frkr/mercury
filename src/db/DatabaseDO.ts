export interface DatabaseDO {
    key: string,
    versao: string,

    whatsappUser?: string,
    chat?: MessageChat[],
}
