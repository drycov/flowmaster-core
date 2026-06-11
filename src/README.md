# Исходный код ЕСЭДО (`src/`)

```
src/
├── assets/           # Статика для bundler
├── components/       # UI по доменам (document-detail/, admin/, auth/, …)
├── hooks/            # Общие React hooks (минимум — предпочитайте colocated hooks)
├── i18n/             # RU/KK локализация
├── integrations/     # Supabase client, auth middleware, generated types
├── lib/              # Серверная и клиентская бизнес-логика
│   ├── access/       # RBAC, modules registry, route guards
│   ├── api/          # Server Functions (см. lib/api/README.md)
│   ├── auth/         # Sessions, LDAP, policy
│   ├── documents/    # Read model, versions, sidecars
│   ├── license/      # FM1, cloud connect, enforcement
│   ├── workflow/     # Schemas, route builder
│   └── …             # email, telegram, templates, office, …
├── routes/           # TanStack Router (UI + api/* hooks)
├── types/            # Ambient / module augmentations
├── router.tsx
├── server.ts         # HTTP entry
└── start.ts          # Global server-fn middleware
```

## Границы слоёв

| Слой | Путь | Назначение |
|------|------|------------|
| Pages | `routes/` | Тонкие route shells, loaders |
| UI | `components/{feature}/` | React + colocated hooks |
| API | `lib/api/` | `createServerFn` + Zod + auth |
| Domain | `lib/{domain}/*.server.ts` | Переиспользуемая логика без HTTP |
| Data | Supabase + RLS | PostgreSQL |

**Не создавайте** `src/pages/` — routing только через `src/routes/`.
