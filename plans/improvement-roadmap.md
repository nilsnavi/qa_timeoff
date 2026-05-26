# План улучшений QA TimeOff

## Обзор

Этот документ описывает пошаговый план улучшения проекта QA TimeOff для достижения production-ready состояния. План разделен на 5 фаз, каждая из которых фокусируется на конкретных аспектах качества и надежности.

---

## Фаза 1: Безопасность и логирование

### 1.1 Безопасность Backend

#### 1.1.1 Установка security пакетов
```bash
npm install --workspace @qa-timeoff/backend helmet @nestjs/throttler
npm install --workspace @qa-timeoff/backend --save-dev @types/helmet
```

**Пакеты**:
- `helmet` - HTTP security headers
- `@nestjs/throttler` - Rate limiting

#### 1.1.2 Настройка Helmet
**Файл**: [`apps/backend/src/main.ts`](apps/backend/src/main.ts)

Добавить:
- Helmet middleware для security headers
- CSP (Content Security Policy)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options, X-Content-Type-Options

#### 1.1.3 Настройка Rate Limiting
**Файл**: [`apps/backend/src/app.module.ts`](apps/backend/src/app.module.ts)

Добавить ThrottlerModule:
- Глобальный rate limit: 100 запросов/минуту
- Специальные лимиты для auth endpoints: 5 попыток/минуту
- Кастомные лимиты для разных ролей

**Новый файл**: `apps/backend/src/common/guards/throttler-behind-proxy.guard.ts`
- Guard для работы за reverse proxy (Nginx)

#### 1.1.4 CORS настройка
**Файл**: [`apps/backend/src/main.ts`](apps/backend/src/main.ts)

Улучшить CORS:
- Использовать whitelist доменов из env
- Настроить credentials
- Ограничить методы и headers

#### 1.1.5 Input Sanitization
**Новый файл**: `apps/backend/src/common/pipes/sanitize.pipe.ts`

Создать pipe для санитизации входных данных:
- Удаление HTML тегов
- Защита от XSS
- Trim строк

### 1.2 Логирование Backend

#### 1.2.1 Установка Winston
```bash
npm install --workspace @qa-timeoff/backend winston nest-winston
```

#### 1.2.2 Настройка Winston Logger
**Новый файл**: `apps/backend/src/common/logger/winston.config.ts`

Конфигурация:
- Console transport для development
- File transport для production
- JSON формат для парсинга
- Rotation логов (daily)
- Уровни: error, warn, info, debug

#### 1.2.3 Интеграция в приложение
**Файл**: [`apps/backend/src/main.ts`](apps/backend/src/main.ts)

- Заменить стандартный NestJS logger на Winston
- Добавить request logging middleware

**Новый файл**: `apps/backend/src/common/middleware/logger.middleware.ts`
- Логирование всех HTTP запросов
- Request ID для трейсинга
- Время выполнения запроса

#### 1.2.4 Логирование в сервисах
Обновить ключевые сервисы:
- [`apps/backend/src/auth/auth.service.ts`](apps/backend/src/auth/auth.service.ts)
- [`apps/backend/src/timeoff/timeoff.service.ts`](apps/backend/src/timeoff/timeoff.service.ts)
- [`apps/backend/src/vacation/vacation.service.ts`](apps/backend/src/vacation/vacation.service.ts)
- [`apps/backend/src/balance/balance.service.ts`](apps/backend/src/balance/balance.service.ts)

Добавить логирование:
- Успешных операций (info)
- Ошибок (error)
- Важных бизнес-событий (warn)

### 1.3 Переменные окружения

#### 1.3.1 Обновить env.validation.ts
**Файл**: [`apps/backend/src/config/env.validation.ts`](apps/backend/src/config/env.validation.ts)

Добавить новые переменные:
- `RATE_LIMIT_TTL` - время окна rate limit
- `RATE_LIMIT_MAX` - максимум запросов
- `LOG_LEVEL` - уровень логирования
- `LOG_DIR` - директория для логов
- `ALLOWED_ORIGINS` - список разрешенных CORS origins

#### 1.3.2 Обновить .env.example
**Файлы**: 
- [`apps/backend/.env.example`](apps/backend/.env.example)
- [`.env.example`](.env.example)

### 1.4 Безопасность Frontend

#### 1.4.1 Content Security Policy
**Файл**: [`apps/frontend/index.html`](apps/frontend/index.html)

Добавить CSP meta tags для защиты от XSS

#### 1.4.2 Sanitization пользовательского ввода
```bash
npm install --workspace @qa-timeoff/frontend dompurify
npm install --workspace @qa-timeoff/frontend --save-dev @types/dompurify
```

**Новый файл**: `apps/frontend/src/shared/utils/sanitize.ts`
- Функции для санитизации HTML
- Валидация URL
- Escape специальных символов

#### 1.4.3 Защита токенов
**Файл**: [`apps/frontend/src/shared/api/client.ts`](apps/frontend/src/shared/api/client.ts)

Улучшения:
- HttpOnly cookies вместо localStorage (если возможно)
- Автоматическое обновление токенов
- Очистка токена при logout

---

## Фаза 2: Обработка ошибок и мониторинг

### 2.1 Обработка ошибок Backend

#### 2.1.1 Глобальный Exception Filter
**Новый файл**: `apps/backend/src/common/filters/http-exception.filter.ts`

Создать централизованный обработчик:
- Структурированные error responses
- Логирование всех ошибок
- Скрытие sensitive информации в production
- Mapping различных типов ошибок

#### 2.1.2 Кастомные исключения
**Новая директория**: `apps/backend/src/common/exceptions/`

Создать специфичные исключения:
- `BusinessLogicException` - бизнес-логика
- `ValidationException` - валидация
- `AuthorizationException` - авторизация
- `ResourceNotFoundException` - не найден ресурс

#### 2.1.3 Error Response DTO
**Новый файл**: `apps/backend/src/common/dto/error-response.dto.ts`

Стандартизированный формат ошибок:
```typescript
{
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}
```

#### 2.1.4 Prisma Error Handling
**Новый файл**: `apps/backend/src/common/filters/prisma-exception.filter.ts`

Обработка Prisma ошибок:
- Unique constraint violations
- Foreign key violations
- Not found errors
- Connection errors

### 2.2 Обработка ошибок Frontend

#### 2.2.1 Error Boundary
**Новый файл**: `apps/frontend/src/app/ErrorBoundary.tsx`

React Error Boundary для перехвата ошибок рендеринга:
- Fallback UI
- Логирование ошибок
- Кнопка "Попробовать снова"

#### 2.2.2 API Error Handling
**Файл**: [`apps/frontend/src/shared/api/client.ts`](apps/frontend/src/shared/api/client.ts)

Улучшить обработку:
- Типизированные ошибки
- Retry логика для network errors
- Timeout handling
- Offline detection

**Новый файл**: `apps/frontend/src/shared/api/errors.ts`
- Классы ошибок
- Error parser
- User-friendly сообщения

#### 2.2.3 TanStack Query Error Handling
**Файл**: [`apps/frontend/src/app/providers.tsx`](apps/frontend/src/app/providers.tsx)

Настроить глобальные обработчики:
- onError callback
- Retry стратегии
- Error notifications

### 2.3 Мониторинг и Observability

#### 2.3.1 Health Checks
**Новый файл**: `apps/backend/src/health/health.controller.ts`
**Новый файл**: `apps/backend/src/health/health.module.ts`

```bash
npm install --workspace @qa-timeoff/backend @nestjs/terminus
```

Endpoints:
- `/health` - общий статус
- `/health/db` - статус БД
- `/health/memory` - использование памяти
- `/health/disk` - использование диска

#### 2.3.2 Metrics Endpoint
**Новый файл**: `apps/backend/src/metrics/metrics.controller.ts`

Базовые метрики:
- Количество запросов
- Время ответа
- Ошибки по типам
- Активные пользователи

#### 2.3.3 Request ID Tracking
**Новый файл**: `apps/backend/src/common/middleware/request-id.middleware.ts`

- Генерация уникального ID для каждого запроса
- Передача через headers
- Логирование с request ID

#### 2.3.4 Performance Monitoring
**Новый файл**: `apps/backend/src/common/interceptors/logging.interceptor.ts`

Interceptor для измерения:
- Время выполнения endpoints
- Размер response
- Медленные запросы (> 1s)

---

## Фаза 3: Тестирование и CI/CD

### 3.1 Backend Testing

#### 3.1.1 Настройка Jest
**Файл**: `apps/backend/jest.config.js` (создать)

```bash
npm install --workspace @qa-timeoff/backend --save-dev jest @types/jest ts-jest
```

Конфигурация:
- Coverage thresholds (80%)
- Test environment (node)
- Setup files

#### 3.1.2 Unit Tests для сервисов
Создать тесты для каждого сервиса:

**Новые файлы**:
- `apps/backend/src/auth/auth.service.spec.ts`
- `apps/backend/src/timeoff/timeoff.service.spec.ts`
- `apps/backend/src/vacation/vacation.service.spec.ts`
- `apps/backend/src/balance/balance.service.spec.ts`
- `apps/backend/src/users/users.service.spec.ts`
- `apps/backend/src/teams/teams.service.spec.ts`

Покрытие:
- Успешные сценарии
- Ошибочные сценарии
- Edge cases
- Мокирование Prisma

#### 3.1.3 Integration Tests
**Новая директория**: `apps/backend/test/integration/`

Тесты для:
- Auth flow (login, JWT validation)
- CRUD операции
- Approval workflows
- Balance operations

#### 3.1.4 E2E Tests
**Новая директория**: `apps/backend/test/e2e/`

```bash
npm install --workspace @qa-timeoff/backend --save-dev supertest @types/supertest
```

Тесты полных сценариев:
- Создание и одобрение time-off
- Создание и одобрение vacation
- Balance operations flow
- Admin operations

#### 3.1.5 Test Database
**Файл**: `apps/backend/test/setup.ts`

- Настройка тестовой БД
- Seed данные для тестов
- Cleanup после тестов

### 3.2 Frontend Testing

#### 3.2.1 Настройка Vitest
**Файл**: `apps/frontend/vitest.config.ts` (создать)

```bash
npm install --workspace @qa-timeoff/frontend --save-dev vitest @vitest/ui jsdom
npm install --workspace @qa-timeoff/frontend --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

#### 3.2.2 Unit Tests для компонентов
**Новые файлы**:
- `apps/frontend/src/components/ui/index.test.tsx`
- `apps/frontend/src/components/balance/BalanceSummary.test.tsx`
- `apps/frontend/src/components/calendar/CalendarEventList.test.tsx`
- `apps/frontend/src/components/requests/RequestList.test.tsx`

#### 3.2.3 Unit Tests для утилит
**Новые файлы**:
- `apps/frontend/src/shared/utils/date.test.ts`
- `apps/frontend/src/shared/utils/labels.test.ts`
- `apps/frontend/src/shared/api/client.test.ts`

#### 3.2.4 Integration Tests для страниц
**Новые файлы**:
- `apps/frontend/src/pages/HomePage.test.tsx`
- `apps/frontend/src/pages/CreateTimeOffPage.test.tsx`
- `apps/frontend/src/pages/CreateVacationPage.test.tsx`
- `apps/frontend/src/pages/BalancePage.test.tsx`

#### 3.2.5 E2E Tests с Playwright
```bash
npm install --workspace @qa-timeoff/frontend --save-dev @playwright/test
```

**Новая директория**: `apps/frontend/e2e/`

Тесты:
- `auth.spec.ts` - авторизация
- `timeoff.spec.ts` - создание отгула
- `vacation.spec.ts` - создание отпуска
- `approval.spec.ts` - процесс одобрения
- `calendar.spec.ts` - календарь

**Файл**: `apps/frontend/playwright.config.ts`

### 3.3 CI/CD Pipeline

#### 3.3.1 GitHub Actions Workflow
**Новый файл**: `.github/workflows/ci.yml`

Stages:
1. **Lint**: ESLint для frontend и backend
2. **Type Check**: TypeScript compilation
3. **Test**: Unit и integration тесты
4. **Build**: Production build
5. **E2E**: Playwright тесты

Triggers:
- Push в main/develop
- Pull requests
- Manual dispatch

#### 3.3.2 Docker Build Workflow
**Новый файл**: `.github/workflows/docker.yml`

- Build Docker images
- Push в registry (опционально)
- Tag по версии

#### 3.3.3 Pre-commit Hooks
```bash
npm install --save-dev husky lint-staged
```

**Файл**: `.husky/pre-commit`

Запускать перед коммитом:
- Lint staged files
- Type check
- Unit tests для измененных файлов

**Файл**: `.lintstagedrc.json`

#### 3.3.4 Conventional Commits
```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

**Файл**: `.commitlintrc.json`

Enforce commit message format:
- feat: новая функциональность
- fix: исправление бага
- docs: документация
- test: тесты
- refactor: рефакторинг

---

## Фаза 4: Производительность и оптимизация

### 4.1 Backend Caching

#### 4.1.1 Redis Setup
```bash
npm install --workspace @qa-timeoff/backend @nestjs/cache-manager cache-manager
npm install --workspace @qa-timeoff/backend cache-manager-redis-yet redis
```

**Файл**: [`docker-compose.yml`](docker-compose.yml)

Добавить Redis service:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
```

#### 4.1.2 Cache Module
**Новый файл**: `apps/backend/src/cache/cache.module.ts`

Настройка:
- Redis connection
- TTL по умолчанию
- Cache key prefix

#### 4.1.3 Кэширование в сервисах
Добавить кэширование в:
- [`apps/backend/src/dashboard/dashboard.service.ts`](apps/backend/src/dashboard/dashboard.service.ts) - dashboard data (TTL: 5 мин)
- [`apps/backend/src/calendar/calendar.service.ts`](apps/backend/src/calendar/calendar.service.ts) - calendar events (TTL: 10 мин)
- [`apps/backend/src/users/users.service.ts`](apps/backend/src/users/users.service.ts) - user list (TTL: 15 мин)
- [`apps/backend/src/teams/teams.service.ts`](apps/backend/src/teams/teams.service.ts) - team list (TTL: 15 мин)

#### 4.1.4 Cache Invalidation
**Новый файл**: `apps/backend/src/cache/cache.service.ts`

Методы для инвалидации:
- По ключу
- По паттерну
- По тегам

Инвалидация при:
- Создании/обновлении/удалении данных
- Одобрении/отклонении заявок
- Изменении баланса

### 4.2 Database Optimization

#### 4.2.1 Индексы
**Новая миграция**: `apps/backend/prisma/migrations/YYYYMMDDHHMMSS_add_indexes/migration.sql`

Добавить индексы:
```sql
-- User lookups
CREATE INDEX idx_user_telegram_id ON "User"("telegramId");
CREATE INDEX idx_user_team_id ON "User"("teamId");
CREATE INDEX idx_user_manager_id ON "User"("managerId");
CREATE INDEX idx_user_role ON "User"("role");

-- Request queries
CREATE INDEX idx_timeoff_user_id ON "TimeOffRequest"("userId");
CREATE INDEX idx_timeoff_status ON "TimeOffRequest"("status");
CREATE INDEX idx_timeoff_date ON "TimeOffRequest"("date");
CREATE INDEX idx_vacation_user_id ON "VacationRequest"("userId");
CREATE INDEX idx_vacation_status ON "VacationRequest"("status");
CREATE INDEX idx_vacation_dates ON "VacationRequest"("startDate", "endDate");

-- Balance operations
CREATE INDEX idx_balance_user_id ON "BalanceOperation"("userId");
CREATE INDEX idx_balance_created_at ON "BalanceOperation"("createdAt");

-- Notifications
CREATE INDEX idx_notification_user_id ON "Notification"("userId");
CREATE INDEX idx_notification_is_read ON "Notification"("isRead");
```

#### 4.2.2 Query Optimization
Оптимизировать запросы в сервисах:
- Использовать `select` для выборки только нужных полей
- Добавить pagination для списков
- Использовать `include` вместо отдельных запросов
- Batch операции где возможно

**Файлы для оптимизации**:
- [`apps/backend/src/dashboard/dashboard.service.ts`](apps/backend/src/dashboard/dashboard.service.ts)
- [`apps/backend/src/calendar/calendar.service.ts`](apps/backend/src/calendar/calendar.service.ts)
- [`apps/backend/src/balance/balance.service.ts`](apps/backend/src/balance/balance.service.ts)

#### 4.2.3 Connection Pooling
**Файл**: [`apps/backend/src/prisma/prisma.service.ts`](apps/backend/src/prisma/prisma.service.ts)

Настроить connection pool:
```typescript
datasources: {
  db: {
    url: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
    }
  }
}
```

#### 4.2.4 Pagination DTO
**Новый файл**: `apps/backend/src/common/dto/pagination.dto.ts`

Стандартизированная пагинация:
```typescript
class PaginationDto {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

Применить в endpoints:
- GET /users
- GET /balance/operations
- GET /timeoff/my
- GET /vacation/my
- GET /notifications

### 4.3 Real-Time Updates

#### 4.3.1 WebSocket Setup
```bash
npm install --workspace @qa-timeoff/backend @nestjs/websockets @nestjs/platform-socket.io
npm install --workspace @qa-timeoff/backend socket.io
npm install --workspace @qa-timeoff/frontend socket.io-client
```

#### 4.3.2 WebSocket Gateway
**Новый файл**: `apps/backend/src/websocket/websocket.gateway.ts`
**Новый файл**: `apps/backend/src/websocket/websocket.module.ts`

Events:
- `notification:new` - новое уведомление
- `request:updated` - обновление заявки
- `balance:updated` - обновление баланса

#### 4.3.3 WebSocket Authentication
**Новый файл**: `apps/backend/src/websocket/ws-jwt.guard.ts`

JWT authentication для WebSocket connections

#### 4.3.4 Frontend WebSocket Client
**Новый файл**: `apps/frontend/src/shared/api/websocket.ts`

- Connection management
- Auto-reconnect
- Event handlers
- React hooks для подписки

**Новый файл**: `apps/frontend/src/shared/hooks/useWebSocket.ts`

#### 4.3.5 Real-Time Notifications
Обновить:
- [`apps/frontend/src/pages/NotificationsPage.tsx`](apps/frontend/src/pages/NotificationsPage.tsx)
- [`apps/frontend/src/components/layout/AppLayout.tsx`](apps/frontend/src/components/layout/AppLayout.tsx)

Добавить real-time обновления

### 4.4 Frontend Optimization

#### 4.4.1 Code Splitting
**Файл**: [`apps/frontend/src/app/router.tsx`](apps/frontend/src/app/router.tsx)

Lazy loading для страниц:
```typescript
const AdminPage = lazy(() => import('../pages/AdminPage'));
const BalancePage = lazy(() => import('../pages/BalancePage'));
// и т.д.
```

#### 4.4.2 Image Optimization
**Файл**: [`apps/frontend/vite.config.ts`](apps/frontend/vite.config.ts)

Добавить плагины:
```bash
npm install --workspace @qa-timeoff/frontend --save-dev vite-plugin-image-optimizer
```

#### 4.4.3 Bundle Analysis
```bash
npm install --workspace @qa-timeoff/frontend --save-dev rollup-plugin-visualizer
```

**Файл**: [`apps/frontend/vite.config.ts`](apps/frontend/vite.config.ts)

Добавить visualizer plugin

#### 4.4.4 Service Worker для Offline
**Новый файл**: `apps/frontend/src/service-worker.ts`

```bash
npm install --workspace @qa-timeoff/frontend workbox-window
```

Базовое кэширование для offline работы

---

## Фаза 5: Документация и финальные улучшения

### 5.1 API Documentation

#### 5.1.1 Swagger Enhancements
Улучшить Swagger документацию во всех контроллерах:
- `@ApiTags()` для группировки
- `@ApiOperation()` для описания
- `@ApiResponse()` для всех возможных ответов
- `@ApiParam()` и `@ApiQuery()` для параметров
- Примеры запросов и ответов

**Файлы для обновления**:
- Все `*.controller.ts` файлы в backend

#### 5.1.2 OpenAPI Export
**Новый скрипт** в `apps/backend/package.json`:
```json
"openapi:generate": "ts-node scripts/generate-openapi.ts"
```

**Новый файл**: `apps/backend/scripts/generate-openapi.ts`

Генерация OpenAPI spec в JSON/YAML

### 5.2 Code Documentation

#### 5.2.1 JSDoc для Backend
Добавить JSDoc комментарии:
- Все public методы в сервисах
- Все DTOs
- Сложная бизнес-логика

**Шаблон**:
```typescript
/**
 * Создает новую заявку на отгул
 * @param userId - ID пользователя
 * @param dto - Данные заявки
 * @returns Созданная заявка
 * @throws {BadRequestException} Если недостаточно часов на балансе
 */
```

#### 5.2.2 JSDoc для Frontend
Добавить JSDoc для:
- Все кастомные хуки
- Утилитарные функции
- Сложные компоненты

#### 5.2.3 TypeDoc
```bash
npm install --save-dev typedoc
```

**Файл**: `typedoc.json`

Генерация HTML документации из JSDoc

### 5.3 Architecture Decision Records

#### 5.3.1 ADR Template
**Новый файл**: `docs/adr/template.md`

Шаблон для ADR

#### 5.3.2 Существующие решения
Документировать ключевые решения:

**Новые файлы**:
- `docs/adr/001-monorepo-structure.md`
- `docs/adr/002-nestjs-backend.md`
- `docs/adr/003-prisma-orm.md`
- `docs/adr/004-telegram-mini-app.md`
- `docs/adr/005-jwt-authentication.md`

### 5.4 Developer Guide

#### 5.4.1 Contributing Guide
**Новый файл**: `CONTRIBUTING.md`

Содержание:
- Как настроить dev окружение
- Code style guide
- Commit message conventions
- Pull request process
- Testing requirements

#### 5.4.2 Development Guide
**Новый файл**: `docs/DEVELOPMENT.md`

Содержание:
- Архитектура проекта
- Структура директорий
- Naming conventions
- Best practices
- Debugging tips

#### 5.4.3 Deployment Guide
**Новый файл**: `docs/DEPLOYMENT.md`

Содержание:
- Production checklist
- Environment variables
- Database migrations
- Docker deployment
- Monitoring setup
- Backup strategy

### 5.5 Shared Package

#### 5.5.1 Общие типы
**Файл**: [`packages/shared/src/index.ts`](packages/shared/src/index.ts)

Переместить общие типы из frontend в shared:
- User, Team, Role
- Request types и statuses
- Balance types
- Notification types

#### 5.5.2 Общие константы
**Новый файл**: `packages/shared/src/constants.ts`

Константы:
- Роли и их права
- Статусы заявок
- Типы операций
- Лимиты (max hours, max days)

#### 5.5.3 Общие валидаторы
**Новый файл**: `packages/shared/src/validators.ts`

Валидация:
- Email format
- Date ranges
- Hour limits
- Username format

#### 5.5.4 Использование в проектах
Обновить импорты в frontend и backend для использования shared package

### 5.6 Финальные улучшения

#### 5.6.1 Internationalization (i18n)
```bash
npm install --workspace @qa-timeoff/frontend i18next react-i18next
```

**Новая директория**: `apps/frontend/src/locales/`
- `ru.json` - русский
- `en.json` - английский

**Файл**: `apps/frontend/src/app/i18n.ts`

#### 5.6.2 Error Tracking (Sentry)
```bash
npm install --workspace @qa-timeoff/backend @sentry/node
npm install --workspace @qa-timeoff/frontend @sentry/react
```

**Файлы**:
- `apps/backend/src/sentry.ts`
- `apps/frontend/src/sentry.ts`

#### 5.6.3 Analytics
Добавить базовую аналитику:
- Количество созданных заявок
- Время одобрения
- Активность пользователей

**Новый файл**: `apps/backend/src/analytics/analytics.service.ts`

#### 5.6.4 Backup Strategy
**Новый файл**: `scripts/backup-db.sh`

Скрипт для бэкапа PostgreSQL:
- Daily backups
- Retention policy (30 days)
- Compression

**Файл**: `docs/BACKUP.md`

Документация по бэкапам

---

## Приоритеты выполнения

### Критичные (Must Have)
1. ✅ Безопасность: Helmet, Rate Limiting, CORS
2. ✅ Логирование: Winston, Request logging
3. ✅ Обработка ошибок: Exception filters, Error boundaries
4. ✅ Health checks
5. ✅ Unit тесты для критичных сервисов
6. ✅ CI/CD pipeline (базовый)

### Важные (Should Have)
7. Integration и E2E тесты
8. Database индексы и оптимизация
9. Redis кэширование
10. Request ID tracking
11. Pagination
12. Swagger улучшения

### Желательные (Nice to Have)
13. WebSocket для real-time
14. Frontend optimization (code splitting)
15. i18n
16. Sentry integration
17. Analytics
18. Полная документация (JSDoc, ADR)

---

## Оценка трудозатрат

| Фаза | Задач | Сложность |
|------|-------|-----------|