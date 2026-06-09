# UAT — приёмочное тестирование ЕСЭДО

Чеклист для пилотной эксплуатации и внедрения в госсектор / крупный бизнес РК.

## Подготовка среды

Поднятие staging: [STAGING.md](./STAGING.md) (`npm run compose:staging`, `npm run uat:preflight`).

- [ ] Миграции применены (`supabase db push`)
- [ ] `CRON_SECRET` задан, hooks работают (email, webhooks, SLA, retention, license-sync)
- [ ] Лицензия `FM1.*` активирована
- [ ] HTTPS, резервное копирование БД
- [ ] Automated smoke: `npm run uat:smoke` (health, cron, DB/RLS regression)
- [ ] E2E smoke: `E2E_EMAIL` / `E2E_PASSWORD` → `npm run test:e2e`

## Аутентификация

- [ ] Вход email/password, logout, повторный вход
- [ ] Сессия восстанавливается по HttpOnly cookie после истечения access JWT
- [ ] LDAP (если включён)
- [ ] ЭЦП / NCALayer (регистрация и вход)
- [ ] Telegram login (если настроен бот)

## Документы и workflow

- [ ] Создание документа (шаблон и без шаблона)
- [ ] Регистрация, номер в журнале
- [ ] Запуск маршрута, задачи на /tasks
- [ ] Согласование / отклонение
- [ ] Подпись ЭЦП (если в маршруте)
- [ ] Версии, вложения, ONLYOFFICE (если настроен)
- [ ] Гриф доступа: пользователь без уровня не видит контент
- [ ] Временный grant на документ

## Администрирование

- [ ] Пользователи, роли, подразделения
- [ ] Шаблоны, номенклатура, справочники
- [ ] Маршруты (workflow designer)
- [ ] Настройки: почта, LDAP, Telegram, интеграции
- [ ] Аудит: действия записываются
- [ ] Failed deliveries (outbox) — повторная отправка

## Интеграции

- [ ] API key: создание, scope, вызов `GET /api/v1/documents`
- [ ] Webhook: подписка, test button, доставка события
- [ ] Batch import (если используется)

## Нефункциональные

- [ ] `GET /api/health` → `database: ok`
- [ ] Логи JSON с `request_id`
- [ ] Sentry: тестовая ошибка попадает в проект (если DSN настроен)
- [ ] Read-only при истечении лицензии / trial
- [ ] Pen-test / security review (см. [SECURITY.md](./SECURITY.md))

## Подписи стейкхолдеров

| Роль | ФИО | Дата | Подпись |
|------|-----|------|---------|
| Заказчик (ИТ) | | | |
| Заказчик (ДОУ) | | | |
| Исполнитель | | | |
