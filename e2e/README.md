# E2E-тесты (Playwright)

Документация проекта: [docs/README.md](../docs/README.md). Разработка: [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md).

## Установка

```bash
npm run test:e2e:install   # Chromium (один раз)
```

## Запуск

```bash
# В .env корня репозитория:
# E2E_EMAIL=admin@example.com
# E2E_PASSWORD=...

npm run test:e2e
npm run test:e2e:ui          # интерактивный режим
npm run test:e2e:security    # health + security + tenant-isolation (skipped without creds)
```

Без `E2E_EMAIL` / `E2E_PASSWORD` выполняются только публичные сценарии.

### Cross-tenant isolation (опционально)

Пользователь организации B не должен видеть документ организации A:

```bash
# E2E_TENANT_B_EMAIL=user@tenant-b.example
# E2E_TENANT_B_PASSWORD=...
# E2E_CROSS_TENANT_DOCUMENT_ID=<uuid документа в org A>
npm run test:e2e:security
```

DB-проверка без Playwright: `npm run uat:smoke:db` (нужны ≥2 org с пользователями и документами).

RBAC / audit (без браузера):

```bash
npm run uat:verify-rbac
```

## Против staging / CI

```bash
E2E_SKIP_SERVER=1 \
APP_URL=http://localhost:8080 \
E2E_EMAIL=... E2E_PASSWORD=... \
npm run uat:smoke:full
```

GitHub Actions: [docs/CI.md](../docs/CI.md).

## Структура

| Путь | Назначение |
|------|------------|
| `e2e/smoke.spec.ts` | Create document → approve / reject |
| `e2e/workflow-actions.spec.ts` | Approve, reject, return (comment required) |
| `e2e/security-routes.spec.ts` | Route guards |
| `e2e/tenant-isolation.spec.ts` | Cross-tenant isolation |
| `e2e/auth.spec.ts` / `health.spec.ts` | Auth & health |
| `e2e/helpers/auth.ts` | Login helper |
| `e2e/helpers/documents.ts` | Create document with custom route |
| `e2e/helpers/env.ts` | Credentials gates |
| `e2e/helpers/ui.ts` | Radix Select helper |
| `playwright.config.ts` | Конфиг (корень репозитория) |

Smoke-сценарий: вход → документ с маршрутом → согласование / отклонение задачи.
