# Multi-tenant в ЕСЭДО (Flowmaster Core)

## Определение

**Multi-tenant** — режим одной инсталляции, в которой **несколько организаций (tenant)** работают на **общей БД и одном приложении**, но видят только **свои данные**.

| Режим | Описание | Типичный сценарий |
|-------|----------|-------------------|
| **Single-tenant** | Одна строка в `organization`, `tenant_mode = 'single'` | On-prem у одного заказчика |
| **Multi-tenant** | Несколько org в одной БД, изоляция по `organization_id` | SaaS, холдинг, интегратор с несколькими клиентами |

Multi-tenant **не означает** отдельную БД или отдельный инстанс app на каждого клиента. Изоляция обеспечивается на уровне:

1. **Схемы PostgreSQL** — колонка `organization_id`, RLS, org-scoped UNIQUE
2. **Сессии** — JWT claim `org_id`, привязка `profiles.organization_id`
3. **Server Functions** — резолв org по slug / Host, проверки в `tenant-*.server.ts`

---

## Модель данных

### Организация (tenant)

Таблица `organization` — корень тенанта:

| Поле | Назначение |
|------|------------|
| `slug` | Уникальный код org (латиница, 2–64 символа). Поддомен и поле входа |
| `tenant_mode` | `'single'` или `'multi'`. Автоматически → `'multi'` при 2+ org |
| `is_active` | `false` — новые входы запрещены |
| `max_users` | Квота пользователей org (опционально) |
| `settings` | Почта, LDAP, Telegram, ONLYOFFICE — **per-tenant** |

### Привязка пользователей

- `profiles.organization_id` — **NOT NULL**, каждый пользователь принадлежит одной org
- Email и ИИН уникальны **внутри org** (`UNIQUE (organization_id, lower(email))`), не глобально
- Регистрация: `register_app_user(..., p_organization_id)` с проверкой квоты `organization_can_add_user()`

### Tenant-scoped таблицы

Доменные сущности несут `organization_id NOT NULL`:

- Документы, workflow, шаблоны, номенклатура, KB, проекты
- Подразделения, должности, HR, графики дежурств
- API keys, webhooks, import jobs, audit logs
- Sidecar-таблицы документов (`document_registration`, …)

**Hybrid-справочники** (`ref_document_types`, `ref_correspondents`, …): строки с `organization_id IS NULL` — глобальный seed; с `organization_id` — override tenant.

### Глобальные объекты (без org)

| Объект | Почему общий |
|--------|--------------|
| `permissions`, `roles`, `role_permissions` | Единый каталог RBAC |
| `installation_license` | Лицензия инсталляции |
| `ref_access_levels`, `ref_department_kinds` | Общие справочники |
| `business_calendar_days` | Календарь праздников РК |
| `app_sessions`, outbox-очереди | service_role only |

---

## Изоляция в PostgreSQL

### Цепочка резолва org

```
jwt_organization_id()     ← JWT claim org_id (сессия app)
        ↓
auth_user_organization_id() ← profiles.organization_id текущего user
        ↓
current_organization_id()   ← единственная org, если count ≤ 1; иначе NULL
        ↓
effective_organization_id() ← COALESCE(выше)
        ↓
tenant_matches(row_org)     ← row_org = effective OR manage_platform
```

Функции RLS живут в схеме `private`; в PostgREST доступны через public SECURITY INVOKER shims.

### RLS

Политики на tenant-таблицах используют `tenant_matches(organization_id)`:

- SELECT/INSERT/UPDATE/DELETE — только строки своей org
- **`manage_platform`** — кросс-тенантный доступ для platform admin (provisioning, support)

Документы: `can_view_document()` / `can_view_document_content()` включают проверку org; write-политики требуют `tenant_matches`.

### Уникальность

Глобальные UNIQUE заменены org-scoped индексами, например:

- `documents (organization_id, reg_number)`
- `departments (organization_id, code)`
- `kb_articles (organization_id, slug)`
- `organization (lower(slug))` — slug уникален на платформе

---

## Приложение

### Резолв tenant при входе

Файлы: `src/lib/access/tenant-public.server.ts`, `tenant-auth.server.ts`, `tenant-host.server.ts`

1. **Поддомен:** `acme.example.kz` → slug `acme` (если задан `TENANT_BASE_DOMAIN=example.kz`)
2. **Поле на форме входа:** «Код организации» (`tenant_slug`)
3. **Single-tenant:** slug не обязателен, берётся единственная org

Контекст auth (`buildPublicTenantAuthContext`):

- `multi_tenant` — true, если org > 1 или `tenant_mode = 'multi'`
- `require_tenant_slug` — true в multi-tenant без резолва по Host
- `resolved_tenant` — org по slug с Host

### JWT и сессия

При логине в access JWT записывается `org_id` (`session.server.ts`). PostgREST читает его через `jwt_organization_id()`.

### Server layer

Admin-списки фильтруются в Server Functions (`tenant-admin.server.ts`, `admin-org.functions.ts`):

- Обычный admin — только своя `organization_id`
- Platform admin (`manage_platform`) — все org

### UI

- **Администрирование → Настройки → Организации** — CRUD org (только `manage_platform`)
- Bootstrap первой org: slug + название при первой регистрации
- Кэш React Query: scope по org (`src/lib/access/tenant.ts`)

---

## Роли

| Роль / permission | Область |
|-------------------|---------|
| `admin` (tenant) | Своя org: пользователи, справочники, документы |
| `platform_admin` / `manage_platform` | Все org: provisioning, квоты, деактивация |
| Primary org | Первая созданная org; platform admin назначается её администраторам |

Администратор tenant-org **не видит** данные других org даже при `is_admin()` — RLS ограничивает `tenant_matches`.

---

## Включение multi-tenant

### 1. Миграции

Tenant-миграции применяются стандартным pipeline:

```bash
npm run docker:migrate          # локальный Docker
npx supabase db push --linked   # Supabase Cloud
```

Ключевые файлы:

| Миграция | Содержание |
|----------|------------|
| `20260612030000_tenant_foundation` | `slug`, `tenant_mode`, `profiles.organization_id` |
| `20260612040000_tenant_isolation` | `organization_id`, helpers, первый RLS sweep |
| `20260612051000_tenant_provisioning` | `is_active`, `register_app_user(p_organization_id)` |
| `20260613160000` … `13170000` | Phase 1 hardening, org-scoped UNIQUE |
| `20260614000000_phase3_tenant_rls_complete` | Integrations, per-tenant email/iin, полный RLS |

### 2. Переменные окружения

```env
# Базовый домен для поддоменов: acme.example.kz → slug acme
TENANT_BASE_DOMAIN=example.kz
# Алиас:
# APP_BASE_DOMAIN=example.kz
```

Без `TENANT_BASE_DOMAIN` поддоменный резолв отключён; вход только по полю «Код организации».

### 3. DNS и nginx

Wildcard DNS: `*.example.kz` → IP сервера.

Nginx должен проксировать с сохранением `Host` — см. [DEPLOYMENT.md](./DEPLOYMENT.md#multi-tenant-wildcard-dns).

### 4. Provisioning новой org

1. Platform admin: **Настройки → Организации → Создать**
2. Задать `slug`, название, опционально `max_users`
3. Пользователи входят на `https://{slug}.example.kz/auth` или с кодом org на общем домене
4. Первый admin org создаётся регистрацией / приглашением в контексте этой org

### 5. Деактивация

`is_active = false` — `resolveOrganizationIdBySlug` отклоняет вход с сообщением «Организация отключена».

---

## Single-tenant (поведение по умолчанию)

После установки:

- Одна org со `slug = 'default'`
- `tenant_mode = 'single'`
- Поле «Код организации» на входе **скрыто**
- `current_organization_id()` возвращает единственную org
- Миграции и RLS совместимы — при добавлении второй org режим переключается автоматически (`sync_tenant_mode` trigger)

---

## Интеграции в multi-tenant

| Компонент | Изоляция |
|-----------|----------|
| API keys | `organization_id`, RLS `tenant_matches` |
| Webhook subscriptions | per-org; outbox доставляет только подпискам той же org |
| Import jobs | per-org |
| LDAP / SMTP / Telegram | `organization.settings` |
| License server | на уровне инсталляции (`installation_license`) |

---

## Ограничения и допущения

- **Один user — одна org.** Перенос пользователя между org — отдельная операция (не self-service).
- **Общий Storage bucket** — изоляция через RLS и paths; не отдельный bucket на org.
- **Platform admin** — доверенная роль; выдавать только администраторам primary org.
- **Реплики app:** `DISABLE_TELEGRAM_POLLING=true` при >1 реплике; cron — один sidecar.

---

## Проверка изоляции

```bash
# Health
curl https://esedo.example.kz/api/health

# Две org — вход под разными slug, убедиться что документы не пересекаются
# Platform admin — видит обе org в настройках
# Tenant admin — не видит чужие org в списках пользователей/документов
```

SQL (service_role / psql):

```sql
-- Колонка slug
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'organization' AND column_name IN ('slug', 'tenant_mode', 'is_active');

-- RLS включён
SELECT relname, relrowsecurity FROM pg_class
 WHERE relname IN ('documents', 'profiles', 'webhook_subscriptions');
```

---

## Связанные документы

| Документ | Тема |
|----------|------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | nginx, DNS, env, wildcard |
| [SECURITY.md](./SECURITY.md) | RLS, JWT, hardening multi-tenant |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | API keys, webhooks per-org |
