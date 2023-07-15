# Mercury Webhook

## Setup

### Submodules

```shell
git submodule init
git submodule update --recursive --remote
```

### Environment Variables

- https://developers.cloudflare.com/workers/platform/environment-variables/
- [Wrangler](wrangler.toml)

```shell
echo VALUE | wrangler secret put W_API_KEY
echo VALUE | wrangler secret put META_VERIFY
echo VALUE | wrangler secret put CELL_DEMO
echo VALUE | wrangler secret put CELL_FACEBOOK
echo VALUE | wrangler secret put IDEIAS_CASA
echo VALUE | wrangler secret put OPENAI_API_KEY
echo VALUE | wrangler secret put AWS_KEY_ID
echo VALUE | wrangler secret put AWS_KEY_ACC
echo VALUE | wrangler secret put AWS_REGION


```

### TODO

- https://developers.cloudflare.com/workers/platform/deploy-button/

