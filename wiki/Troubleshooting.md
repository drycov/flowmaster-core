# Troubleshooting

**Полная версия:** [`docs/TROUBLESHOOTING.md`](../docs/TROUBLESHOOTING.md)

## Docker / Kong

```bash
npm run docker:wait
npm run docker:migrate
npm run docker:repair-stamp   # если stamp сломан
```

## Health

```bash
curl http://localhost/api/health
# database: ok — норма
```

## Cron 401

Задайте `CRON_SECRET`. Заголовок: `Authorization: Bearer ...`

## ONLYOFFICE

- Первый старт 2–3 мин
- JWT: одинаковый `ONLYOFFICE_JWT_SECRET` у app и Document Server
- `ONLYOFFICE_JWT_ENABLED=true` на prod

## Лицензия

| Симптом | Проверка |
|---------|----------|
| Read-only | Настройки → Лицензия → Синхронизировать |
| Online | `curl $LICENSE_SERVER_URL/api/v1/license/health` |
| Cloud | `INSTALLATION_ID`, нет `LICENSE_SERVER_ENABLED` на EDMS |

## Grafana

Порт `GRAFANA_PORT` (default 3001) = `MONITORING_GRAFANA_URL`.

## Telegram (cloud LS)

401 на webhook → `VENDOR_TELEGRAM_WEBHOOK_SECRET` + redeploy + `vendor-telegram:webhook`

→ [Operations Runbook](Operations-Runbook) · [Licensing](Licensing)
