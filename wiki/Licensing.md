# Лицензирование

**Полная версия:** [`docs/LICENSE-SERVER.md`](../docs/LICENSE-SERVER.md)

## Режимы (`LICENSE_MODE`)

| Режим | Описание |
|-------|----------|
| `offline` | FM1-ключ в UI |
| `online` | Heartbeat к license server |
| `hybrid` | Online + offline fallback |

## Две схемы online

| Схема | EDMS | License server |
|-------|------|----------------|
| **Облако (типовая)** | → z-license | `https://z-license.vercel.app` |
| **Replica (КИИ)** | → local LS на отдельном VPS | Local LS → z-license upstream |

EDMS **не** встраивает license API на своём домене.

## Облако (типовая)

1. Клиент регистрируется в `https://z-license.vercel.app/cabinet` → `installation_id`
2. EDMS env: `LICENSE_SERVER_URL`, `INSTALLATION_ID`, `LICENSE_MODE=online`
3. **Без** `LICENSE_SERVER_ENABLED` на EDMS
4. Cron `license-sync` каждые ~6 ч

```bash
npm run env:production -- \
  --domain=esedo.example.kz \
  --with-license-server \
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
