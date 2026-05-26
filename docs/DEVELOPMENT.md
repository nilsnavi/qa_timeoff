# Development Guide

## Архитектура

Проект организован как monorepo:

- `apps/backend` — NestJS API + Prisma
- `apps/frontend` — React + Vite
- `packages/shared` — общий пакет типов/утилит

Ключевая идея: доменные модули backend и feature-ориентированные страницы frontend.

## Backend conventions

- Каждый домен содержит:
  - `*.module.ts`
  - `*.controller.ts`
  - `*.service.ts`
  - `dto/*`
- Валидация входа через DTO + `ValidationPipe`.
- Доступы через JWT guard и role guard.
- Ошибки централизованы через глобальный filter.
- Для observability используются:
  - `/health`
  - `/metrics`
  - `X-Request-Id`

## Frontend conventions

- Роутинг в `src/app/router.tsx`.
- Общий API-клиент в `src/shared/api/client.ts`.
- Глобальный обработчик рендер-ошибок: `src/app/ErrorBoundary.tsx`.
- Для производительности используется lazy-loading страниц.

## Работа с окружением

Перед запуском проверьте:

- `apps/backend/.env`
- `apps/frontend/.env`

Новые переменные всегда отражайте в:

- `.env.example`
- `apps/backend/.env.example`
- `apps/frontend/.env.example` (если релевантно)

## Тестирование

- Backend: Jest
  - `npm run test --workspace @qa-timeoff/backend`
- Frontend: Vitest
  - `npm run test --workspace @qa-timeoff/frontend`

Минимальный baseline перед PR:

1. Линт
2. Тесты
3. Сборка

## CI

CI workflow: `.github/workflows/ci.yml`.

Пайплайн выполняет:

1. Install
2. Prisma generate
3. Lint
4. Tests
5. Build

