# Mercury Webhook

```textmate
Porenquanto, o webhook está sendo usado para receber as requisições do facebook e enviar para o chatgpt e responder ao whatsapp.
```

## Setup

### Submodules

```shell
# git submodule init
git submodule update --recursive --remote
```

### Environment Variables

- https://developers.cloudflare.com/workers/platform/environment-variables/
- [Wrangler](wrangler.toml)

```shell
#echo <VALUE> | wrangler secret put <NAME>
wrangler secret put <NAME>

```

```shell
echo VALUE | wrangler secret put W_API_KEY
echo VALUE | wrangler secret put META_VERIFY
echo VALUE | wrangler secret put CELL_DEMO
echo VALUE | wrangler secret put IDEIAS_CASA
echo VALUE | wrangler secret put OPENAI_API_KEY
echo VALUE | wrangler secret put AWS_KEY_ID
echo VALUE | wrangler secret put AWS_KEY_ACC
echo VALUE | wrangler secret put AWS_REGION

```
