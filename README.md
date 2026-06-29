# QA TimeOff

Веб-приложение для учёта отсутствий QA-команды: отгулы, отпуска, больничные, балансы часов, согласование заявок, календарь команды и администрирование пользователей. Поддерживает режим Telegram Mini App.

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

### Режимы авторизации

Приложение поддерживает два режима входа.

#### Web App (режим по умолчанию)

Пользователи входят через email и пароль на странице `/login`.
Это основной production-режим. **Не требует Telegram.**

| Переменная | Значение |
|---|---|
| `AUTH_MODE` | `web` |
| `ENABLE_TELEGRAM_AUTH` | `false` |
| `TELEGRAM_BOT_TOKEN` | (не нужен) |

#### Telegram Mini App (опционально)

Пользователи входят через Telegram WebApp.initData — автоматически,
без формы логина/пароля. Приложение должно быть открыто внутри Telegram.

Для включения задайте в `.env`:

```bash
AUTH_MODE=telegram            # или both — разрешить оба способа
ENABLE_TELEGRAM_AUTH=true
TELEGRAM_BOT_TOKEN=<токен от @BotFather>
```

Требования:
- Бот должен быть привязан к Mini App через @BotFather
- Пользователи должны иметь заполненный `telegramId` в базе (через админку или импорт)
- Без `TELEGRAM_BOT_TOKEN` backend не стартует при `ENABLE_TELEGRAM_AUTH=true`

> Режим `both` поддерживается, но в production рекомендуется выбрать один.

## Деплой в продакшн

### 1. Сгенерировать секреты

```bash
# JWT_SECRET (минимум 32 символа)
echo "JWT_SECRET=$(openssl rand -hex 32)"

# Пароль базы данных
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

### 2. Создать .env файл

```bash
cp apps/backend/.env.example .env
```

Открыть .env и заполнить обязательные переменные:

| Переменная          | Описание                          | Как получить                         |
|---------------------|-----------------------------------|--------------------------------------|
| `JWT_SECRET`        | Секрет подписи JWT токенов        | `openssl rand -hex 32`              |
| `POSTGRES_PASSWORD` | Пароль базы данных                | `openssl rand -base64 24`           |
| `SMTP_HOST`         | SMTP-сервер для email             | У вашего провайдера                  |
| `SMTP_PORT`         | Порт SMTP                         | `465` (SSL) или `587` (STARTTLS)    |
| `SMTP_SECURE`       | Использовать SSL                  | `true` для 465, `false` для 587     |
| `SMTP_USER`         | Логин SMTP                        | У вашего провайдера                  |
| `SMTP_PASS`         | Пароль SMTP                       | У вашего провайдера                  |
| `EMAIL_FROM`        | Адрес отправителя                 | Пример: `QA TimeOff <noreply@domain.ru>` |
| `FRONTEND_URL`      | Публичный URL приложения          | Пример: `https://domain.ru`         |
| `CORS_ORIGIN`       | Разрешённый origin для CORS       | То же что `FRONTEND_URL`            |

> **SMTP обязателен в production.** Без настроенного SMTP backend не стартует при `NODE_ENV=production`. 
> При локальном запуске (`docker compose up` без `.env`) можно оставить SMTP_* пустыми.

### 3. Запустить

```bash
docker compose up -d --build
```

### 4. Проверить

```bash
# Все сервисы запущены
docker compose ps

# Health check
curl http://localhost:8080/health | jq .

# Логи бэкенда
docker compose logs backend --tail=50
```

### Сброс пароля администратора

Если забыт пароль admin-пользователя:

```bash
# Зайти в бэкенд контейнер
docker exec -it qa-timeoff-backend sh

# Сгенерировать новый хеш (заменить YOUR_NEW_PASSWORD)
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YOUR_NEW_PASSWORD', 10).then(h => console.log(h));
"

# Обновить в БД (заменить HASH и EMAIL)
docker exec -it qa-timeoff-postgres psql -U qa_timeoff -d qa_timeoff -c \
  "UPDATE \"User\" SET \"passwordHash\"='HASH', \"mustChangePassword\"=true WHERE email='EMAIL';"
```

### Обновление приложения

```bash
git pull
docker compose up -d --build
# Миграции применяются автоматически при старте бэкенда
```

### Переменные окружения (`.env`)

| Переменная                  | По умолчанию             | Назначение                                       |
| --------------------------- | ------------------------ | ------------------------------------------------ |
| `APP_PORT`                  | `8080`                   | Порт хоста для nginx (UI + `/api`)               |
| `BACKEND_PORT`              | `3000`                   | Прямой порт backend на хосте                     |
| `POSTGRES_PORT`             | `5432`                   | Порт PostgreSQL на хосте                         |
| `REDIS_PORT`                | `6379`                   | Порт Redis на хосте                              |
| `POSTGRES_DB/USER`          | `qa_timeoff`             | Имя БД и пользователь                            |
| `POSTGRES_PASSWORD`         | **обязателен**           | Пароль БД — `openssl rand -base64 24`            |
| `JWT_SECRET`                | **обязателен**           | Длинная случайная строка — `openssl rand -hex 32`|
| `SMTP_HOST`                 | —                        | SMTP-сервер; обязателен в production             |
| `SMTP_PORT`                 | `465`                    | Порт SMTP                                        |
| `SMTP_SECURE`               | `true`                   | SSL-подключение                                  |
| `SMTP_USER`/`SMTP_PASS`     | **обязательны в prod**   | Учётные данные SMTP                              |
| `EMAIL_FROM`                | **обязателен в prod**    | Адрес отправителя писем                          |
| `TELEGRAM_BOT_TOKEN`        | —                        | **Обязателен** для реальной Telegram-авторизации |
| `RUN_SEED`                  | `false`                  | Сидирование демо-данных при старте backend       |
| `VITE_API_URL`              | `/api`                   | Базовый URL API, инлайнится во фронтенд при сборке|
| `CORS_ORIGIN`/`ALLOWED_ORIGINS` | `http://localhost:8080` | Разрешённые источники для CORS                |
| `RATE_LIMIT_TTL`/`MAX`      | `60` / `100`             | Лимиты запросов                                  |
| `LOG_LEVEL`/`LOG_DIR`       | `info` / `logs`          | Логирование                                      |
| `CACHE_TTL`/`REDIS_URL`     | `300` / `redis://redis:6379` | Кэширование через Redis                      |
| `UPTIME_KUMA_PORT`          | `3001`                   | Порт мониторинга Uptime Kuma                     |
| `VITE_SENTRY_DSN`           | —                        | Sentry DSN для frontend (опционально)            |

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

### Проверка миграций перед production

Перед деплоем убедитесь, что схема Prisma (`schema.prisma`) синхронизирована
с файлами миграций. Все новые таблицы и enum'ы должны быть описаны в
`migration.sql` в папке `prisma/migrations/`.

```bash
# 1. Проверить состояние миграций (требуется работающая БД)
npx prisma migrate status --schema=apps/backend/prisma/schema.prisma

# Ожидаемый вывод (если всё в порядке):
#   Database migrations: All migrations have been successfully applied.
#   Current database: up-to-date

# 2. Если есть drift — создать новую миграцию
npx prisma migrate dev --schema=apps/backend/prisma/schema.prisma --name description_of_changes

# 3. Симулировать деплой на production (без реального применения)
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma --dry-run

# 4. Применить миграции
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

**Известные расхождения между schema.prisma и миграциями:**

| Элемент | Проблема | Статус |
|---|---|---|
| `model LeaveRequest` | Модель присутствует в schema.prisma, но ни одна миграция не создаёт таблицу `LeaveRequest` | Исправлено — добавлена миграция `20260625100100_migrate_leave_requests` |
| `enum CalendarEventStatus` | В schema.prisma: `CREATED, PENDING, APPROVED, ACTIVE, COMPLETED, CANCELLED`. В миграции `20260625140000`: `PENDING, APPROVED, REJECTED` | Открыто — требуется новая миграция для синхронизации |

Если `prisma migrate status` показывает несоответствия — **не деплойте** до
создания корректирующей миграции. Сначала исправьте, затем деплойте.

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

---

## Обновление приложения

### Обновление до новой версии

```bash
# 1. Зайти в директорию проекта
cd /path/to/qa_timeoff

# 2. Получить новый код
git pull

# 3. Пересобрать и перезапустить
docker compose up -d --build
```

Миграции БД применяются автоматически при старте backend-контейнера.
Downtime при обновлении: ~30 секунд (пока пересобираются контейнеры).

### Откат к предыдущей версии

```bash
# Посмотреть историю коммитов
git log --oneline -10

# Откатиться к конкретному коммиту
git checkout <commit-hash>

# Пересобрать
docker compose up -d --build
```

> ⚠️ Если между версиями были миграции БД — откат может сломать схему.
> Перед обновлением всегда делай ручной бэкап:
> ```bash
> docker compose exec db-backup /usr/local/bin/backup.sh
> ```

---

## Сброс пароля администратора

Если пароль администратора утерян:

### Способ 1 — Через другого администратора (рекомендуется)

Если в системе есть другой пользователь с ролью ADMIN:
1. Войти как этот администратор
2. Перейти в Администрирование → Пользователи
3. Найти нужного пользователя → кнопка 🔑 «Сбросить пароль»
4. Новый временный пароль будет отправлен на email пользователя
5. При следующем входе система попросит сменить пароль

### Способ 2 — Напрямую в базе данных

Если доступа к интерфейсу нет совсем:

```bash
# 1. Сгенерировать хеш нового временного пароля
docker compose exec backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('NewTempPass123!', 10).then(h => {
  console.log('HASH:', h);
}).catch(console.error);
"
```

Скопируй строку после `HASH:` (начинается с `$2b$`).

```bash
# 2. Обновить пароль в БД (замени HASH и EMAIL)
docker compose exec postgres psql -U qa_timeoff -d qa_timeoff -c "
UPDATE \"User\"
SET \"passwordHash\" = 'HASH_FROM_STEP_1',
    \"mustChangePassword\" = true
WHERE email = 'admin@yourdomain.ru';
"
```

```bash
# 3. Проверить что пользователь найден (должна вернуться 1 строка)
docker compose exec postgres psql -U qa_timeoff -d qa_timeoff -c "
SELECT id, \"fullName\", email, \"mustChangePassword\"
FROM \"User\"
WHERE email = 'admin@yourdomain.ru';
"
```

После входа с временным паролем система автоматически попросит задать постоянный.

### Способ 3 — Если нет доступа к серверу

Обратись к системному администратору с доступом к серверу.
Он выполнит Способ 2.

---

## Диагностика проблем

### Приложение не запускается

```bash
# Посмотреть статус всех контейнеров
docker compose ps

# Логи конкретного сервиса
docker compose logs backend --tail=50
docker compose logs postgres --tail=20

# Частая причина: не задан JWT_SECRET или POSTGRES_PASSWORD
docker compose exec backend env | grep JWT
docker compose exec backend env | grep POSTGRES
```

### Email не отправляется

```bash
# Проверить статус SMTP через API (нужен токен администратора)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/admin/smtp/status

# Отправить тестовое письмо
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com"}' \
     http://localhost:8080/api/admin/smtp/test
```

### Высокое потребление памяти

```bash
# Посмотреть потребление ресурсов
docker stats

# Перезапустить конкретный сервис
docker compose restart backend
```

### Ошибки в логах

```bash
# Только ошибки из backend (последние 100 строк)
docker compose logs backend --tail=100 | grep -i "error\|warn\|fail"

# Логи в файлах (если настроен LOG_DIR)
docker compose exec backend tail -f /app/logs/error-$(date +%Y-%m-%d).log
```

---

## CSP production checklist

Content Security Policy (CSP) защищает от XSS-атак. В проекте CSP настроена на двух уровнях:

### Backend (helm) — для API-ответов

Директивы задаются в `apps/backend/src/main.ts`:

| Переменная | По умолчанию | Описание |
|---|---|---|
| `CSP_REPORT_ONLY` | `true` | `true` — report-only (логи, не блокировка). `false` — блокирующий режим |

```bash
# Включить блокирующий режим в .env:
CSP_REPORT_ONLY=false
```

Если `SENTRY_DSN` задан — его origin (`https://o*.ingest.sentry.io`) автоматически
добавляется в `connect-src`. Если `ENABLE_TELEGRAM_AUTH=true` — добавляется
`https://api.telegram.org` и `https://web.telegram.org`.

### Frontend (Caddy) — для HTML-страниц

Статические файлы фронтенда обслуживает Caddy. CSP задана в `infra/Caddyfile`.
При изменении директив оба файла должны быть синхронизированы.

### Перед production

1. Убедиться, что приложение работает без CSP-нарушений в report-only:
   ```bash
   # Включить report-only
   CSP_REPORT_ONLY=true
   ```
2. Проверить Console в браузере — нет предупреждений вида:
   `[Report Only] Refused to connect to '...' because it violates CSP`
3. Найти источник нарушений и либо исправить, либо добавить в директивы:
   - Sentry DSN → `connect-src` (добавляется автоматически)
   - Telegram WebApp → `connect-src` `https://web.telegram.org`
   - Внешние API → `connect-src`
4. Включить блокировку:
   ```bash
   CSP_REPORT_ONLY=false
   ```
5. В Caddyfile раскомментировать/добавить `connect-src` для Sentry и Telegram,
   если их origin'ы отличаются от `self`.
