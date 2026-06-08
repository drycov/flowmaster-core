## Scope

Пять связанных задач по завершению рефакторинга оргструктуры, ролей и workflow.

---

### 1. Кнопки Approve / Reject / Return на странице документа

Файлы: `src/routes/_authenticated/documents/$id.tsx`, `src/components/document-detail/*`, `src/lib/api/documents.functions.ts` (+ `workflows.functions.ts`).

- Серверная функция `advanceWorkflowTask({ task_id, decision, comment })` с `requireSupabaseAuth`:
  - проверка, что задача назначена текущему пользователю (через `resolve_workflow_assignees` или `workflow_tasks.assignee_id`);
  - генерация `correlation_id = crypto.randomUUID()`;
  - в транзакции: `UPDATE workflow_tasks SET status, decision, completed_at`, вставка `workflow_events`, вставка строки в `audit_logs` с `correlation_id`, action `workflow.{approve|reject|return}`;
  - вычисление следующего узла: approve → следующий, reject → terminal `rejected`, return → переход на узел инициатора, обновление `documents.status` и `workflow_runs.current_node`.
- Универсальная политика: audit-trigger уже пишет CRUD, но действия workflow добавляем явной строкой (action `workflow.*`), плюс единый `correlation_id`, связывающий все строки одного решения.
- UI: в `WorkflowCard` блок «Моё действие» с тремя кнопками + `<Textarea>` для комментария (для Reject/Return — обязательный). Только если есть активная `workflow_tasks` на текущем пользователе. После успеха — `queryClient.invalidateQueries`.

### 2. Админ-редактор ролей + матрица permissions + временные grant'ы

Файлы: `src/routes/_authenticated/admin/roles.tsx` (рефактор), новые сервер-функции в `src/lib/api/admin.functions.ts`.

- Server fns под `requirePermission('manage_users')`:
  - `listRoles`, `upsertRole({ code, name, kind, parent_role_id, is_active })`;
  - `setRolePermissions({ role_id, permission_codes[] })` — replace-all в `role_permissions`;
  - `listUserGrants({ user_id })`, `grantRole({ user_id, role_id, expires_at?, reason? })`, `revokeGrant({ grant_id, reason? })` (ставит `revoked_at = now()`).
- UI: две колонки — список ролей слева, справа матрица `permissions × checkbox` (читается из `permissions`). Под матрицей — список grants с колонками user, granted_at, expires_at, revoked_at, кнопки «Выдать» (диалог: user select + срок) и «Отозвать».
- Все мутации идут через сервер; никаких прямых `supabase.from('roles')` из клиента.

### 3. Конструктор маршрута на `/documents/new`

Файлы: `src/components/document-new/components/RoutePickerCard.tsx` (расширить), `src/components/document-new/hooks/useDocumentCreation.ts`, `documents.functions.ts`.

Три режима:
- `inherit` — использовать `template.default_workflow_id` без изменений;
- `modify` — взять `workflow.definition`, показать список узлов, позволить переопределить `assignee_mode/ref` и удалить опциональные узлы (`is_required = false`);
- `custom` — собрать линейный маршрут с нуля: добавить узел (assignee_mode + ref, SLA, required), drag-up/down не нужен — кнопки ↑/↓.

При сабмите:
- `inherit` → ничего не пишем в `custom_route`;
- иначе `documents.custom_route = { nodes: [...] }` (jsonb), server fn при старте workflow читает custom если есть.
- Доступ к режиму `modify/custom` блокируется, если `template.allow_custom_route = false`.

### 4. Workflow Designer: UI assignee_mode

Файлы: `src/components/workflow-designer/components/NodeEditSheet.tsx`, `utils/mappers.ts`, `workflows.functions.ts`.

- В `NodeEditSheet`: `<Select>` `assignee_mode` из 8 вариантов:
  `user`, `position`, `department`, `department_head`, `parent_department_head`, `initiator_manager`, `role`, `group`.
- В зависимости от mode показывать соответствующий picker:
  - user → `Combobox` пользователей;
  - position → справочник `positions`;
  - department / department_head / parent_department_head → справочник `departments`;
  - role → справочник `roles`;
  - initiator_manager → без ref.
- Поля сохраняются в `node.data.assignee_mode` / `node.data.assignee_ref`. Маппер обновить, чтобы старое поле `assignee_user_id` мигрировалось в `{ mode: 'user', ref }`.
- Добавить `sla_hours`, `is_required`, `escalation_role` (опционально) — пробросить в `node.data`.

### 5. Проверка состояния (RBAC / immutable assignments / audit)

Без правки кода — серия read-queries и при необходимости патчи:
- `select * from pg_trigger where tgname like 'audit_%'` — убедиться, что триггер на `documents`, `workflows`, `roles`, `user_role_grants`, `profile_assignments`, `departments`, `positions`.
- `select user_has_permission(...)` для тестового пользователя по нескольким permission'ам.
- `select * from profile_assignments` — проверить, что `terminateAssignment` пишет новую строку (не UPDATE) и старая primary закрывается триггером.
- `select * from audit_logs order by created_at desc limit 20` — наличие `correlation_id` на новых строках.
- Найденные пробелы оформить отдельным мини-патчем (например, недостающий audit_trigger на таблице).

---

### Порядок выполнения

1. Серверные функции (advance workflow + roles/grants).
2. БД-проверки + добавление недостающих триггеров (если найдутся), `correlation_id` миграция уже сделана.
3. UI: WorkflowCard действия → Roles editor → NodeEditSheet → RoutePicker (modify/custom).
4. Smoke-test через invoke-server-function на ключевых сценариях.

### Намеренные исключения

- Drag-and-drop в RouteBuilder.
- Параллельные ветки и условия в custom-маршруте (только линейная цепочка).
- E2E-тесты и i18n новых строк (русский inline).
- Эскалации по SLA (поле сохраняем, движок — отдельно).
