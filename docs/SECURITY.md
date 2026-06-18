# Безопасность ЕСЭДО

Индекс документации: [README.md](./README.md). Переменные: [ENV.md](./ENV.md).

## Модель угроз

- **Single-tenant (по умолчанию):** одна организация на инсталляцию
- **Multi-tenant:** несколько org на одной БД; изоляция через `organization_id`, RLS `tenant_matches`, JWT `org_id` — см. [MULTI-TENANT.md](./MULTI-TENANT.md)
- **Доступ:** аутентифицированные пользователи + API keys + cron secret
- **Данные:** грифы доступа, RLS, audit log

## Аутентификация

| Метод | Описание |
|-------|----------|
| Email/password | bcrypt в PostgreSQL, политика паролей в настройках |
| LDAP/AD | `ldapts`, domain policy, auto-provision |
| ЭЦП (NCALayer) | Challenge + server-side CMS verify, IIN binding |
| Telegram | Out-of-band confirm, pre-linked account |

### Сессии

- **Access JWT** (короткий TTL, по умолчанию 60 мин, `ACCESS_TOKEN_TTL_MINUTES`) + `sid` в `app_sessions`
- **Refresh token** — opaque, HttpOnly cookie `fm_refresh` (срок = `session_ttl_hours` в настройках auth)
- Logout отзывает сессию в БД и очищает cookie
- Access token в `localStorage` для Supabase RPC; обновляется через `POST refreshAccessToken` по cookie

**Рекомендации production:**
- `SUPABASE_JWT_SECRET` только на сервере
- `ACCESS_TOKEN_TTL_MINUTES=60` (или меньше)
- `session_ttl_hours` — максимальный срок «запомнить устройство»
- HTTPS everywhere (cookie `Secure` в production)
- TLS на nginx (`docker-compose.tls.yml`) или внешнем reverse proxy
- `.env` / `.env.production` — только на сервере, в `.gitignore`

### Rate limiting (app layer)

In-memory лимиты на server functions аутентификации (`src/lib/auth/rate-limit.server.ts`):

| Scope | По IP | По аккаунту (email/username) |
|-------|-------|------------------------------|
| login (email/LDAP/EDS/Telegram) | 10 / 15 мин | 5 / 15 мин |
| register | 5 / час | 3 / час |
| EDS challenge | 20 / 15 мин | — |
| refresh token | 60 / 15 мин | — |
| password reset (Telegram) | 5–10 / час | 3–5 / час |
| vendor admin login | 5 / 15 мин | — |

Ключ IP: `X-Forwarded-For` (первый hop) или `X-Real-IP`. При нескольких репликах счётчики **per-process** — для строгого лимита нужен shared store (Redis) или nginx `limit_req`.

Отключение: `AUTH_RATE_LIMIT_ENABLED=false` (только для dev/test).

GoTrue (Supabase Auth) имеет собственные лимиты на `/token` и email — см. `docker/supabase/CONFIG.md`.

## Авторизация

### RBAC

- Роли: admin, registrar, approver, signer, archivist, viewer
- 19 permissions через `user_has_permission()` RPC
- Admin — полный доступ

### Грифы (access levels)

- `profiles.access_level_id` vs `documents.access_level_id`
- `can_view_document()` — метаданные
- `can_view_document_content()` — контент, версии, подписи
- Storage buckets aligned с `can_view_document_content()`

### Временные grants

- `document_access_grants` — request/approve workflow

## RLS

PostgreSQL RLS на tenant-таблицах с предикатом `tenant_matches(organization_id)`:

- `documents`, `document_versions`, `workflow_tasks`, sidecars
- `profiles`, `audit_logs`, `api_keys`, `webhook_subscriptions`, `import_jobs`
- `kb_articles`, `departments`, `leave_requests`, …

**Multi-tenant:** пользователь видит только строки своей org; `manage_platform` — исключение для platform admin. Email/ИИН уникальны per-org.

Опасные RPC отозваны у `anon`/`authenticated` — только `service_role` на сервере.

Подробнее: [MULTI-TENANT.md](./MULTI-TENANT.md#изоляция-в-postgresql).

## Интеграции

| Механизм | Защита |
|----------|--------|
| API keys | `fm_*`, SHA-256 hash, scopes, expiry |
| Webhooks outbound | HMAC-SHA256 `X-Flowmaster-Signature` |
| Cron hooks | `CRON_SECRET` / `Authorization: Bearer` (обязателен, без fallback на anon key) |
| ONLYOFFICE callback | `ONLYOFFICE_JWT_ENABLED=true` + JWT от Document Server; проверка document key + SSRF allowlist |
| Telegram webhook | `X-Telegram-Bot-Api-Secret-Token` (обязателен) |

## Секреты

| Секрет | Где хранить |
|--------|-------------|
| Service role key | `.env` / `.env.production` only |
| JWT secret | `.env` only |
| CRON_SECRET | `.env` only |
| LDAP/SMTP/Telegram | DB `organization.settings` (masked in API) |

Не коммитьте `.env`, `.env.production`. Ротируйте `CRON_SECRET` при компрометации.

## Hardening checklist (production)

- [ ] `AUTH_RATE_LIMIT_ENABLED` не отключён на production (или nginx `limit_req` на `/auth`)
- [ ] `ONLYOFFICE_JWT_ENABLED=true` на production (общий `ONLYOFFICE_JWT_SECRET` у app и Document Server)
- [ ] Cron sidecar: `docker compose -f docker-compose.tls.yml --profile cron up -d`
- [ ] Telegram webhook secret зарегистрирован
- [ ] `DISABLE_TELEGRAM_POLLING=true` при нескольких репликах
- [ ] HTTPS + HSTS на reverse proxy (Docker nginx TLS или внешний nginx)
- [ ] `PROXY_DOMAIN` / Let's Encrypt или корпоративный сертификат
- [ ] `APPLY_DB_SEED=0` на production
- [ ] `ENABLE_EMAIL_AUTOCONFIRM=false` на production
- [ ] Supabase RLS policies применены (миграции phase 8+, tenant phase 3: `20260614000000`)
- [ ] Multi-tenant: `TENANT_BASE_DOMAIN` и wildcard DNS настроены; platform admin только у primary org — [MULTI-TENANT.md](./MULTI-TENANT.md)
- [ ] Лицензия активирована, trial не просрочен
- [ ] `LOG_LEVEL=info`, логи собираются centrally
- [ ] `SENTRY_DSN` + `VITE_SENTRY_DSN` для алертов по 5xx / необработанным ошибкам
- [ ] Security headers (app добавляет `X-Content-Type-Options`, `X-Frame-Options`, …); HSTS на proxy
- [ ] Backup БД настроен
- [ ] Аудит: раздел **Аудит** доступен compliance-офицеру
- [ ] Pen-test / security review перед госсектором

## Отчёт об инциденте

Пошаговый runbook: [RUNBOOK.md § Инцидент безопасности](./RUNBOOK.md#security-incident).

1. Отозвать скомпрометированные API keys
2. Сменить `CRON_SECRET`, `SUPABASE_JWT_SECRET` (invalidate sessions)
3. `logout` всех пользователей (delete `app_sessions`)
4. Проверить `audit_logs`

## Лицензирование

Поддерживаются три режима (`LICENSE_MODE`):

| Режим | Описание |
|-------|----------|
| `offline` | Локальная проверка подписи `FM1.*` (по умолчанию) |
| `online` | Активация и heartbeat через license server поставщика |
| `hybrid` | Сначала online, при недоступности сервера — offline fallback |

### Offline (on-prem без интернета)

| Компонент | Реализация |
|-----------|------------|
| Ключ | Подписанный `FM1.*` (HMAC-SHA256) |
| Генерация | `npm run license:generate` у поставщика |
| Активация | UI → проверка подписи → `installation_license` |

### Online (license server)

Варианты деплоя (облако / Docker vendor / replica): [LICENSE-SERVER.md](./LICENSE-SERVER.md), [docs/README.md](./README.md#лицензирование).

| Компонент | Реализация |
|-----------|------------|
| API | `POST /api/v1/license/connect` (облако), `activate`, `heartbeat`, `revoke` (admin) |
| Клиент | `LICENSE_SERVER_URL` + cron `license-sync` (phone-home) |
| Отзыв | Admin UI / `npm run license:server -- revoke` → следующий heartbeat блокирует запись |
| Зависимость от сети | Без успешного sync > `offline_grace_hours` (72 ч) — read-only |
| Телеметрия | Агрегированные метрики в heartbeat (без ПДн) — [LICENSE-SERVER.md](./LICENSE-SERVER.md#телеметрия-использования) |

**Секреты:**
- `LICENSE_SIGNING_SECRET` — подпись FM1-ключей (поставщик + инсталляция)
- `LICENSE_SERVER_ADMIN_SECRET` — только на license server (machine API, revoke/register)
- `VENDOR_TELEGRAM_*` — **отдельный** бот вендора для Cloud Admin (не `TELEGRAM_BOT_TOKEN` EDMS)

См. также: [README.md](./README.md), [RUNBOOK.md § Security](./RUNBOOK.md#security-incident).

## Соответствие (РК)

- ЭЦП / NCALayer — интеграция с НУЦ РК
- Грифы доступа — внутренняя классификация
- Audit trail — неизменяемый журнал действий
- LDAP — корпоративная идентификация
