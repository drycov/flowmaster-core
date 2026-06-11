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
| `e2e/*.spec.ts` | Playwright specs |
| `playwright.config.ts` | Конфиг (корень репозитория) |

Smoke-сценарий: вход → документ с маршрутом → согласование задачи.
