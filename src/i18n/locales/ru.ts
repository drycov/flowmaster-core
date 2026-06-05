import type { Dictionary } from "../types";

export const ruDictionary: Dictionary = {
    // App
    "app.name": "ЕСЭДО",
    "app.tagline": "Единая система электронного документооборота",

    // Navigation
    "nav.dashboard": "Главная",
    "nav.documents": "Документы",
    "nav.tasks": "Задачи",
    "nav.approvals": "Согласования",
    "nav.workflows": "Маршруты",
    "nav.nomenclature": "Номенклатура дел",
    "nav.templates": "Шаблоны",
    "nav.archive": "Архив",
    "nav.search": "Поиск",
    "nav.notifications": "Уведомления",
    "nav.audit": "Аудит",
    "nav.admin": "Администрирование",
    "nav.users": "Пользователи",
    "nav.departments": "Подразделения",
    "nav.organization": "Организация",
    "nav.positions": "Должности",
    "nav.roles": "Роли и доступ",
    "nav.profile": "Профиль",
    "nav.signout": "Выйти",

    // Organization
    "org.description": "Реквизиты организации, используются в шаблонах и регистрации.",
    "org.identity": "Реквизиты",
    "org.contacts": "Контакты",
    "org.management": "Руководство",
    "org.fullName": "Полное наименование",
    "org.shortName": "Сокращённое наименование",
    "org.bin": "БИН / ИИН",
    "org.regPrefix": "Префикс рег. номера",
    "org.phone": "Телефон",
    "org.email": "Эл. почта",
    "org.website": "Веб-сайт",
    "org.legalAddress": "Юридический адрес",
    "org.logoUrl": "URL логотипа",
    "org.head": "Руководитель",

    // Positions
    "positions.description": "Справочник должностей. Используется в карточках сотрудников и маршрутах.",
    "positions.new": "Новая должность",
    "positions.title": "Наименование",
    "positions.level": "Уровень",
    "positions.isHead": "Руководящая",

    // Departments
    "departments.description": "Иерархическая структура подразделений организации.",
    "departments.new": "Новое подразделение",
    "departments.parent": "Родительское подразделение",
    "departments.head": "Руководитель",
    "departments.kind": "Тип",
    "departments.kind.company": "Организация",
    "departments.kind.branch": "Филиал",
    "departments.kind.department": "Отдел",
    "departments.kind.division": "Управление",

    // Roles
    "roles.description": "Настройка системных ролей: наименования, описания и доступные действия.",
    "roles.permissions": "Разрешения",
    "roles.permissionsHint": "Разрешения определяют доступные действия пользователей с данной ролью.",
    "roles.admin": "Администратор",
    "roles.registrar": "Регистратор",
    "roles.approver": "Согласующий",
    "roles.signer": "Подписант",
    "roles.archivist": "Архивариус",
    "roles.viewer": "Наблюдатель",

    // Auth
    "auth.signin": "Войти в систему",
    "auth.signup": "Регистрация",
    "auth.email": "Электронная почта",
    "auth.password": "Пароль",
    "auth.fullname": "ФИО",
    "auth.google": "Войти через Google",
    "auth.orEmail": "или по электронной почте",
    "auth.haveAccount": "Уже есть аккаунт? Войти",
    "auth.noAccount": "Нет аккаунта? Зарегистрироваться",
    "auth.subtitle": "Доступ к системе электронного документооборота",

    // Common
    "common.create": "Создать",
    "common.save": "Сохранить",
    "common.cancel": "Отмена",
    "common.delete": "Удалить",
    "common.edit": "Редактировать",
    "common.back": "Назад",
    "common.search": "Поиск...",
    "common.loading": "Загрузка...",
    "common.empty": "Нет данных",
    "common.actions": "Действия",
    "common.status": "Статус",
    "common.date": "Дата",
    "common.author": "Автор",
    "common.title": "Заголовок",
    "common.assignee": "Исполнитель",
    "common.deadline": "Срок",
    "common.type": "Тип",
    "common.code": "Код",
    "common.name": "Название",
    "common.description": "Описание",
    "common.yes": "Да",
    "common.no": "Нет",
    "common.approve": "Согласовать",
    "common.reject": "Отклонить",
    "common.sign": "Подписать",
    "common.archive": "В архив",
    "common.comment": "Комментарий",
    "common.submit": "Отправить",
    "common.version": "Версия",
    "common.history": "История",
    "common.refresh": "Обновить",
    "common.all": "Все",
    "common.error": "Ошибка",
    "common.success": "Успешно",

    // Documents
    "doc.regNumber": "Рег. №",
    "doc.title": "Заголовок документа",
    "doc.summary": "Краткое содержание",
    "doc.body": "Содержание",
    "doc.new": "Новый документ",
    "doc.from_template": "На основе шаблона",
    "doc.register": "Зарегистрировать",
    "doc.metadata": "Метаданные",
    "doc.versions": "Версии",
    "doc.signatures": "Подписи",
    "doc.comments": "Комментарии",
    "doc.workflow": "Маршрут согласования",
    "doc.audit": "Аудит",
    "doc.start_workflow": "Запустить маршрут",
    "doc.upload_version": "Загрузить версию",
    "doc.add_comment": "Оставить комментарий",
    "doc.no_template": "Без шаблона",
    "doc.certificate_details": "Детали сертификата",
    "doc.signature_valid": "Подпись действительна",

    // Statuses
    "status.draft": "Черновик",
    "status.in_review": "На согласовании",
    "status.approved": "Согласовано",
    "status.signed": "Подписано",
    "status.rejected": "Отклонено",
    "status.archived": "В архиве",
    "status.cancelled": "Отменено",
    "status.pending": "Ожидает",
    "status.in_progress": "В работе",
    "status.completed": "Завершено",
    "status.escalated": "Эскалировано",

    // SLA
    "sla.ok": "В срок",
    "sla.warning": "Внимание",
    "sla.overdue": "Просрочено",

    // Workflow
    "wf.designer": "Конструктор маршрута",
    "wf.add_node": "Добавить узел",
    "wf.publish": "Опубликовать",
    "wf.draft": "Черновик",
    "wf.published": "Опубликован",
    "wf.simulate": "Симуляция",

    // Templates
    "tpl.upload_docx": "Загрузить DOCX",
    "tpl.fields": "Поля шаблона",
    "tpl.add_field": "Добавить поле",

    // Nomenclature
    "nom.add_section": "Добавить раздел",
    "nom.retention": "Срок хранения (лет)",

    // Office
    "office.placeholder": "Редактор ONLYOFFICE / MS Office Web подключается через переменную VITE_OFFICE_URL. Интеграция готова.",

    // NCALayer
    "ncalayer.title": "Подпись через NCALayer",
    "ncalayer.connect": "Подключиться к NCALayer",
    "ncalayer.notFound": "NCALayer не обнаружен. Запустите NCALayer на вашем компьютере.",
    "ncalayer.sign": "Подписать ЭЦП",

    // Tasks
    "task.action.approve": "Согласование",
    "task.action.sign": "Подпись",
    "task.action.review": "Ознакомление",

    // Users
    "users.user": "Пользователи",
    "users.roleUpdated": "Роль обновлена",
    "users.noUsers": "Пользователи не найдены",
    "users.noResults": "Ничего не найдено",
    "users.search": "Поиск пользователей...",
    "users.allRoles": "Все роли",

    // Profile page keys
    "profile.title": "Профиль",
    "profile.userProfile": "Профиль пользователя",
    "profile.personalInfo": "Личная информация",
    "profile.security": "Безопасность",
    "profile.changePassword": "Сменить пароль",
    "profile.changePasswordDescription": "Введите новый пароль для вашей учетной записи",
    "profile.notFound": "Пользователь не найден",
    "profile.cannotChangeOtherPassword": "Нельзя изменить пароль другого пользователя",

    // Profile form keys
    "profile.fullNameRu": "ФИО (русский)",
    "profile.fullNameKk": "ФИО (казахский)",
    "profile.department": "Отдел",
    "profile.departmentPlaceholder": "Выберите отдел",
    "profile.position": "Должность",
    "profile.positionPlaceholder": "Выберите должность",
    "profile.phone": "Телефон",
    "profile.email": "Email",
    "profile.roles": "Роли",
    "profile.memberSince": "Участник с",
    "profile.lastActive": "Последняя активность",
    

    // Profile edit keys
    "profile.editProfile": "Редактировать профиль",
    "profile.saveChanges": "Сохранить изменения",
    "profile.cancelEditing": "Отменить редактирование",
    "profile.uploadAvatar": "Загрузить аватар",
    "profile.changeAvatar": "Изменить аватар",
    "profile.removeAvatar": "Удалить аватар",

    // Password dialog keys
    "profile.newPassword": "Новый пароль",
    "profile.confirmPassword": "Подтвердите пароль",
    "profile.passwordMismatch": "Пароли не совпадают",
    "profile.passwordTooShort": "Пароль должен содержать минимум 6 символов",
    "profile.updatePassword": "Обновить пароль",

    // Toast messages
    "profile.profileUpdated": "Профиль успешно обновлен",
    "profile.profileUpdateError": "Ошибка при обновлении профиля",
    "profile.passwordUpdated": "Пароль успешно изменен",
    "profile.passwordUpdateError": "Ошибка при изменении пароля",
    "profile.avatarUpdated": "Аватар успешно обновлен",
    "profile.avatarUpdateError": "Ошибка при обновлении аватара",

    "profile.joined": "Присоединился "
};