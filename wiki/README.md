# Wiki ЕСЭДО (Flowmaster Core)

Навигационная wiki проекта. **Канонические полные тексты** — в [`docs/`](../docs/README.md); wiki — краткие страницы для быстрого поиска и GitHub Wiki.

## Как пользоваться в репозитории

- Главная: [Home.md](./Home.md)
- Боковое меню: [_Sidebar.md](./_Sidebar.md)
- Ссылки `../docs/...` ведут на полные guide-файлы

## Публикация в GitHub Wiki

```bash
# 1. Включите Wiki в настройках репозитория GitHub
# 2. Клонируйте wiki (подставьте org/repo):
git clone https://github.com/<org>/<repo>.wiki.git
cd <repo>.wiki

# 3. Скопируйте страницы (без README.md)
cp ../flowmaster-core/wiki/Home.md .
cp ../flowmaster-core/wiki/_Sidebar.md .
cp ../flowmaster-core/wiki/_Footer.md .
cp ../flowmaster-core/wiki/*.md .
rm README.md

# 4. Закоммитьте
git add -A
git commit -m "Sync wiki from main repo"
git push
```

После публикации в GitHub Wiki ссылки `../docs/` не работают — на wiki-страницах указаны пути к файлам в основном репозитории.

## Синхронизация

При изменении `docs/` обновляйте соответствующие страницы `wiki/` или добавьте в CI шаг копирования (опционально).
