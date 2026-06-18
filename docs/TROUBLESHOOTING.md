# Troubleshooting

Индекс документации: [README.md](./README.md). Процедуры дежурства: [RUNBOOK.md](./RUNBOOK.md). Термины: [GLOSSARY.md](./GLOSSARY.md).

## Docker / Supabase

### Kong / health не отвечает после `docker:up`

`docker:up` обычно ждёт Kong автоматически. Если health падает по таймауту:

```bash
npm run docker:wait
curl http://localhost:54321/rest/v1/
curl http://localhost/api/health
```

### Миграции не применились / `db-migrate` failed

```bash
npm run docker:migrate
# production TLS:
npm run docker:migrate -- --tls
```

Если stamp в БД рассинхронизирован:

```bash
npm run docker:repair-stamp
npm run docker:migrate
```

### Полный сброс локальных данных

```bash
npm run docker:down
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
npm run env:local
npm run docker:up
```

## ONLYOFFICE

- Первый старт контейнера: 2–3 мин, ~2 GB RAM
- TLS: `npm run compose:tls` (профиль `office` по умолчанию)
- HTTP dev: `npm run docker:up -- --office`
- Callback 401: проверьте `ONLYOFFICE_JWT_ENABLED=true` и **одинаковый** `ONLYOFFICE_JWT_SECRET` у app и Document Server
- Подробнее: [INTEGRATIONS.md](./INTEGRATIONS.md#onlyoffice), [docker/README.md](../docker/README.md#onlyoffice)

## Cron / hooks

### 401 на `/api/public/hooks/*`

- Задайте `CRON_SECRET` в `.env`
- Заголовок: `Authorization: Bearer <CRON_SECRET>`
- Anon key для cron **не используется**

### `license-sync` не срабатывает

- Production: `npm run compose:tls:cron` (profile `cron`)
- Staging: cron включён в `compose:staging` по умолчанию
- Crontab пример: `0 */6 * * *` → `POST .../hooks/license-sync` — см. [DEPLOYMENT.md](./DEPLOYMENT.md#5-cron-jobs-обязательно)

### Replica: upstream sync

На **Local License Server** (не EDMS): `POST /api/public/hooks/license-upstream-sync` — см. [LICENSE-SERVER.md](./LICENSE-SERVER.md#фаза-2-local-license-server-replica--cloud-master).

## Лицензирование

| Симптом | Проверка |
|---------|----------|
| «Лицензия не активна» (online) | `LICENSE_SERVER_URL`, `INSTALLATION_ID`, `LICENSE_MODE=online`; health: `curl $LICENSE_SERVER_URL/api/v1/license/health` |
| Облако Vercel | `installation_id` из `/cabinet`; на EDMS **нет** `LICENSE_SERVER_ENABLED=true` |
| Self-hosted vendor | `compose:license-server` + `LICENSE_SERVER_ENABLED=true` на LS |
| Синхронизация | UI → Настройки → Лицензия → «Синхронизировать»; cron `license-sync` |

Подробнее: [LICENSE-SERVER.md](./LICENSE-SERVER.md).

## Мониторинг (Grafana)

Порт задаётся `GRAFANA_PORT` (по умолчанию **3001** в compose). UI в приложении: **Администрирование → Мониторинг**.

```bash
npm run docker:monitoring
# Grafana: http://127.0.0.1:3001 (если GRAFANA_PORT не переопределён)
```

`MONITORING_GRAFANA_URL` в `.env` должен совпадать с `GRAFANA_PORT`. См. [ENV.md § Мониторинг](./ENV.md).

## Облачный license server (Vercel)

Telegram 401, webhook, Cloud Admin — в репозитории и деплое **z-license** (`https://z-license.vercel.app/admin`).

## Multi-tenant

Вход по поддомену не работает → DNS wildcard, `TENANT_BASE_DOMAIN`, nginx сохраняет `Host`. См. [MULTI-TENANT.md](./MULTI-TENANT.md), [DEPLOYMENT.md](./DEPLOYMENT.md#multi-tenant-wildcard-dns).

## E2E

```bash
npm run test:e2e:install
# .env: E2E_EMAIL, E2E_PASSWORD
npm run test:e2e
```

Без credentials выполняются только публичные тесты.
