# Runbook (эксплуатация)

**Полная версия:** [`docs/RUNBOOK.md`](../docs/RUNBOOK.md)

## Диагностика

```bash
curl -sf https://esedo.example.kz/api/health | jq
docker compose -f docker-compose.tls.yml ps
docker compose logs --tail=100 app
```

## Backup (ежедневно)

```bash
docker exec supabase-db pg_dump -U postgres -Fc postgres > backup-$(date +%Y%m%d).dump
tar -czf storage-$(date +%Y%m%d).tar.gz -C docker/supabase/volumes storage/
```

## Restore БД

```bash
npm run compose:tls:down
docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists < backup.dump
npm run compose:tls:cron
```

## Инциденты

| Уровень | Действие |
|---------|----------|
| **P1** | health → logs → restart app → restore backup |
| **P2** | Sentry/Grafana, ONLYOFFICE, cron |
| **P3** | Лицензия: UI → sync → `license-sync` |
| **Security** | Отозвать API keys → ротировать secrets → audit_logs |

→ [Security](Security) · [Troubleshooting](Troubleshooting)

## Плановое

- Ежедневно: health + backup
- Еженедельно: диск, storage backup, smoke на staging
