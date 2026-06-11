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
npm run test:e2e:security    # health + security routes only
```

Без `E2E_EMAIL` / `E2E_PASSWORD` выполняются только публичные сценарии.

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
