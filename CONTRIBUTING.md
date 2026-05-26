# Contributing to QA TimeOff

## 1) Локальный запуск

1. Установить зависимости:
   - `npm install`
2. Сгенерировать Prisma Client:
   - `npm run prisma:generate`
3. Применить миграции:
   - `npm run prisma:migrate`
4. Запустить backend:
   - `npm run dev:backend`
5. Запустить frontend:
   - `npm run dev:frontend`

## 2) Качество кода перед PR

Обязательно выполнить:

- Линт:
  - `npm run lint`
- Тесты backend:
  - `npm run test --workspace @qa-timeoff/backend`
- Тесты frontend:
  - `npm run test --workspace @qa-timeoff/frontend`
- Сборка:
  - `npm run build`

## 3) Стандарты изменений

- Делайте небольшие атомарные PR.
- Не смешивайте инфраструктурные и продуктовые изменения в одном PR.
- При изменении API обновляйте README и/или swagger-описание.
- При изменении env-переменных синхронизируйте:
  - `.env.example`
  - `apps/backend/.env.example`

## 4) Коммиты

Рекомендуемый формат:

- `feat: ...` — новая функциональность
- `fix: ...` — исправление
- `refactor: ...` — рефакторинг
- `test: ...` — тесты
- `docs: ...` — документация
- `chore: ...` — сервисные изменения

## 5) Pull Request checklist

- [ ] Изменения локально запускаются
- [ ] Линт проходит
- [ ] Тесты проходят
- [ ] Сборка проходит
- [ ] Обновлена документация (если требуется)
- [ ] Обновлены env-шаблоны (если требуется)

