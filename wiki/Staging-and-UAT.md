# Staging и UAT

**Полные версии:** [`docs/STAGING.md`](../docs/STAGING.md) · [`docs/UAT.md`](../docs/UAT.md)

## Staging

```bash
npm run env:staging -- --install
npm run env:sync
npm run compose:staging
npm run uat:preflight
npm run uat:smoke
```

| URL | Назначение |
|-----|------------|
| http://localhost:8080 | ЕСЭДО (nginx) |
| http://localhost:3001 | App напрямую |

Cron включён в staging compose по умолчанию.

## UAT чеклист

### Staging

- [ ] `compose:staging` + migrate
- [ ] `uat:preflight`, `uat:smoke`, `uat:smoke:full`

### Production

- [ ] `compose:tls:cron`
- [ ] HTTPS, backup, CRON_SECRET
- [ ] Лицензия: FM1 **или** online Vercel

### Функционал

Документы, workflow, ЭЦП, RBAC, API keys, webhooks — см. полный чеклист в `docs/UAT.md`.

## Остановка

```bash
npm run compose:staging:down
```

→ [CI/CD](CI-CD) · [Deployment](Deployment)
