# Развёртывание

**Полная версия:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

## Production (Docker TLS)

```bash
npm run env:production -- \
  --domain=esedo.example.kz \
  --email=admin@example.kz \
  --install

npm run compose:tls:cron
curl https://esedo.example.kz/api/health
```

## Облачная лицензия

```bash
npm run env:production -- \
  --domain=esedo.example.kz \
  --with-license-server \
  --installation-id=<uuid> \
  --install
```

→ [Licensing](Licensing)

## Cron (обязательно)

Profile `cron` или crontab. Hooks с `Authorization: Bearer $CRON_SECRET`:

- `email-dispatch`, `webhook-dispatch`, `sla-tick`, `retention-tick`
- **`license-sync`** — каждые 6 ч

## Обновление

```bash
git pull
npm run docker:migrate -- --tls
npm run compose:tls:cron
npm run uat:smoke
```

Shell-деплой: `npm run deploy:production` → `docs/CI.md`

## Env

Генерировать, не править шаблон вручную: `npm run env:production`.

→ [Environment Variables](Environment-Variables) · [CI/CD](CI-CD)
