# UAT — приёмочное тестирование ЕСЭДО



Индекс документации: [README.md](./README.md).



Чеклист для пилотной эксплуатации и внедрения в госсектор / крупный бизнес РК.



## Подготовка среды



### Staging (UAT-стек)



Поднятие: [STAGING.md](./STAGING.md).



- [ ] `npm run env:staging -- --install` + `npm run env:sync`

- [ ] `npm run compose:staging` (cron уже включён в staging compose)

- [ ] Миграции применены (`db-migrate` в compose или `npm run docker:migrate -- --staging`)

- [ ] `npm run uat:preflight` и `npm run uat:smoke`

- [ ] Full smoke + E2E: `E2E_SKIP_SERVER=1 APP_URL=http://localhost:8080 npm run uat:smoke:full`

- [ ] Security routes E2E: `npm run test:e2e:security`

- [ ] Workflow E2E: `E2E_EMAIL` / `E2E_PASSWORD` → `npm run test:e2e`



### Production



- [ ] `npm run env:production -- --domain=... --install`

- [ ] `npm run compose:tls:cron` (HTTPS + cron sidecar)

- [ ] `CRON_SECRET` задан (anon key fallback удалён)

- [ ] `ONLYOFFICE_JWT_ENABLED=true` (общий секрет с Document Server)

- [ ] HTTPS (nginx + Let's Encrypt или внешний proxy)

- [ ] Резервное копирование БД настроено

- [ ] Automated smoke: `npm run uat:smoke` против production URL



### Лицензия



Один из вариантов:



- [ ] **Offline:** ключ `FM1.*` активирован в UI

- [ ] **Online (Vercel):** `LICENSE_MODE=online`, `INSTALLATION_ID` из кабинета, синхронизация в **Настройки → Лицензия**

- [ ] **Online (vendor Docker):** `LICENSE_SERVER_URL` → vendor LS, cron `license-sync`



См. [LICENSE-SERVER.md](./LICENSE-SERVER.md).



## Аутентификация



- [ ] Вход email/password, logout, повторный вход

- [ ] Сессия восстанавливается по HttpOnly cookie после истечения access JWT

- [ ] Переключатель языка RU/KK на экране входа

- [ ] Альтернативные методы: ЭЦП, Telegram (если настроены)

- [ ] LDAP (если включён)

- [ ] ЭЦП / NCALayer (регистрация и вход)

- [ ] Telegram login (если настроен бот)

- [ ] Multi-tenant: вход по slug / поддомену (если `TENANT_BASE_DOMAIN` задан)



## Документы и workflow



- [ ] Создание документа (шаблон и без шаблона)

- [ ] Регистрация, номер в журнале

- [ ] Запуск маршрута, задачи на /tasks

- [ ] Согласование / отклонение

- [ ] Подпись ЭЦП (если в маршруте)

- [ ] Версии, вложения, ONLYOFFICE (если настроен)

- [ ] Гриф доступа: пользователь без уровня не видит контент

- [ ] Временный grant на документ

- [ ] Публикация утверждённого документа в базу знаний (карточка на странице документа)



## База знаний



- [ ] Список статей `/knowledge`, поиск и фильтр по категориям

- [ ] Просмотр статьи, ссылка на исходный документ

- [ ] Создание / редактирование статьи (пользователь с правом `knowledge_base:write`)

- [ ] Управление категориями `/knowledge/manage`

- [ ] Статусы: черновик → опубликовано → архив



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



## Инфраструктура



- [ ] `GET /api/health` → `database: ok` (через nginx и напрямую)

- [ ] nginx проксирует app и Supabase API на одном домене

- [ ] Cron sidecar или системный crontab вызывает hooks (включая `license-sync`)

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

---

Индекс документации: [README.md](./README.md).

