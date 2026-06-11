# Changelog

Все заметные изменения Flowmaster Core (ЕСЭДО) документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).  
Версионирование — [Semantic Versioning](https://semver.org/lang/ru/) (по тегам git).

## [Unreleased]

### Documentation

- Полный комплект в `docs/`: архитектура, env, CI/CD, runbook, глоссарий, quickstart
- Wiki в `wiki/`: 16 страниц + sidebar для GitHub Wiki
- Индекс: [docs/README.md](docs/README.md) · Wiki: [wiki/Home.md](wiki/Home.md)

### Added

- Облачный license server (`apps/cloud-license-server`): Vercel, кабинет, Cloud Admin
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
