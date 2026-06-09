import type { Dictionary } from "../types";
import { messagesKk } from "./messages.kk";

export const kkDictionary: Dictionary = {
    // App
    "app.name": "БЭҚА",
    "app.tagline": "Бірыңғай электрондық құжат айналымы жүйесі",

    // Navigation
    "nav.dashboard": "Басты бет",
    "nav.documents": "Құжаттар",
    "nav.tasks": "Тапсырмалар",
    "nav.approvals": "Келісімдер",
    "nav.workflows": "Бағыттар",
    "nav.references": "Анықтамалар",
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
    "nav.permissions": "Рұқсаттар",
    "nav.profile": "Профиль",
    "nav.signout": "Шығу",

    // Organization
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

    // Positions
    "positions.description": "Лауазымдар анықтамалығы.",
    "positions.new": "Жаңа лауазым",
    "positions.title": "Атауы",
    "positions.level": "Деңгей",
    "positions.isHead": "Басшы",

    // Departments
    "departments.description": "Ұйымның иерархиялық құрылымы.",
    "departments.new": "Жаңа бөлім",
    "departments.parent": "Аға бөлім",
    "departments.head": "Басшы",
    "departments.kind": "Түрі",
    "departments.kind.company": "Ұйым",
    "departments.kind.branch": "Филиал",
    "departments.kind.department": "Бөлім",
    "departments.kind.division": "Басқарма",

    // Roles
    "roles.description": "Жүйелік рөлдерді баптау: атаулар, сипаттамалар және рұқсаттар.",
    "roles.permissions": "Рұқсаттар",
    "roles.permissionsHint": "Рұқсаттар осы рөлмен қол жетімді әрекеттерді анықтайды.",
    "roles.admin": "Әкімші",
    "roles.registrar": "Тіркеуші",
    "roles.approver": "Келісуші",
    "roles.signer": "Қол қоюшы",
    "roles.archivist": "Мұрағатшы",
    "roles.viewer": "Байқаушы",

    // Auth
    "auth.signin": "Жүйеге кіру",
    "auth.signup": "Тіркелу",
    "auth.email": "Электрондық пошта",
    "auth.password": "Құпиясөз",
    "auth.fullname": "Аты-жөні",
    "auth.haveAccount": "Аккаунтыңыз бар ма? Кіру",
    "auth.noAccount": "Аккаунтыңыз жоқ па? Тіркелу",
    "auth.subtitle": "Электрондық құжат айналымы жүйесіне қол жеткізу",

    // Common
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
    "common.retry": "Қайталау",
    "common.all": "Барлығы",
    "common.error": "Қате",
    "common.success": "Сәтті",

    // Documents
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
    "doc.certificate_details": "Сертификат мәліметтері",
    "doc.signature_valid": "Қолтаңба жарамды",

    // Statuses
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

    // SLA
    "sla.ok": "Уақытында",
    "sla.warning": "Назар",
    "sla.overdue": "Мерзімі өткен",

    // Workflow
    "wf.designer": "Бағыт конструкторы",
    "wf.add_node": "Түйін қосу",
    "wf.publish": "Жариялау",
    "wf.draft": "Жоба",
    "wf.published": "Жарияланды",
    "wf.simulate": "Симуляция",

    // Templates
    "tpl.upload_docx": "Файл жүктеу",
    "tpl.fields": "Үлгі өрістері",
    "tpl.add_field": "Өріс қосу",

    // Nomenclature
    "nom.add_section": "Бөлім қосу",
    "nom.retention": "Сақтау мерзімі (жыл)",

    // Office
    "office.placeholder": "ONLYOFFICE / MS Office Web редакторы VITE_OFFICE_URL айнымалысы арқылы қосылады. Интеграция дайын.",

    // NCALayer
    "ncalayer.title": "NCALayer арқылы қол қою",
    "ncalayer.connect": "NCALayer-ге қосылу",
    "ncalayer.notFound": "NCALayer табылмады. Компьютерде іске қосыңыз.",
    "ncalayer.sign": "ЭЦҚ қою",

    // Tasks
    "task.action.approve": "Келісу",
    "task.action.sign": "Қол қою",
    "task.action.review": "Танысу",

    // Users
    "users.user": "Пайдаланушылар",
    "users.roleUpdated": "Рөл жаңартылды",
    "users.noUsers": "Пайдаланушылар табылмады",
    "users.noResults": "Ештеңе табылмады",
    "users.search": "Пайдаланушыларды іздеу...",
    "users.allRoles": "Барлық рөлдер",

    // Profile page keys
    "profile.title": "Профиль",
    "profile.userProfile": "Пайдаланушы профилі",
    "profile.personalInfo": "Жеке ақпарат",
    "profile.security": "Қауіпсіздік",
    "profile.changePassword": "Құпиясөзді өзгерту",
    "profile.changePasswordDescription": "Тіркелгіңіз үшін жаңа құпиясөз енгізіңіз",
    "profile.notFound": "Пайдаланушы табылмады",
    "profile.cannotChangeOtherPassword": "Басқа пайдаланушының құпиясөзін өзгерту мүмкін емес",

    // Profile form keys
    "profile.fullNameRu": "Аты-жөні (орысша)",
    "profile.fullNameKk": "Аты-жөні (қазақша)",
    "profile.department": "Бөлім",
    "profile.departmentPlaceholder": "Бөлімді таңдаңыз",
    "profile.position": "Лауазым",
    "profile.positionPlaceholder": "Лауазымды таңдаңыз",
    "profile.phone": "Телефон",
    "profile.email": "Email",
    "profile.roles": "Рөлдер",
    "profile.memberSince": "Қосылған күні",
    "profile.lastActive": "Соңғы белсенділік",

    // Profile edit keys
    "profile.editProfile": "Профильді өңдеу",
    "profile.saveChanges": "Өзгерістерді сақтау",
    "profile.cancelEditing": "Өңдеуді болдырмау",
    "profile.uploadAvatar": "Аватар жүктеу",
    "profile.changeAvatar": "Аватарды өзгерту",
    "profile.removeAvatar": "Аватарды жою",

    // Password dialog keys
    "profile.currentPassword": "Ағымдағы құпиясөз",
    "profile.currentPasswordRequired": "Ағымдағы құпиясөзді енгізіңіз",
    "profile.newPassword": "Жаңа құпиясөз",
    "profile.newPasswordRequired": "Жаңа құпиясөзді енгізіңіз",
    "profile.confirmPassword": "Құпиясөзді растаңыз",
    "profile.passwordMismatch": "Құпиясөздер сәйкес келмейді",
    "profile.passwordsDoNotMatch": "Құпиясөздер сәйкес келмейді",
    "profile.setPassword": "Құпиясөзді орнату",
    "profile.setPasswordDescription": "Email арқылы кіру үшін құпиясөз орнатыңыз",

    // Auth methods (email ↔ EDS)
    "profile.authMethods": "Кіру әдістері",
    "profile.authMethodsDescription": "Email және ЭЦҚ кіруін бір аккаунтқа байланыстырыңыз",
    "profile.authMethodsConfigured": "Email және ЭЦҚ кіруі бапталған",
    "profile.linkedIin": "Байланған ЖСН",
    "profile.linkEdsTitle": "ЭЦҚ байлау",
    "profile.linkEdsDescription": "Осы аккаунтқа ЭЦҚ арқылы кіру үшін NCALayer сертификатымен қол қойыңыз",
    "profile.linkEdsAction": "Қол қою және ЭЦҚ байлау",
    "profile.enableEmailTitle": "Email арқылы кіруді қосу",
    "profile.enableEmailDescription": "ЭЦҚсыз кіру үшін нақты email және құпиясөз көрсетіңіз",
    "profile.enableEmailAction": "Email және құпиясөзді сақтау",
    "profile.emailLoginEnabled": "Email арқылы кіру қосылды",
    "profile.emailLoginEnableError": "Email арқылы кіруді қосу сәтсіз аяқталды",
    "profile.cnMismatch": "Сертификат CN профильдегі аты-жөнімен сәйкес келмейді",
    "profile.passwordTooShort": "Құпиясөз кемінде 6 таңбадан тұруы керек",
    "profile.updatePassword": "Құпиясөзді жаңарту",

    // Toast messages
    "profile.profileUpdated": "Профиль сәтті жаңартылды",
    "profile.profileUpdateError": "Профильді жаңарту кезінде қате орын алды",
    "profile.passwordUpdated": "Құпиясөз сәтті өзгертілді",
    "profile.passwordUpdateError": "Құпиясөзді өзгерту кезінде қате орын алды",
    "profile.avatarUpdated": "Аватар сәтті жаңартылды",
    "profile.avatarUpdateError": "Аватарды жаңарту кезінде қате орын алды",

    "users.totalUsers": "Барлық пайдаланушылар: ",
    "users.create": "Пайдаланушы қосу",
    "users.createTitle": "Жаңа пайдаланушы",
    "users.createDescription": "Жүйеге тіркеу үшін негізгі деректерді толтырыңыз.",
    "users.filterByRole": "Барлық рөлдер",
    "users.loadError": "Деректерді жүктеу мүмкін болмады",

    "permissions.title": "Рұқсаттар анықтамалығы",
    "permissions.description": "Жүйеде қолданылатын атомдық қол жеткізу құқықтары. Рөлдер арқылы басқарылады.",
    "permissions.empty": "Анықтамалық бос. Негізгі жиынтықты жүктеу үшін миграцияны іске қосыңыз.",

    "audit.description": "Барлық операциялардың өзгертілмейтін журналы",
    "audit.allEntities": "Барлық объектілер",
    "audit.searchPlaceholder": "ID / actor / әрекет бойынша іздеу…",
    "audit.records": "Жазбалар",
    "audit.entity": "Объект",
    "audit.action": "Әрекет",
    "audit.actor": "Кім өзгертті",
    "audit.details": "Толығырақ",
    "audit.system": "Жүйе",

    "approvals.description": "Құжаттарды келісу тапсырмалары",

    "notifications.markAllRead": "Барлығын оқылған деп белгілеу",
    "notifications.goTo": "Өту",

    "search.placeholder": "Нөмір, тақырып, мәтін бойынша іздеу...",
    "search.noResults": "Ештеңе табылмады",
    "search.enterQuery": "Сұрау енгізіңіз (кемінде 2 таңба)",

    "departments.selectHint": "Ақпаратты көру үшін сол жақтан бөлімді таңдаңыз",
    "departments.headLabel": "Басшы",
    "departments.phone": "Телефон",
    "departments.email": "Эл. пошта",

    "scope.mine": "Менің",
    "scope.assigned": "Тапсырылған",

    ...messagesKk,
};