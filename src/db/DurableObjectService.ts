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

import {DurableObjectStub} from "@cloudflare/workers-types";
import {DatabaseDO, OperationDO, PayloadDO} from "./WAID";

export default class DurableObjectService {
    private readonly url: string;
    private readonly dao: DurableObjectStub;

    constructor(url: string, id: string, duobj: DurableObjectNamespace) {
        if (url.endsWith("/")) {
            this.url = url;
        } else {
            this.url = url + "/";
        }
        this.dao = duobj.get(duobj.idFromName(id));
    }

    async all(): Promise<any> {
        return await (await this.dao.fetch(new Request(`${this.url}all`))).json();
    }

    async get(key: string): Promise<DatabaseDO> {
        return await (await this.dao.fetch(new Request(`${this.url}${key}`))).json();
    }

    private async send(key: string, field: string | null, operation: OperationDO, doc): Promise<DatabaseDO> {
        let store = new Request(this.url, {
            method: 'POST',
            body: JSON.stringify({
                key: key,
                field: field,
                operation: operation,
                document: doc,
            } as PayloadDO)
        });
        return (await this.dao.fetch(store)).json();
    }

    async verify(key: string, field: string, value: any): Promise<DatabaseDO> {
        return this.send(key, field, "verify", value);
    }

    async patch(key: string, field: any, value: any): Promise<DatabaseDO> {
        return this.send(key, field, "patch", value);
    }

    async put(key: string, field: string, value: any): Promise<DatabaseDO> {
        return this.send(key, field, "put", value);
    }

    async post(key: string, doc: DatabaseDO): Promise<DatabaseDO> {
        return this.send(key, null, "post", doc);
    }

    async delete(key: string): Promise<DatabaseDO> {
        return this.send(key, null, "delete", []);
    }

}
