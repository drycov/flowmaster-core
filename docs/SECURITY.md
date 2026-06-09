# Безопасность ЕСЭДО

## Модель угроз

- **Single-tenant:** одна организация на инсталляцию
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

PostgreSQL RLS на:
- `documents`, `document_versions`, `workflow_tasks`
- `profiles`, `audit_logs`, `api_keys`
- `kb_articles`, `contract_details`

Опасные RPC отозваны у `anon`/`authenticated` — только `service_role` на сервере.

## Интеграции

| Механизм | Защита |
|----------|--------|
| API keys | `fm_*`, SHA-256 hash, scopes, expiry |
| Webhooks outbound | HMAC-SHA256 `X-Flowmaster-Signature` |
| Cron hooks | `CRON_SECRET` / `Authorization: Bearer` |
| Telegram webhook | `X-Telegram-Bot-Api-Secret-Token` (обязателен) |

## Секреты

| Секрет | Где хранить |
|--------|-------------|
| Service role key | `.env` only |
| JWT secret | `.env` only |
| CRON_SECRET | `.env` only |
| LDAP/SMTP/Telegram | DB `organization.settings` (masked in API) |

Не коммитьте `.env`. Ротируйте `CRON_SECRET` при компрометации.

## Hardening checklist (production)

- [ ] `CRON_SECRET` задан, anon key не используется для cron
- [ ] Telegram webhook secret зарегистрирован
- [ ] `DISABLE_TELEGRAM_POLLING=true` при нескольких репликах
- [ ] HTTPS + HSTS на reverse proxy
- [ ] Supabase RLS policies применены (миграции phase 8+)
- [ ] Лицензия активирована, trial не просрочен
- [ ] `LOG_LEVEL=info`, логи собираются centrally
- [ ] `SENTRY_DSN` + `VITE_SENTRY_DSN` для алертов по 5xx / необработанным ошибкам
- [ ] Security headers (app добавляет `X-Content-Type-Options`, `X-Frame-Options`, …); HSTS на proxy
- [ ] Backup БД настроен
- [ ] Аудит: раздел **Аудит** доступен compliance-офицеру
- [ ] Pen-test / security review перед госсектором

## Отчёт об инциденте

1. Отозвать скомпрометированные API keys
2. Сменить `CRON_SECRET`, `SUPABASE_JWT_SECRET` (invalidate sessions)
3. `logout` всех пользователей (delete `app_sessions`)
4. Проверить `audit_logs`

## Лицензирование

Поддерживаются два режима (`LICENSE_MODE`):

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

| Компонент | Реализация |
|-----------|------------|
| Сервер | Отдельный деплой FlowMaster с таблицами `license_server_*` |
| API | `POST /api/v1/license/activate`, `heartbeat`, `revoke` (admin) |
| Клиент | `LICENSE_SERVER_URL` + cron `license-sync` (phone-home) |
| Отзыв | `npm run license:server -- revoke` → следующий heartbeat блокирует запись |
| Зависимость от сети | Без успешного sync > `offline_grace_hours` (72 ч) — read-only |

**Секреты:**
- `LICENSE_SIGNING_SECRET` — подпись ключей (поставщик + инсталляция)
- `LICENSE_SERVER_ADMIN_SECRET` — только на license server (revoke/register)

## Соответствие (РК)

- ЭЦП / NCALayer — интеграция с НУЦ РК
- Грифы доступа — внутренняя классификация
- Audit trail — неизменяемый журнал действий
- LDAP — корпоративная идентификация
