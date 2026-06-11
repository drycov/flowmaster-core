# Runbook (эксплуатация)

Индекс документации: [README.md](./README.md).

Процедуры для дежурного администратора и ИТ-отдела заказчика. Типовые сбои — [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Быстрая диагностика

```bash
# Health через nginx
curl -sf https://esedo.example.kz/api/health | jq

# Kong / Supabase API
curl -sf http://localhost:54321/rest/v1/ -H "apikey: $ANON_KEY"

# Контейнеры
docker compose -f docker-compose.tls.yml ps

# Логи app (последние 100 строк)
docker compose -f docker-compose.tls.yml logs --tail=100 app
```

Ожидаемый health: `"ok": true`, `"database": "ok"`.

| Симптом | Первая проверка |
|---------|-----------------|
| 502 / timeout | `docker compose ps`, nginx logs |
| `database: error` | `supabase-db` running, `docker:migrate` |
| Cron не работает | `CRON_SECRET`, profile `cron`, hooks 401 |
| Read-only режим | Лицензия / trial — [LICENSE-SERVER.md](./LICENSE-SERVER.md) |
| ONLYOFFICE не открывается | profile `office`, JWT secret |

## Плановые операции

### Ежедневно

- [ ] `/api/health` → OK
- [ ] Backup БД выполнен (см. ниже)
- [ ] Алерты Sentry / мониторинг без критических 5xx

### Еженедельно

- [ ] Backup Storage (если много вложений)
- [ ] Проверка диска: `df -h`, тома `docker/supabase/volumes/`
- [ ] `npm run uat:smoke` на staging (или production после окна обслуживания)

### Обновление версии

```bash
cd /opt/flowmaster-core   # путь на сервере
git pull
npm run docker:migrate -- --tls
npm run compose:tls:cron
curl -sf https://esedo.example.kz/api/health
APP_URL=https://esedo.example.kz npm run uat:smoke
```

Или: `npm run deploy:production` — см. [CI.md](./CI.md).

**Откат** при неудачном релизе:

```bash
git checkout <previous-tag-or-commit>
npm run docker:migrate -- --tls    # только если миграции обратимы
npm run compose:tls:cron
```

Если миграция необратима — восстановление из backup (ниже).

<a id="backup"></a>

## Backup

### PostgreSQL

```bash
# Создание (ежедневно, хранить ≥30 дней)
docker exec supabase-db pg_dump -U postgres -Fc postgres > \
  "backup-$(date +%Y%m%d-%H%M).dump"

# Проверка размера
ls -lh backup-*.dump
```

`-Fc` — custom format (сжатие, selective restore). Альтернатива plain SQL:

```bash
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
```

### Storage (файлы)

```bash
tar -czf "storage-$(date +%Y%m%d).tar.gz" \
  -C docker/supabase/volumes storage/
```

### Секреты и конфиг

| Объект | Где хранить |
|--------|-------------|
| `.env` | Secrets manager / encrypted vault (не git) |
| FM1-ключи, installation_id | У вендора + запись у заказчика |
| SSL certs | Let's Encrypt auto (certbot) или корп. PKI |

Настройки org (SMTP, LDAP, Telegram) — **в БД**, попадают в pg_dump.

## Восстановление

### Восстановление БД (полная замена)

**Внимание:** остановите app перед restore. Downtime обязателен.

```bash
npm run compose:tls:down    # или docker:down:tls

# Restore в пустую БД или поверх (осторожно с -c clean)
docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists \
  < backup-YYYYMMDD.dump

# Или plain SQL:
# docker exec -i supabase-db psql -U postgres -d postgres < backup.sql

npm run compose:tls:cron
curl -sf https://esedo.example.kz/api/health
```

Проверка: вход admin, открытие документа, список задач.

### Восстановление Storage

```bash
npm run compose:tls:down
rm -rf docker/supabase/volumes/storage/*
tar -xzf storage-YYYYMMDD.tar.gz -C docker/supabase/volumes/
npm run compose:tls:cron
```

### Полный сброс (только dev / катастрофа с потерей volumes)

```bash
docker compose -f docker-compose.tls.yml down -v
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
npm run env:production -- --domain=... --install
npm run compose:tls:cron
# Восстановить backup.sql / .dump
```

## Инциденты

### P1 — система недоступна

1. Health + `docker compose ps`
2. `docker compose logs nginx app supabase-db --tail=200`
3. Диск / RAM: `df -h`, `free -h`
4. Перезапуск app: `docker compose restart app`
5. Если БД corrupt — restore из последнего backup
6. Зафиксировать в журнале инцидента (время, действия, root cause)

### P2 — деградация (медленно, частичный функционал)

1. `LOG_LEVEL=debug` временно на staging, воспроизвести
2. Sentry / Grafana — spike 5xx или latency
3. ONLYOFFICE / cron / email outbox — см. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### P3 — лицензия / read-only

1. **Настройки → Лицензия** — статус, «Синхронизировать»
2. Online: `curl $LICENSE_SERVER_URL/api/v1/license/health`
3. Cron `license-sync` в логах cron sidecar
4. Облако: проверить `INSTALLATION_ID` в кабинете Vercel
5. Эскалация вендору с `installation_id` и логом heartbeat

<a id="security-incident"></a>

### Инцидент безопасности

См. [SECURITY.md § Отчёт об инциденте](./SECURITY.md#отчёт-об-инциденте):

1. Отозвать скомпрометированные API keys (Администрирование → Интеграции)
2. Ротировать `CRON_SECRET`, `SUPABASE_JWT_SECRET` (`env:production --rotate-secrets`)
3. Инвалидировать сессии: удалить `app_sessions` или mass logout
4. Анализ `audit_logs`
5. При утечке `.env` — полная ротация секретов + смена паролей admin

```bash
# Пример: ротация env на сервере
npm run env:production -- --domain=esedo.example.kz --email=... --rotate-secrets --force --install
npm run compose:tls:cron
```

## Cron hooks (ручной запуск)

```bash
export APP_URL=https://esedo.example.kz
export CRON_SECRET=...

curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/public/hooks/email-dispatch"

curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/public/hooks/license-sync"
```

Полный список: [DEPLOYMENT.md § Cron](./DEPLOYMENT.md#5-cron-jobs-обязательно), `scripts/cron-examples.sh`.

## Контакты и эскалация

| Уровень | Кому | Когда |
|---------|------|-------|
| L1 | ИТ заказчика | Health, restart, backup verify |
| L2 | Вендор (Zeus) | Лицензия, миграции, баги приложения |
| L3 | Вендор + НУЦ/интегратор | ЭЦП, LDAP, госсектор compliance |

Заполните контакты вашей организации во внутреннем wiki; в репозитории не хранятся телефоны/email production.

## Чеклист после инцидента

- [ ] Root cause записан
- [ ] Backup проверен после restore
- [ ] Smoke: `uat:smoke` или ручной login → документ
- [ ] Секреты ротированы (если security incident)
- [ ] Post-mortem для P1 (внутренний документ)

## Связанные документы

| Документ | Тема |
|----------|------|
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Типовые ошибки и фиксы |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Backup overview, TLS |
| [CI.md](./CI.md) | Deploy pipeline |
| [GLOSSARY.md](./GLOSSARY.md) | Термины |
| [ENV.md](./ENV.md) | Переменные для диагностики |
