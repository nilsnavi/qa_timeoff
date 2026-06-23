# QA TimeOff Mini App

Telegram Mini App для учета отсутствий QA-команды: отгулы, отпуска, больничные, балансы часов, согласование заявок, календарь команды и администрирование пользователей.

## Стек

- Frontend: React 18, Vite, TypeScript, TailwindCSS, React Router, TanStack Query, Telegram WebApp API.
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis, JWT, Swagger.
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

## Запуск через Docker (рекомендуется)

Требования: **Docker 24+** и **Docker Compose v2**.

```bash
# 1. Подготовить переменные окружения (один корневой .env на все сервисы)
cp .env.example .env
# Отредактировать .env: задать JWT_SECRET, TELEGRAM_BOT_TOKEN
# На первом запуске можно поставить RUN_SEED=true для демо-данных

# 2. Собрать образы и поднять весь стек
docker compose up -d --build

# 3. Логи (по желанию)
docker compose logs -f backend
```

Когда все контейнеры готовы:

| Назначение     | URL                                  |
| -------------- | ------------------------------------ |
| Mini App UI    | http://localhost:8080                |
| API через nginx| http://localhost:8080/api            |
| Swagger        | http://localhost:8080/api/docs       |
| API напрямую   | http://localhost:3000                |
| PostgreSQL     | localhost:5432 (user `qa_timeoff`)   |
| Redis          | localhost:6379                       |

Backend-контейнер на старте автоматически выполняет `prisma migrate deploy`,
поэтому схема БД всегда синхронна с кодом. Установите `RUN_SEED=true` в `.env`
чтобы дополнительно загрузить демо-данные при первом запуске.

### Полезные команды Docker

```bash
# Остановить всё
docker compose down

# Остановить и стереть volume БД (полный сброс)
docker compose down -v

# Пересобрать один сервис после изменений в коде
docker compose build backend && docker compose up -d backend

# Открыть shell внутри backend-контейнера
docker compose exec backend sh

# Запустить seed вручную в любой момент
docker compose exec backend node apps/backend/dist/prisma/seed.js
```

### Переменные окружения (`.env`)

| Переменная                  | По умолчанию             | Назначение                                       |
| --------------------------- | ------------------------ | ------------------------------------------------ |
| `APP_PORT`                  | `8080`                   | Порт хоста для nginx (UI + `/api`)               |
| `BACKEND_PORT`              | `3000`                   | Прямой порт backend на хосте                     |
| `POSTGRES_PORT`             | `5432`                   | Порт PostgreSQL на хосте                         |
| `REDIS_PORT`                | `6379`                   | Порт Redis на хосте                              |
| `POSTGRES_DB/USER/PASSWORD` | `qa_timeoff`             | Учётные данные БД                                |
| `JWT_SECRET`                | —                        | **Обязательная** длинная случайная строка        |
| `TELEGRAM_BOT_TOKEN`        | —                        | **Обязателен** для реальной Telegram-авторизации |
| `RUN_SEED`                  | `false`                  | Сидирование демо-данных при старте backend       |
| `VITE_API_URL`              | `/api`                   | Базовый URL API, инлайнится во фронтенд при сборке|
| `CORS_ORIGIN`/`ALLOWED_ORIGINS` | `http://localhost:8080` | Разрешённые источники для CORS                |
| `RATE_LIMIT_TTL`/`MAX`      | `60` / `100`             | Лимиты запросов                                  |
| `LOG_LEVEL`/`LOG_DIR`       | `info` / `logs`          | Логирование                                      |
| `CACHE_TTL`/`REDIS_URL`     | `300` / `redis://redis:6379` | Кэширование через Redis                      |

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

---

## Резервное копирование и восстановление БД

В проекте два уровня бэкапов:

1. **Автоматический (через Docker)** — встроенный сервис `db-backup` в [`docker-compose.yml`](docker-compose.yml:82) делает дамп каждый день в 3:00 ночи и хранит 30 дней.
2. **Ручной (на хосте)** — скрипты [`scripts/backup-db.sh`](scripts/backup-db.sh) и [`scripts/restore-db.sh`](scripts/restore-db.sh) для запуска вручную на сервере.

### Автоматический backup (Docker)

Сервис `db-backup` уже включён в `docker compose up -d`. Он:

- каждое утро в 03:00 выполняет `pg_dump` из контейнера `qa-timeoff-postgres`
- сохраняет архив в Docker volume `db-backups`
- удаляет архивы старше 30 дней

Настройка через переменные `.env`:

| Переменная                  | По умолчанию | Описание                        |
| --------------------------- | ------------ | ------------------------------- |
| `BACKUP_RETENTION_DAYS`     | `30`         | Дней хранить архивы             |
| `BACKUP_SCHEDULE`           | `0 3 * * *`  | Cron-расписание (UTC)           |

Посмотреть сохранённые архивы:

```bash
docker compose exec db-backup ls -lh /backups
```

Вручную запустить backup внутри контейнера:

```bash
docker compose exec db-backup /usr/local/bin/backup.sh
```

### Ручной backup (на хосте)

Скрипт [`scripts/backup-db.sh`](scripts/backup-db.sh) делает дамп на файловую систему хоста.

```bash
# 1. Убедиться, что контейнеры запущены
sudo docker compose up -d

# 2. Запустить backup
sudo ./scripts/backup-db.sh
```

Результат:

```
/opt/backups/qa_timeoff/
  ├── qa_timeoff_2026-06-23_06-00.sql.gz
  ├── qa_timeoff_2026-06-22_06-00.sql.gz
  └── ...
```

Переменные окружения:

| Переменная        | По умолчанию             | Описание                        |
| ----------------- | ------------------------ | ------------------------------- |
| `BACKUP_DIR`      | `/opt/backups/qa_timeoff` | Куда сохранять архивы           |
| `RETENTION_DAYS`  | `30`                     | Дней хранить архивы             |
| `POSTGRES_USER`   | `qa_timeoff`             | Пользователь БД                 |
| `POSTGRES_DB`     | `qa_timeoff`             | Имя базы данных                 |

### Настройка cron на сервере

Чтобы backup запускался автоматически, добавьте задачу в cron на **хост-машине** (не в контейнере):

```bash
sudo crontab -e
```

```cron
# QA TimeOff — ежедневный backup в 03:00
0 3 * * * /opt/qa_timeoff/scripts/backup-db.sh >> /var/log/qa-timeoff-backup.log 2>&1
```

Проверить логи:

```bash
tail -f /var/log/qa-timeoff-backup.log
```

> **Важно:** Путь `/opt/qa_timeoff` замените на актуальный путь к проекту на сервере.

### Восстановление базы

Скрипт [`scripts/restore-db.sh`](scripts/restore-db.sh) восстанавливает базу из ранее созданного архива.

```bash
# 1. Убедиться, что контейнеры запущены
sudo docker compose up -d

# 2. Запустить restore (интерактивный режим — выберите backup из списка)
sudo ./scripts/restore-db.sh

# Или указать файл напрямую:
sudo BACKUP_FILE=/opt/backups/qa_timeoff/qa_timeoff_2026-06-23_06-00.sql.gz ./scripts/restore-db.sh

# Для unattended (CI / экстренное восстановление):
sudo FORCE=1 BACKUP_FILE=/path/to/dump.sql.gz ./scripts/restore-db.sh
```

Что делает скрипт:

1. Создаёт **safety backup** текущего состояния БД (на случай отката).
2. Разрывает все активные подключения к БД.
3. Удаляет и пересоздаёт базу данных.
4. Восстанавливает данные из указанного архива.
5. Проверяет количество таблиц после restore.

> **Внимание:** Restore перезаписывает текущую базу! Перед восстановлением всегда создаётся автоматический safety backup в `/opt/backups/qa_timeoff/__pre_restore_*.sql.gz`.

### Где хранятся backups

| Источник             | Путь                                              | Ручное удаление       |
| -------------------- | ------------------------------------------------- | --------------------- |
| Docker-сервис        | `docker volume: db-backups`                       | `docker compose down -v` |
| Хост-скрипты         | `/opt/backups/qa_timeoff/`                        | `sudo rm -rf /opt/backups` |

Backup-файлы **не хранятся в Git** — они исключены через [`.gitignore`](.gitignore).
