/*
https://gist.github.com/frkr/96af7780e677e1beb8a33f1ace521b45
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
 */
export interface DatabaseDO {
    key: string,
    stamp: number,
    msgDia: string[],

    identificado: boolean,
    idMsg?: string,
    chat?: MessageChat[],
    chatID?: string,

    nome?: string,

}

export interface PayloadDO {
    key: string,
    field?: string,
    operation: OperationDO,
    document: any,
}

export type OperationDO = "post" | "put" | "patch" | "verify" | "delete";

export class WAID {
    state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
    }

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        let def: DatabaseDO = {
            key: "",
            msgDia: [],
            stamp: 1,
            identificado: false,
        }
        try {
            if (request.url.indexOf("mundial.workers.dev") != -1) {
                if (request.method === "GET") {

                    let url = new URL(request.url);
                    let key = url.pathname.split("/").pop();

                    let store: DatabaseDO = null;
                    try {
                        store = await this.state.storage.get(key);
                    } catch (e) {
                    }

                    if (!store || !store.msgDia) {
                        def = {
                            key: key,
                            msgDia: [],
                            stamp: 1,
                            identificado: false,
                        }
                        await this.state.storage.put(key, def);
                    } else {
                        def = store;
                    }

                } else if (request.method === "POST") {

                    let data: PayloadDO = await request.json();

                    let store: DatabaseDO = await this.state.storage.get(data.key);
                    if (!store || !store.msgDia) {

                        store = {
                            key: data.key,
                            msgDia: [],
                            stamp: 1,
                            identificado: false,
                        }

                    }

                    if (data.operation === "verify") {

                        if (!store[data.field]) {
                            store[data.field] = data.document;
                        }

                    } else if (data.operation === "patch") {

                        if (!store[data.field] || !Array.isArray(store[data.field])) {
                            store[data.field] = []
                        }

                        store[data.field].push(data.document);

                        if (store[data.field].length > 100) {
                            store[data.field] = store[data.field].slice(-50);
                        }
                        if (data.field === 'chat') {
                            let simpleCount = JSON.stringify(store[data.field]).length;
                            while (simpleCount > (12288)) {
                                store[data.field].shift();
                                simpleCount = JSON.stringify(store[data.field]).length;
                            }
                        }

                    } else if (data.operation === "post") {

                        store = data.document;

                    } else if (data.operation === "put") {

                        store[data.field] = data.document;

                    } else if (data.operation === "delete") {

                        await this.state.storage.delete(data.key);

                        return new Response(JSON.stringify(
                            {
                                key: data.key,
                                msgDia: [],
                                stamp: 1,
                                identificado: false,
                            } as DatabaseDO
                        ), {status: 200});

                    }

                    await this.state.storage.put(data.key, store);

                    def = store;
                }
            }
        } catch (error) {
            console.log("UserDoc", error, error.stack);
        }
        return new Response(JSON.stringify(def), {status: 200});
    }
}
