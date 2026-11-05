# WAHA AI reply service

This Bun + TypeScript service receives WAHA `message` webhooks, calls an OpenAI-compatible model,
and sends the reply back through WAHA. Conversation history, event de-duplication,
and per-chat locking are stored in Redis so multiple replicas can share state.

## Run locally

Copy `.env.example` to `.env`, fill in the WAHA, model, and webhook values, then run:

```sh
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:3001/healthz
```

The application runs inside the Docker container with `bun run server.ts`.

The included Redis service stores data in the `waha-ai_redis-data` Docker volume.

## Run multiple machines

Run a shared Redis service that every machine can reach, then set the same
`REDIS_URL` in each machine's `.env`, for example:

```text
REDIS_URL=rediss://:password@redis.example.com:6380/0
WAHA_ACCOUNT_ID=account-a
```

Use the same `WAHA_ACCOUNT_ID` for replicas of one WhatsApp account and a
different ID for a separate account that also uses session `default`. Keep the
same `WAHA_SESSION` and `WEBHOOK_SECRET` for replicas receiving the same WAHA
webhooks. Point WAHA's webhook URL at a load balancer or at all AI replicas.
