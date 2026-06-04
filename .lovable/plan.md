# План: Enterprise EDMS — ядро

Строгий government-стиль (плотный, синий, серьёзный). KZ/RU переключение. Lovable Cloud как backend. Office Web и NCALayer — заглушки с интеграционными точками.

## 1. Инфраструктура

- Включить **Lovable Cloud** (Postgres + Auth + Storage + server functions + Realtime).
- Создать i18n-слой (`lib/i18n.ts`) с словарями `kk` / `ru`, переключатель в шапке, сохранение выбора в localStorage.
- Design system в `src/styles.css`: government blue палитра (`--gov-navy`, `--gov-blue`, `--gov-accent`, `--gov-border`, `--gov-surface`), Inter для UI, плотная типографика, маленькие радиусы (4px), серьёзные тени.

## 2. База данных (Lovable Cloud)

Таблицы с RLS и GRANT:

```text
profiles              -- 1:1 к auth.users (full_name_ru, full_name_kk, position, department_id, locale)
app_role              -- enum: admin, registrar, approver, signer, archivist, viewer
user_roles            -- (user_id, role) — НЕ на profiles, security definer has_role()
departments           -- иерархия организаций/отделов (parent_id)
nomenclature_items    -- дерево (parent_id, code, title_ru, title_kk, retention_years, archive_rule, department_id)
document_templates    -- (name, category, file_path в storage, schema JSONB, version, status)
documents             -- (reg_number, type, status, title_ru, title_kk, nomenclature_id, template_id, current_version, created_by, assigned_to, due_at, sla_status)
document_versions     -- (document_id, version_no, file_path, content_hash, created_by, comment, is_locked)
document_signatures   -- (document_id, version_id, signer_id, signature_type, cert_subject, cert_serial, signed_at, payload, status) — заглушка под NCALayer
document_comments     -- (document_id, author_id, body, parent_id)
workflows             -- (name, version, definition JSONB — узлы/рёбра, status: draft/published)
workflow_runs         -- (workflow_id, document_id, current_node, status, started_at, completed_at)
workflow_tasks        -- (run_id, node_id, assignee_id, action_required, status, due_at, completed_at, decision, comment)
workflow_events       -- (run_id, event_type, payload, actor_id, created_at) — immutable
audit_logs            -- (actor_id, entity_type, entity_id, action, before JSONB, after JSONB, ip, ua, created_at) — append-only
notifications         -- (user_id, type, title, body, link, read_at)
```

Storage buckets: `documents` (private), `templates` (private), `signatures` (private).

RLS: документы видны автору, назначенному, согласующим в активной задаче workflow, и ролям `admin`/`archivist`. Audit/events — read-only для admin. user_roles — read через `has_role()`.

## 3. Workflow Engine

- Definition в JSONB: массив узлов `{id, type, config}` (START / APPROVAL / CONDITION / TASK / TIMER / ESCALATION / NOTIFICATION / SIGNATURE / ARCHIVE / END) + рёбра `{from, to, condition?}`.
- Серверная функция `advance_workflow(run_id, decision)` — двигает по графу, создаёт `workflow_tasks`, пишет `workflow_events` + `audit_logs`, шлёт `notifications`.
- SLA: `due_at` на задачах, серверный cron-like job через периодический серверный fn (запускается при логине + по таймеру на клиенте для активных дашбордов), отмечает просрочки и эскалирует.
- Designer: React Flow, режимы edit / simulate / preview, версионирование (новая версия = снимок definition).

## 4. Template Engine

- Шаблоны DOCX в storage. Схема переменных в JSONB (имя, тип, источник: user/workflow/document/org).
- Генерация: серверная функция загружает DOCX, подставляет переменные через **docxtemplater** (Jinja-like синтаксис {placeholders}, loops, conditions), сохраняет результат как `document_versions`.
- Превью формы: автогенерация по схеме (zod + react-hook-form).
- AI-помощник (Lovable AI Gateway): из текстового описания генерирует JSON-схему переменных и черновой текст шаблона.

## 5. Document Lifecycle

`Template → Generate → Register (auto reg_number) → Workflow start → Tasks/Approvals → (Signature stub) → Archive`.

Каждый переход = `workflow_events` + `audit_logs` + realtime broadcast.

## 6. Realtime

Lovable Cloud Realtime подписки на:
- `documents` (по assigned_to / автору)
- `workflow_tasks` (по assignee_id)
- `notifications` (по user_id)

Toaster + бейджи в навигации.

## 7. Frontend (страницы, FSD-структура)

```
src/routes/
  index.tsx                          → редирект на /dashboard если auth
  auth.tsx                           → login/signup (email+password, Google)
  _authenticated/
    route.tsx                        → managed gate
    dashboard.tsx                    → виджеты: мои задачи, SLA, последние документы, статистика
    documents/
      index.tsx                      → таблица с фильтрами/поиском
      new.tsx                        → выбор шаблона → форма → генерация
      $id.tsx                        → детали: метаданные + workflow граф + версии + комментарии + подписи + audit timeline + (Office iframe stub) + (NCALayer button stub)
    approvals.tsx                    → мои согласования
    tasks.tsx                        → мои задачи
    workflows/
      index.tsx                      → список workflow definitions
      $id.tsx                        → React Flow designer
    nomenclature.tsx                 → дерево номенклатуры (drag-and-drop)
    templates/
      index.tsx                      → список
      $id.tsx                        → редактор схемы + загрузка DOCX
    archive.tsx                      → архивные документы, legal hold
    search.tsx                       → полнотекстовый (Postgres FTS)
    notifications.tsx
    audit.tsx                        → admin only
    admin/
      users.tsx                      → роли, отделы
      departments.tsx
```

Shell: левый sidebar (плотная навигация с иконками + счётчики), верхний bar (поиск, локаль KK/RU, уведомления, профиль).

## 8. Интеграционные точки (заглушки)

- **Office Web**: компонент `<OfficeEditor documentId versionId />` — рендерит iframe на `import.meta.env.VITE_OFFICE_URL` с query (configurable). Server function `/api/office-callback` принимает ONLYOFFICE callback и обновляет версию. Если URL не задан — placeholder с инструкцией.
- **NCALayer**: клиентский модуль `lib/ncalayer.ts` — WebSocket к `wss://127.0.0.1:13579/`, методы `getKeyInfo`, `signCMS`, `signXML`. UI модал подписи с выбором сертификата. Результат пишется в `document_signatures`. Если NCALayer недоступен — понятное сообщение.

## 9. Безопасность

- JWT через Supabase Auth.
- RBAC через `user_roles` + `has_role()` security definer.
- RLS на всех таблицах.
- Audit log на все мутации (триггеры в Postgres + явные записи на критические события).
- Signed URLs для скачивания файлов из storage.

## 10. Дизайн-токены (фрагмент)

```css
--gov-navy: oklch(0.25 0.06 250);       /* основной тёмно-синий */
--gov-blue: oklch(0.45 0.15 250);       /* акцент */
--gov-blue-soft: oklch(0.92 0.03 250);
--gov-accent: oklch(0.55 0.18 30);      /* срочное / красная плашка */
--gov-success: oklch(0.55 0.15 145);
--gov-warning: oklch(0.7 0.15 80);
--gov-border: oklch(0.88 0.01 250);
--gov-surface: oklch(0.98 0.005 250);
--radius: 0.25rem;
```

## 11. Что вне scope первой итерации

- Реальный OCR, Elasticsearch (используем Postgres FTS).
- Реальный PAdES / OCSP / timestamping (метаданные подписи только).
- MFA, SAML, LDAP — позже.
- K8s/Docker/CI — деплой через Lovable.

## 12. Объём

Это большая итерация — ориентировочно 60–90 файлов. Соберу скелет с рабочими CRUD, workflow runner, designer, templates с генерацией, audit, realtime, i18n. Office/NCALayer — кнопки/модалы со state, готовые к подключению.

## После одобрения

1. Включаю Cloud.
2. Миграция БД (все таблицы + RLS + GRANT + триггеры).
3. Auth + RBAC + i18n + дизайн-система + shell.
4. Documents + Templates + Generation.
5. Workflow engine + Designer + Tasks/Approvals.
6. Nomenclature + Archive + Search + Audit + Notifications + Realtime.
7. Интеграционные заглушки Office/NCALayer.
