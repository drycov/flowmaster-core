# Лицензирование

**Полная версия:** [`docs/LICENSE-SERVER.md`](../docs/LICENSE-SERVER.md)

## Режимы (`LICENSE_MODE`)

| Режим | Описание |
|-------|----------|
| `offline` | FM1-ключ в UI |
| `online` | Heartbeat к license server |
| `hybrid` | Online + offline fallback |

## Три схемы online

| Схема | EDMS | License server |
|-------|------|----------------|
| **Облако** | → Vercel | `apps/cloud-license-server` |
| **Vendor Docker** | → vendor VPS | `compose:license-server` |
| **Replica** | → local LS | Local LS → Vercel upstream |

## Облако (типовая)

1. Клиент регистрируется в `/cabinet` → `installation_id`
2. EDMS env: `LICENSE_SERVER_URL`, `INSTALLATION_ID`, `LICENSE_MODE=online`
3. **Без** `LICENSE_SERVER_ENABLED` на EDMS
4. Cron `license-sync` каждые ~6 ч

```bash
npm run env:production -- \
  --with-license-server \
  --license-server-url=https://your-project.vercel.app \
  --installation-id=<uuid> \
  --install
```

## Интерфейсы вендора

| UI | Вход |
|----|------|
| **Кабинет** `/cabinet` | Клиент (email) |
| **Cloud Admin** `/admin` | Вендор + Telegram |
| **Console** `127.0.0.1:3847` | Support code + SSH |

## FM1 (offline)

```bash
npm run license:generate -- --plan professional --customer "Org"
```

→ [Cloud License Server](Cloud-License-Server)
