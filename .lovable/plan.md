
# Рефакторинг: оргструктура → workflow, серверное RBAC, история назначений, аудит, маршруты документов

Объём большой и затрагивает БД, серверные функции, страницы. Делаю одним согласованным проходом.

## 1. БД (миграция)

### 1.1 История назначений пользователей
```text
profile_assignments
  id, user_id, department_id, position_id,
  start_date, end_date NULL, is_primary,
  created_by, created_at
```
- Текущее назначение = `end_date IS NULL AND is_primary`.
- Триггер: при insert закрывает предыдущее primary (end_date = today).
- Функция `public.current_assignment(user_id)` (SECURITY DEFINER) — для использования в workflow и UI.
- `profiles.department_id`/`position_id` остаются как кэш текущего primary, обновляются триггером.

### 1.2 Расширенный audit-log
- Добавить триггеры `audit_*` (по образцу `audit_documents`) на:
  `organization`, `departments`, `positions`, `role_definitions`,
  `user_roles`, `profile_assignments`, `workflows`, `document_templates`.
- Триггер пишет actor_id = `auth.uid()`, entity_type, entity_id, action, before, after.
- В `audit_logs` добавить колонку `ip` (nullable) — пока NULL, под будущее.

### 1.3 Маршруты на уровне шаблона и документа
- `document_templates`: + `default_workflow_id uuid NULL`, `allow_custom_route boolean DEFAULT true`.
- `documents`: + `workflow_id uuid NULL` (используемый маршрут), + `custom_route jsonb NULL` (ручной маршрут — массив шагов { order, approver_user_id|approver_position_id|approver_department_head, sla_hours }).
- `workflow_runs` уже есть — связь с `documents.workflow_id` при старте.

### 1.4 Узлы workflow с орглогикой
Расширить схему `definition.nodes[*].data` (без изменения БД — JSONB):
- `assignee_mode`: `user` | `position` | `department_head` | `role` | `creator_head` | `from_custom_route`.
- `assignee_position_id`, `assignee_department_id`, `assignee_role`, `assignee_user_id`.
- Резолвер на сервере: `resolveAssignee(node, document, actor)` → `user_id`.

### 1.5 Серверная проверка прав
- Функция `public.user_has_permission(_user uuid, _perm text) returns boolean` (SECURITY DEFINER):
  читает `user_roles` + `role_definitions.permissions`. Admin → всегда true.

## 2. Серверный слой (server functions)

### 2.1 Хелпер `requirePermission`
`src/lib/api/_helpers.ts`:
```ts
export async function requirePermission(supabase, userId, perm) {
  const { data } = await supabase.rpc('user_has_permission', { _user: userId, _perm: perm });
  if (!data) throw new Error('Forbidden: ' + perm);
}
```
Применить во всех мутирующих функциях:
- `org.functions.ts` → `manage_org` / `manage_users`
- `admin.functions.ts` (setUserRole, upsertDepartment) → `manage_users` / `manage_org`
- `workflows.functions.ts` (upsertWorkflow) → `manage_workflows`
- `templates.functions.ts` (upsertTemplate) → `manage_templates`
- `nomenclature.functions.ts` → `manage_nomenclature`
- `documents.functions.ts` (archive) → `archive_documents`, (register) → `register_documents`, (sign) → `sign_documents`, (approve) → `approve_documents`.

### 2.2 Новые функции
- `assignments.functions.ts`: `listUserAssignments(userId)`, `assignUser({user_id, department_id, position_id, start_date, is_primary})`, `endAssignment(id, end_date)`.
- `org.functions.ts`: `listDepartmentHeads()` — id → head_user_id.
- `workflows.functions.ts`:
  - `resolveAssignee(node, documentId)` — для preview в дизайнере.
  - Изменения `advance_workflow` (если уже есть) — учитывают `assignee_mode`.
- `documents.functions.ts`:
  - `startWorkflow({document_id, workflow_id?, custom_route?})` — если шаблон жёстко задаёт workflow, использовать его; иначе `custom_route` или выбор юзера.

### 2.3 Гард для страниц
Создать клиентский `<RequirePermission perm="manage_users">` хук/компонент на основе `useRole().can()`. Серверная проверка остаётся в API — UI лишь не показывает заблокированный контент. Также в `_authenticated/admin/*` страницах редирект на /dashboard если нет нужного перма.

## 3. Frontend

### 3.1 Профиль пользователя — назначения
`/admin/users/$id`:
- Карточка «Назначения» — таблица: подразделение, должность, период, primary, кнопка «Завершить».
- Кнопка «Новое назначение» → модалка с выбором department/position/start_date/is_primary.

### 3.2 Шаблоны
`/templates/$id` — добавить поле «Маршрут по умолчанию» (Select workflow) и чекбокс «Разрешить кастомный маршрут».

### 3.3 Создание документа
`/documents/new`:
- Если у шаблона `default_workflow_id` и `allow_custom_route=false` → показать только инфо о маршруте.
- Если `allow_custom_route=true` → таб «Маршрут»: выбрать workflow ИЛИ собрать кастомный (drag-drop / упорядоченный список шагов: подразделение/должность/руководитель/пользователь + SLA).

### 3.4 Workflow Designer
В `NodeEditSheet` для типов APPROVAL/TASK/SIGNATURE добавить поля:
- Радио «Назначить на»: пользователя / должность / руководителя подразделения / роль / руководителя автора / из кастомного маршрута документа.
- Селекты с реальными данными (departments, positions, users, roles).
- Подключить реальные API в `apiService` (сейчас заглушки).

### 3.5 Аудит
`/audit` — добавить фильтры по `entity_type` (organization|department|position|role|user_role|assignment|workflow|template|document) и поиск по actor.

## 4. Технические замечания
- Все изменения JSONB совместимы со старыми workflow (если поле отсутствует → fallback на `user`/`assignee_user_id`).
- `profile_assignments` триггер аккуратно — без рекурсии: проверка `pg_trigger_depth() = 1`.
- `user_has_permission` использовать в RLS-политиках admin-таблиц вместо `is_admin` где нужна тонкая настройка (на будущее; сейчас admin остаётся admin).

## 5. Что НЕ входит
- Графический drag-drop для кастомного маршрута (сделаю упорядоченный список с кнопками вверх/вниз).
- Реальный SLA-engine (только хранение sla_hours).
- E2E-тесты.

После одобрения выполняю: миграция → серверные функции → страницы. Ожидаемо ~15-20 файлов.
