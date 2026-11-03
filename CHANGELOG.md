# Changelog

Все заметные изменения Flowmaster Core (ЕСЭДО) документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).  
Версионирование — [Semantic Versioning](https://semver.org/lang/ru/) (по тегам git).

## [Unreleased]

### Added

- E2E: `e2e/workflow-actions.spec.ts` — approve / reject / return с обязательным комментарием
- E2E: `e2e/roles-admin.spec.ts` — список ролей, создание, toggle permission + save
- E2E helper `e2e/helpers/documents.ts` — создание документа с custom route
- Smoke: сценарий reject с карточки документа
- `npm run uat:verify-rbac` — проверка audit triggers, `user_has_permission`, `correlation_id`
- nginx `limit_req` zones (`fm_auth`, `fm_api`) в HTTP и TLS стеках
- `docker/nginx/conf.d/00-rate-limit-zones.conf` + location limits в `flowmaster.conf` / TLS tpl

### Documentation

- Уточнены ограничения in-memory rate-limit при нескольких репликах; nginx как production-контур
- Обновлены `e2e/README.md`, `scripts/README.md`, `docs/SECURITY.md`

### Documentation (ранее)

- Полный комплект в `docs/`: архитектура, env, CI/CD, runbook, глоссарий, quickstart
- Wiki в `wiki/`: 16 страниц + sidebar для GitHub Wiki
- Индекс: [docs/README.md](docs/README.md) · Wiki: [wiki/Home.md](wiki/Home.md)

### Added (ранее)

- Облачный license server вынесен в отдельный проект **z-license** на Vercel (удалён из монорепозитория)
- Online-лицензирование: connect по `installation_id`, телеметрия, replica (Local LS)
- Multi-tenant: RLS, provisioning, wildcard DNS

## Как вести changelog

При релизе:

1. Перенесите пункты из `[Unreleased]` в секцию `[X.Y.Z] — YYYY-MM-DD`
2. Создайте git tag: `git tag vX.Y.Z`
3. Группируйте изменения: `Added`, `Changed`, `Fixed`, `Security`, `Deprecated`, `Removed`

Исторические версии до ведения changelog не восстанавливаются ретроспективно — ориентируйтесь на `git log` и миграции в `supabase/migrations/`.

## Ссылки

- Документация: [docs/README.md](docs/README.md)
- Развёртывание: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- CI/CD: [docs/CI.md](docs/CI.md)
