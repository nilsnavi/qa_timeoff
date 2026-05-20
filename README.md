# QA TimeOff Mini App

Telegram Mini App for QA time-off, vacation requests, hour balances, approvals and team absence calendar.

## Structure

```text
qa-timeoff-miniapp/
  apps/
    frontend/
    backend/
  packages/
    shared/
  docker-compose.yml
  README.md
```

## Stack

- Frontend: Vite, React, TypeScript, TailwindCSS, React Router, Zustand, React Query, Telegram WebApp SDK
- Backend: NestJS, Prisma, PostgreSQL, Swagger, ConfigModule, JWT, Role Guard
- Shared: common TypeScript role/request types
- Infra: Docker, Docker Compose, Nginx

## Environment

```bash
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
```

## Local Development

```bash
npm install
npm run prisma:generate
npm run dev:frontend
npm run dev:backend
```

Frontend: http://localhost:5173
Backend: http://localhost:3000
Swagger: http://localhost:3000/docs

## Docker

```bash
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
docker compose up --build
```

App: http://localhost:8080
API: http://localhost:8080/api
Swagger: http://localhost:8080/api/docs
