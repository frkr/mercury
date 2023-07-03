/**
 * Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
 * MY_KV_NAMESPACE: KVNamespace;
 *
 * Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
 * MY_DURABLE_OBJECT: DurableObjectNamespace;
 *
 * Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
 * MY_BUCKET: R2Bucket;
 *
 * Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
 * MY_SERVICE: Fetcher;
 */

interface Env {
    WAID: DurableObjectNamespace
    GRGPT: Fetcher;

    W_API_KEY: string
    META_VERIFY: string
    CELL_DEMO: string
    IDEIAS_CASA: string
    OPENAI_API_KEY: string
    AWS_KEY_ID: string
    AWS_KEY_ACC: string
    AWS_REGION: string
}
