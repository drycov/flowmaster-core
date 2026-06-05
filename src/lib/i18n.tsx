import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Locale = "ru" | "kk";

/**
 * 1. БАЗОВЫЙ DICT (runtime only)
 * as const оставляем, но НЕ используем его для вывода Key через values
 */
const dict = {
  ru: {
    "app.name": "ЕСЭДО",
    "app.tagline": "Единая система электронного документооборота",
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
    "positions.description": "Справочник должностей. Используется в карточках сотрудников и маршрутах.",
    "positions.new": "Новая должность",
    "positions.title": "Наименование",
    "positions.level": "Уровень",
    "positions.isHead": "Руководящая",
    "departments.description": "Иерархическая структура подразделений организации.",
    "departments.new": "Новое подразделение",
    "departments.parent": "Родительское подразделение",
    "departments.head": "Руководитель",
    "departments.kind": "Тип",
    "departments.kind.company": "Организация",
    "departments.kind.branch": "Филиал",
    "departments.kind.department": "Отдел",
    "departments.kind.division": "Управление",
    "roles.description": "Настройка системных ролей: наименования, описания и доступные действия.",
    "roles.permissions": "Разрешения",
    "roles.permissionsHint": "Разрешения определяют доступные действия пользователей с данной ролью.",
    "nav.profile": "Профиль",
    "nav.signout": "Выйти",
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
    "sla.ok": "В срок",
    "sla.warning": "Внимание",
    "sla.overdue": "Просрочено",
    "wf.designer": "Конструктор маршрута",
    "wf.add_node": "Добавить узел",
    "wf.publish": "Опубликовать",
    "wf.draft": "Черновик",
    "wf.published": "Опубликован",
    "wf.simulate": "Симуляция",
    "tpl.upload_docx": "Загрузить DOCX",
    "tpl.fields": "Поля шаблона",
    "tpl.add_field": "Добавить поле",
    "nom.add_section": "Добавить раздел",
    "nom.retention": "Срок хранения (лет)",
    "office.placeholder": "Редактор ONLYOFFICE / MS Office Web подключается через переменную VITE_OFFICE_URL. Интеграция готова.",
    "ncalayer.title": "Подпись через NCALayer",
    "ncalayer.connect": "Подключиться к NCALayer",
    "ncalayer.notFound": "NCALayer не обнаружен. Запустите NCALayer на вашем компьютере.",
    "ncalayer.sign": "Подписать ЭЦП",
    "task.action.approve": "Согласование",
    "task.action.sign": "Подпись",
    "task.action.review": "Ознакомление",
    "roles.admin": "Администратор",
    "roles.registrar": "Регистратор",
    "roles.approver": "Согласующий",
    "roles.signer": "Подписант",
    "roles.archivist": "Архивариус",
    "roles.viewer": "Наблюдатель",
    "users.roleUpdated": "Роль обновлена",
    "users.noUsers": "Пользователи не найдены",
    "users.noResults": "Ничего не найдено",
    "users.search": "Поиск пользователей...",
  },
  kk: {
    "app.name": "БЭҚА",
    "app.tagline": "Бірыңғай электрондық құжат айналымы жүйесі",
    "nav.dashboard": "Басты бет",
    "nav.documents": "Құжаттар",
    "nav.tasks": "Тапсырмалар",
    "nav.approvals": "Келісімдер",
    "nav.workflows": "Бағыттар",
    "nav.nomenclature": "Іс номенклатурасы",
    "nav.templates": "Үлгілер",
    "nav.archive": "Мұрағат",
    "nav.search": "Іздеу",
    "nav.notifications": "Хабарландырулар",
    "nav.audit": "Аудит",
    "nav.admin": "Әкімшілік",
    "nav.users": "Пайдаланушылар",
    "nav.departments": "Бөлімдер",
    "nav.organization": "Ұйым",
    "nav.positions": "Лауазымдар",
    "nav.roles": "Рөлдер мен қатынау",
    "org.description": "Ұйым деректемелері. Үлгілер мен тіркеуде қолданылады.",
    "org.identity": "Деректемелер",
    "org.contacts": "Байланыс",
    "org.management": "Басшылық",
    "org.fullName": "Толық атауы",
    "org.shortName": "Қысқаша атауы",
    "org.bin": "БСН / ЖСН",
    "org.regPrefix": "Тіркеу нөмірі префиксі",
    "org.phone": "Телефон",
    "org.email": "Эл. пошта",
    "org.website": "Веб-сайт",
    "org.legalAddress": "Заңды мекенжай",
    "org.logoUrl": "Логотип URL",
    "org.head": "Басшы",
    "positions.description": "Лауазымдар анықтамалығы.",
    "positions.new": "Жаңа лауазым",
    "positions.title": "Атауы",
    "positions.level": "Деңгей",
    "positions.isHead": "Басшы",
    "departments.description": "Ұйымның иерархиялық құрылымы.",
    "departments.new": "Жаңа бөлім",
    "departments.parent": "Аға бөлім",
    "departments.head": "Басшы",
    "departments.kind": "Түрі",
    "departments.kind.company": "Ұйым",
    "departments.kind.branch": "Филиал",
    "departments.kind.department": "Бөлім",
    "departments.kind.division": "Басқарма",
    "roles.description": "Жүйелік рөлдерді баптау: атаулар, сипаттамалар және рұқсаттар.",
    "roles.permissions": "Рұқсаттар",
    "roles.permissionsHint": "Рұқсаттар осы рөлмен қол жетімді әрекеттерді анықтайды.",
    "nav.profile": "Профиль",
    "nav.signout": "Шығу",
    "auth.signin": "Жүйеге кіру",
    "auth.signup": "Тіркелу",
    "auth.email": "Электрондық пошта",
    "auth.password": "Құпиясөз",
    "auth.fullname": "Аты-жөні",
    "auth.google": "Google арқылы кіру",
    "auth.orEmail": "немесе электрондық поштамен",
    "auth.haveAccount": "Аккаунтыңыз бар ма? Кіру",
    "auth.noAccount": "Аккаунтыңыз жоқ па? Тіркелу",
    "auth.subtitle": "Электрондық құжат айналымы жүйесіне қол жеткізу",
    "common.create": "Құру",
    "common.save": "Сақтау",
    "common.cancel": "Болдырмау",
    "common.delete": "Жою",
    "common.edit": "Өңдеу",
    "common.back": "Артқа",
    "common.search": "Іздеу...",
    "common.loading": "Жүктелуде...",
    "common.empty": "Деректер жоқ",
    "common.actions": "Әрекеттер",
    "common.status": "Күй",
    "common.date": "Күні",
    "common.author": "Автор",
    "common.title": "Тақырып",
    "common.assignee": "Орындаушы",
    "common.deadline": "Мерзімі",
    "common.type": "Түрі",
    "common.code": "Коды",
    "common.name": "Атауы",
    "common.description": "Сипаттамасы",
    "common.yes": "Иә",
    "common.no": "Жоқ",
    "common.approve": "Келісу",
    "common.reject": "Қабылдамау",
    "common.sign": "Қол қою",
    "common.archive": "Мұрағатқа",
    "common.comment": "Пікір",
    "common.submit": "Жіберу",
    "common.version": "Нұсқа",
    "common.history": "Тарих",
    "common.refresh": "Жаңарту",
    "common.all": "Барлығы",
    "common.error": "Қате",
    "common.success": "Сәтті",
    "doc.regNumber": "Тіркеу №",
    "doc.title": "Құжат тақырыбы",
    "doc.summary": "Қысқаша мазмұны",
    "doc.body": "Мазмұны",
    "doc.new": "Жаңа құжат",
    "doc.from_template": "Үлгі негізінде",
    "doc.register": "Тіркеу",
    "doc.metadata": "Метадеректер",
    "doc.versions": "Нұсқалар",
    "doc.signatures": "Қолтаңбалар",
    "doc.comments": "Пікірлер",
    "doc.workflow": "Келісу бағыты",
    "doc.audit": "Аудит",
    "doc.start_workflow": "Бағытты іске қосу",
    "doc.upload_version": "Нұсқа жүктеу",
    "doc.add_comment": "Пікір қалдыру",
    "doc.no_template": "Үлгісіз",
    "status.draft": "Жоба",
    "status.in_review": "Келісуде",
    "status.approved": "Келісілген",
    "status.signed": "Қол қойылған",
    "status.rejected": "Қабылданбаған",
    "status.archived": "Мұрағатта",
    "status.cancelled": "Бас тартылған",
    "status.pending": "Күтуде",
    "status.in_progress": "Орындалуда",
    "status.completed": "Аяқталды",
    "status.escalated": "Эскалацияланды",
    "sla.ok": "Уақытында",
    "sla.warning": "Назар",
    "sla.overdue": "Мерзімі өткен",
    "wf.designer": "Бағыт конструкторы",
    "wf.add_node": "Түйін қосу",
    "wf.publish": "Жариялау",
    "wf.draft": "Жоба",
    "wf.published": "Жарияланды",
    "wf.simulate": "Симуляция",
    "tpl.upload_docx": "DOCX жүктеу",
    "tpl.fields": "Үлгі өрістері",
    "tpl.add_field": "Өріс қосу",
    "nom.add_section": "Бөлім қосу",
    "nom.retention": "Сақтау мерзімі (жыл)",
    "office.placeholder": "ONLYOFFICE / MS Office Web редакторы VITE_OFFICE_URL айнымалысы арқылы қосылады. Интеграция дайын.",
    "ncalayer.title": "NCALayer арқылы қол қою",
    "ncalayer.connect": "NCALayer-ге қосылу",
    "ncalayer.notFound": "NCALayer табылмады. Компьютерде іске қосыңыз.",
    "ncalayer.sign": "ЭЦҚ қою",
    "task.action.approve": "Келісу",
    "task.action.sign": "Қол қою",
    "task.action.review": "Танысу",
    "roles.admin": "Әкімші",
    "roles.registrar": "Тіркеуші",
    "roles.approver": "Келісуші",
    "roles.signer": "Қол қоюшы",
    "roles.archivist": "Мұрағатшы",
    "roles.viewer": "Байқаушы",
    "users.roleUpdated": "Рөл жаңартылды",
    "users.noUsers": "Пайдаланушылар табылмады",
    "users.noResults": "Ештеңе табылмады",
    "users.search": "Пайдаланушыларды іздеу...",
  },
} as const;


/**
 * 2. ВАЖНО: ключи берём ТОЛЬКО из ru словаря
 * (он является "source of truth")
 */
type Key = keyof typeof dict["ru"];

/**
 * 3. T FUNCTION — безопасный контракт
 */
type TFunction = {
  (key: Key): string;
  (key: string): string;
};

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
}

const Ctx = createContext<I18nCtx | null>(null);

/**
 * PROVIDER
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "ru";

    const stored = window.localStorage.getItem("edms.locale") as Locale | null;
    if (stored === "ru" || stored === "kk") return stored;

    const browserLang = navigator.language.split("-")[0];
    return browserLang === "kk" ? "kk" : "ru";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("edms.locale", l);
    }
  };

  /**
   * 4. FIX: больше нет Key-only жесткости
   */
  const t: TFunction = (key: string) => {
const table = dict[locale] as Partial<Record<string, string>>;
return table[key] ?? dict.ru[key as keyof typeof dict.ru] ?? key;
  };

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

/**
 * Hook
 */
export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}

/**
 * LOCALIZED helper (без изменений логики)
 */
type LocalizableFields = {
  name_ru?: string | null;
  name_kk?: string | null;
  title_ru?: string | null;
  title_kk?: string | null;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  description_ru?: string | null;
  description_kk?: string | null;
};

type FieldType = "name" | "title" | "full_name" | "description";

export function localized<T extends LocalizableFields>(
  obj: T | null | undefined,
  locale: Locale,
  field: FieldType,
): string {
  if (!obj) return "";

  const value = obj[`${field}_${locale}` as keyof T];
  const fallback = obj[`${field}_ru` as keyof T];

  if (typeof value === "string") return value;
  if (typeof fallback === "string") return fallback;

  return "";
}