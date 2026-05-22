# QA TimeOff Mini App

Telegram Mini App для учета отсутствий QA-команды: отгулы, отпуска, больничные, балансы часов, согласование заявок, календарь команды и администрирование пользователей.

## Стек

- Frontend: React 18, Vite, TypeScript, TailwindCSS, React Router, TanStack Query, Telegram WebApp API.
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, JWT, Swagger.
- Infra: Docker, Docker Compose, Nginx.
- Monorepo: npm workspaces (`apps/*`, `packages/*`).

## Запуск локально

Требования: Node.js 20+, npm, PostgreSQL.

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev:backend
npm run dev:frontend
```

Адреса:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

Для наполнения тестовыми данными:

```bash
npm run seed --workspace @qa-timeoff/backend
```

## Запуск через Docker

```bash
docker compose up --build
```

Адреса:

- App: `http://localhost:8080`
- API через nginx: `http://localhost:8080/api`
- Swagger через nginx: `http://localhost:8080/api/docs`

PostgreSQL хранит данные в volume `postgres-data`.

## Переменные окружения

Backend:

```env
DATABASE_URL=postgresql://qa_timeoff:qa_timeoff@localhost:5432/qa_timeoff?schema=public
JWT_SECRET=change-me
API_PORT=3000
```

Frontend:

```env
VITE_API_URL=/api
```

Docker Compose задает backend-переменные автоматически:

- `POSTGRES_DB`, default `qa_timeoff`
- `POSTGRES_USER`, default `qa_timeoff`
- `POSTGRES_PASSWORD`, default `qa_timeoff`
- `JWT_SECRET`, default `qa-timeoff-dev-secret`

## Команды Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio --workspace @qa-timeoff/backend
npm run seed --workspace @qa-timeoff/backend
```

В Docker backend перед стартом выполняет:

```bash
prisma migrate deploy
```

## Структура проекта

```text
qa_timeoff/
  apps/
    backend/          NestJS API, Prisma schema, migrations, seed
    frontend/         React Telegram Mini App
  packages/
    shared/           общие типы/пакет для расширения monorepo
  infra/
    nginx.conf        reverse proxy для Docker
  docker-compose.yml
  README.md
```

## API endpoints

Все защищенные endpoints используют `Authorization: Bearer <token>`.

Auth:

- `POST /auth/telegram` - вход по Telegram initData
- `GET /auth/me` - текущий пользователь

Dashboard:

- `GET /dashboard` - сводка пользователя

Time off:

- `POST /timeoff/request` - создать отгул
- `GET /timeoff/my` - мои отгулы
- `GET /timeoff/pending` - pending отгулы команды
- `PATCH /timeoff/:id/approve` - одобрить
- `PATCH /timeoff/:id/reject` - отклонить с комментарием
- `PATCH /timeoff/:id/cancel` - отменить

Vacation:

- `POST /vacation/request` - создать отпуск
- `GET /vacation/my` - мои отпуска
- `GET /vacation/pending` - pending отпуска команды
- `PATCH /vacation/:id/approve` - одобрить
- `PATCH /vacation/:id/reject` - отклонить с комментарием
- `PATCH /vacation/:id/cancel` - отменить

Calendar:

- `GET /calendar` - календарь видимых отсутствий
- `GET /calendar/team/:teamId` - календарь команды
- `GET /calendar/user/:userId` - календарь пользователя

Balance:

- `GET /balance/me` - мой баланс
- `GET /balance/user/:userId` - баланс пользователя
- `POST /balance/add` - начислить часы
- `POST /balance/write-off` - списать часы
- `GET /balance/operations` - операции баланса
- `GET /balance/operations/:userId` - операции пользователя

Users and teams:

- `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`
- `GET /teams`, `GET /teams/:id`, `POST /teams`, `PATCH /teams/:id`, `DELETE /teams/:id`

Notifications:

- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

Admin:

- `POST /admin/accruals` - начисление часов
- `POST /admin/write-offs` - списание часов

## Роли

- `EMPLOYEE` - создает и отменяет свои pending-заявки, видит свои данные.
- `LEAD` - видит и согласует заявки своей команды.
- `MANAGER` - видит и согласует заявки шире команды, управляет балансами.
- `ADMIN` - полный доступ: пользователи, команды, роли, балансы, заявки.

## Тестовые пользователи

Seed создает пользователей с Telegram ID:

| Роль | ФИО | Telegram ID | Username | Команда |
| --- | --- | --- | --- | --- |
| ADMIN | Admin | `100000001` | `admin` | QA Team |
| MANAGER | Manager | `100000002` | `manager` | QA Team |
| LEAD | Lead | `100000003` | `lead` | QA Team |
| EMPLOYEE | Employee 1 | `100000004` | `employee_1` | QA Team |
| EMPLOYEE | Employee 2 | `100000005` | `employee_2` | SAP EWM Team |
| EMPLOYEE | Employee 3 | `100000006` | `employee_3` | Automation Team |

Также seed добавляет балансы, операции баланса, pending и approved заявки на отгулы и отпуска.
