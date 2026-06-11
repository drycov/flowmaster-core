# CI/CD

**Полная версия:** [`docs/CI.md`](../docs/CI.md)

## GitHub Actions

Файл: `.github/workflows/ci.yml`

| Job | Условие |
|-----|---------|
| `build` | всегда: lint, typecheck, test, build |
| `smoke-db` | secrets Supabase |
| `e2e` | E2E user + Supabase |
| `smoke-staging` | STAGING_APP_URL + полный smoke |

## Secrets (GitHub)

- `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`
- `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_PUBLISHABLE_KEY`, `E2E_SUPABASE_JWT_SECRET`
- `STAGING_APP_URL`, `CRON_SECRET`

## Локальный smoke

```bash
npm run uat:smoke
npm run uat:smoke:db
APP_URL=... npm run uat:smoke:full
```

## Production deploy

```bash
npm run deploy:production
# или вручную: git pull → migrate → compose:tls:cron → uat:smoke
```

Чеклист релиза — в `docs/CI.md`.

→ [CHANGELOG](../CHANGELOG.md)
