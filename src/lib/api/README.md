# Server API (`src/lib/api`)

TanStack **Server Functions** (`createServerFn`) — RPC-слой между UI/routes и доменной логикой.

## Структура

```
api/
├── _helpers.ts              # requireModuleAccess, enforceModuleLicense, …
├── README.md
│
├── admin/                   # Администрирование (users, org, roles, audit, …)
├── auth/                    # Вход, LDAP/EDS/Telegram, vendor admin
├── documents/               # CRUD, версии, подписи, grants, links, attachments
├── shared/                  # document-access, db.helpers, reference types
├── platform/                # system, tenant, org, license, storage, monitoring
├── integrations/            # API keys, webhooks, telegram, office, outbox, bulk
│
├── *.functions.ts           # Доменные модули (hr, workflows, kb, …) + barrel-файлы
└── …                        # Тонкие re-export shims для стабильных import paths
```

## Соглашения

| Правило | Пример |
|---------|--------|
| Импорт из UI/routes | `@/lib/api/admin.functions`, `@/lib/api/documents.functions` |
| Не импортировать внутренние split-файлы | ❌ `@/lib/api/admin/users.functions` |
| Barrel для split-модулей | `admin.functions.ts`, `documents.functions.ts`, `auth.functions.ts` |
| Shared helpers | `@/lib/api/document-access.server`, `@/lib/api/db.helpers.server` |
| Тесты рядом с кодом | `shared/*.test.ts` |
| Deprecated shims | `auth-public.functions.ts` → используйте `auth.functions` |

## Добавление нового модуля

1. Создайте `my-module.functions.ts` в корне `api/` (если модуль небольшой).
2. Для крупного модуля — каталог `my-module/` + barrel `my-module.functions.ts`.
3. Подключите gates: `requireModuleAccess` / `enforceModuleLicense` из `_helpers.ts`.
4. Зарегистрируйте feature в `src/lib/access/modules/registry.ts`.

См. также: [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md), [src/routes/README.md](../../routes/README.md).
