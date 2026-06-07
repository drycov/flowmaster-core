# Полный рефакторинг: IAM + Org + HR + Workflow + Audit

Объём огромный (≈40–60 файлов, 3 миграции). Разбиваю на 6 доменов и выполняю одним согласованным проходом после одобрения.

## 1. Домены и структура каталогов

```text
src/domains/
  iam/            # permissions, roles, role_groups, policies
  org/            # organization, departments, positions
  hr/             # assignments, deputies, transfers, history
  workflow/       # workflow engine, route resolver, steps
  documents/      # document lifecycle, transitions
  audit/          # centralized audit bus
```

Каждый домен:
```text
domains/<name>/
  models.ts            # типы доменных сущностей
  repository.ts        # доступ к БД (через supabase context)
  service.ts           # бизнес-логика
  policies.ts          # проверка прав
  api/*.functions.ts   # серверные функции (тонкий слой)
```

Слой представления (`src/routes`, `src/components`) импортирует ТОЛЬКО `api/*.functions.ts`. Прямые supabase-запросы из компонентов запрещены.

## 2. БД — миграция 1: IAM + Org

### 2.1 IAM
```text
permissions(code PK, category, description_ru, description_kk)
role_groups(id, code unique, name_ru, name_kk, description, is_system)
role_group_permissions(role_group_id, permission_code) -- M:N
roles(id, code unique, name_ru, name_kk, kind {system|org|department|temporary},
      scope_department_id NULL, parent_role_id NULL, is_active)
role_permissions(role_id, permission_code)
role_group_roles(role_group_id, role_id)
user_role_grants(id, user_id, role_id, scope_department_id NULL,
                 granted_by, granted_at, expires_at NULL, revoked_at NULL, reason)
```

Старая `user_roles` (enum app_role) остаётся как legacy — синхронизируется триггером с `user_role_grants` (admin/registrar/...).

`public.user_has_permission(_user uuid, _perm text) returns boolean SECURITY DEFINER` — читает активные grants + role_permissions + role_group_permissions, разворачивает `parent_role_id`. Admin → true.

`public.user_in_scope(_user uuid, _department uuid) returns boolean` — учитывает иерархию подразделений.

### 2.2 Org
- `departments` расширить: `is_active`, `deputy_user_ids uuid[]`, `path ltree` (для быстрых scope-проверок), триггер пересчёта path.
- `organization` уже есть.
- `positions` уже есть.

### 2.3 GRANTs + RLS
Для всех новых таблиц: `GRANT SELECT TO authenticated`, write — `service_role`, RLS включён, политики через `user_has_permission`.

## 3. БД — миграция 2: HR (история назначений)

```text
profile_assignments(
  id, user_id, department_id, position_id, manager_user_id NULL,
  start_date, end_date NULL, is_primary, is_temporary,
  reason {hire|transfer|promotion|temporary|termination|reinstatement},
  created_by, created_at
)
```

- Триггер: при insert primary — закрывает предыдущее primary (`end_date = start_date - 1`), обновляет `profiles.department_id/position_id`.
- `public.current_assignment(uuid)` SECURITY DEFINER — для workflow.
- `public.user_manager(uuid)` — текущий руководитель.
- `public.department_head(uuid)`, `public.department_parent_head(uuid)` — для резолвера маршрутов.
- Полностью неизменяемая: запрет UPDATE/DELETE через RLS (только service_role).

## 4. БД — миграция 3: Workflow + Documents + Audit

### 4.1 Workflow
- `workflows`: + `is_template_default bool`, definition уже JSONB.
- Узлы `definition.nodes[*].data`:
  - `assignee_mode`: `user | position | department | department_head | parent_department_head | role | role_group | initiator_manager | rule`
  - `assignee_ref` (uuid/code)
  - `rule` (JSON) для динамических правил
  - `sla_hours`, `is_required`, `escalation` { after_hours, escalate_to_mode, escalate_to_ref }
  - `transitions`: { on_approve→nodeId, on_reject→nodeId, on_return→nodeId }

### 4.2 Documents
- `document_templates`: + `default_workflow_id`, `allow_custom_route bool`.
- `documents`: + `workflow_id`, `custom_route jsonb` (массив шагов), + статусы enum:
  `draft | submitted | in_review | approved | rejected | returned_for_revision | cancelled | archived`.
- `workflow_runs`/`workflow_tasks` — уже есть, расширить `decision`, `comment`, `signature_id`, `assigned_at`, `completed_at`.

### 4.3 Audit
- `audit_logs`: + `ip inet`, `user_agent text`, `correlation_id uuid`, `old_value jsonb`, `new_value jsonb`.
- Триггер-фабрика `public.audit_trigger()` (универсальный) → подключить к:
  organization, departments, positions, roles, role_groups, role_permissions,
  user_role_grants, profile_assignments, workflows, document_templates,
  documents, workflow_runs, workflow_tasks.
- Immutability: RLS deny update/delete для всех, кроме service_role; revoke privileges.

## 5. Серверный слой

### 5.1 Хелперы (`src/domains/iam/policies.ts`)
```ts
requirePermission(ctx, perm)
requireAnyPermission(ctx, perms[])
requireDepartmentScope(ctx, departmentId)
requireOwnership(ctx, resource)
```
Все принимают `{ supabase, userId, request }` и логируют отказ в audit.

### 5.2 Middleware
`auditMiddleware` — захватывает IP/UA/correlation_id, прокидывает в context для записи в audit (RPC `audit_event`).

### 5.3 API по доменам
- `iam/api/*`: listPermissions, listRoles, upsertRole, deleteRole, grantRole, revokeRole, listRoleGroups, upsertRoleGroup.
- `org/api/*`: org CRUD, departments tree CRUD (с deputies), positions CRUD.
- `hr/api/*`: listAssignments(user), createAssignment, endAssignment, transferUser, listHistory(user).
- `workflow/api/*`: CRUD workflow, **resolveAssignee(node, document)** (универсальный резолвер), startWorkflow, advanceTask (approve/reject/return), escalateTask.
- `documents/api/*`: CRUD, transition(status), buildCustomRoute, useTemplateRoute.
- `audit/api/*`: search с фильтрами entity/actor/date/correlation.

### 5.4 Резолвер маршрутов (`domains/workflow/service.ts`)
```ts
resolveAssignee(node, document, actor): uuid[]
```
Покрывает все 8 режимов через SQL-функции из миграций.

## 6. Frontend

### 6.1 Меню/гарды
- `<Can perm="...">` компонент + `useRole().can()` (расширить под новую модель).
- Сайдбар фильтруется по permissions.
- Каждая admin-страница: при отсутствии перма — redirect `/dashboard` + toast.

### 6.2 Новые/обновлённые страницы
- `/admin/roles` — список ролей + редактор (permissions checkbox-matrix, parent_role, scope).
- `/admin/role-groups` — группы ролей.
- `/admin/permissions` — справочник (read-only).
- `/admin/departments` — дерево + deputy editor, история.
- `/admin/users/$id` — карточка с табами: Профиль | Назначения (история) | Роли (grants с expires_at).
- `/templates/$id` — secton «Маршрут по умолчанию» + чекбокс «Разрешить кастомный».
- `/documents/new` — `RouteBuilder` компонент: радио (шаблон | модифицировать | с нуля), список шагов с reorder ↑↓, выбор assignee_mode + ref + SLA.
- `/workflows/$id` — `NodeEditSheet` с полной поддержкой 8 режимов assignee.
- `/audit` — фильтры: entity_type, action, actor, period, correlation_id; столбцы old/new diff viewer.
- `/documents/$id` — расширенная workflow-панель: текущий шаг, история решений, кнопки Approve/Reject/Return (с комментарием).

## 7. Безопасность

- Все мутации — через `requirePermission` на сервере.
- RLS на всех новых таблицах через `user_has_permission`.
- Audit неизменяем (revoke + RLS).
- Все ошибки авторизации → запись в audit (`action=access_denied`).

## 8. Что НЕ входит (явно)

- Графический drag-drop для маршрутов — только ↑↓ кнопки.
- Реальный SLA-engine с cron-эскалацией (только хранение и фиксация overdue).
- Миграция legacy `user_roles` enum удаляется не сейчас — пока синхронизируется триггером.
- E2E-тесты.
- Полная локализация UI новых страниц — каркас RU, KK позже.

## 9. Порядок выполнения

1. Миграция 1 (IAM + Org расширение) — ожидание approve.
2. Миграция 2 (HR).
3. Миграция 3 (Workflow + Documents + Audit).
4. Серверный слой (domains/*).
5. Frontend (routes/components).
6. Удаление дублирующего legacy кода (`admin.functions.ts`, старые helpers).

Ожидаемо ~50 файлов. После одобрения — выполняю последовательно, без остановок между шагами.
