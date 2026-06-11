# Быстрый старт

**Полная версия:** [`docs/QUICKSTART.md`](../docs/QUICKSTART.md)

## Требования

Node.js 22 · Docker Compose v2 · Git

## За 5 минут

```bash
git clone <repo> flowmaster-core && cd flowmaster-core
npm ci --legacy-peer-deps
npm run env:local
npm run docker:up
curl http://localhost/api/health
```

Откройте **http://localhost** → зарегистрируйте admin.

## Hot reload (разработка)

```bash
npm run docker:deps && npm run dev   # http://localhost:3000
```

## URL (local)

| Сервис | URL |
|--------|-----|
| ЕСЭДО | http://localhost |
| App | http://localhost:3000 |
| Kong | http://localhost:54321 |
| Postgres | 127.0.0.1:54322 |
| Studio | `npm run docker:up -- --studio` |

## Дальше

- [Development](Development)
- [Architecture](Architecture)
- [Troubleshooting](Troubleshooting)
