# План подключения неподключенных бэкенд-эндпоинтов к фронтенду

## Категория A: Эндпоинты без фронтенд-методов (12 шт.)

### А1. Добавить методы в `client.ts`

| № | Эндпоинт | Метод API | Описание |
|---|----------|-----------|----------|
| 1 | `GET /balance/user/:userId` | `getUserBalance(userId)` | Баланс конкретного пользователя |
| 2 | `GET /calendar/user/:userId` | `calendarUser(userId)` | Календарь конкретного пользователя |
| 3 | `GET /leave-requests/:id` | `getLeaveRequest(id)` | Одна заявка по ID |
| 4 | `GET /users/:id` | `getUser(id)` | Один пользователь по ID |
| 5 | `DELETE /users/:id` | `deleteUser(id)` | Удаление пользователя |

### А2. Endpoints для которых не нужен UI (дублирующие/легаси)

| № | Эндпоинт | Причина |
|---|----------|---------|
| 6 | `POST /auth/telegram` | Telegram-авторизация отключена (`VITE_ENABLE_TELEGRAM_AUTH=false`). Включить при необходимости. |
| 7 | `POST /requests` | Generic-запросы — заменены timeoff/vacation/leave-requests. Можно не подключать. |
| 8 | `POST /admin/accruals` | Дублирует `POST /balance/add`. Удалить или объединить. |
| 9 | `POST /admin/write-offs` | Дублирует `POST /balance/write-off`. Удалить или объединить. |
| 10 | `PATCH /admin/users/:id/role` | Фронтенд использует `PATCH /users/:id` (users controller). Роль меняется через `updateUser()`. |
| 11 | `GET /admin/overtime` | Список всех overtime — заменить на `overtimeReport()` с теми же фильтрами. |
| 12 | `POST /admin/users` | Дублирует `POST /users`. Фронтенд использует users controller. |

### А3. Действия ✅ Выполнено
1. ✅ Добавлено 5 методов в `client.ts` — `getUserBalance`, `getUser`, `deleteUser`, `calendarUser`, `getLeaveRequest`
2. ✅ Помечены `@deprecated` дублирующие admin-эндпоинты (`admin/accruals`, `admin/write-offs`, `admin/users`, `admin/users/:id/role`)
3. ✅ Помечены `@deprecated` `POST /auth/telegram` и `POST /requests`

---

## Категория B: Методы API есть, но не вызываются в UI (29 шт.)

### B1. Высокий приоритет — функционал виден в админке

| Метод | Endpoint | Статус |
|-------|----------|--------|
| `adminUsers()` | `GET /admin/users` | ✅ AdminPage — заменён `api.users` на `api.adminUsers` с серверной фильтрацией |
| `addBalance()` | `POST /balance/add` | ✅ AdminPage — модалка начисления часов (иконка кошелька в строке пользователя) |
| `writeOffBalance()` | `POST /balance/write-off` | ✅ AdminPage — модалка списания часов (иконка минуса в строке пользователя) |
| `createTeam()` | `POST /teams` | ✅ AdminPage — кнопка "Добавить" на вкладке Команды |
| `updateTeam()` | `PATCH /teams/:id` | ✅ AdminPage — иконка редактирования на карточке команды |
| `deleteTeam()` | `DELETE /teams/:id` | ✅ AdminPage — иконка удаления на карточке команды |
| `disableUser()` | `PATCH /admin/users/:id/disable` | ✅ Уже использовалось |
| `updateUser()` | `PATCH /users/:id` | ✅ AdminPage — иконка редактирования в строке пользователя |

### B2. Средний приоритет — отдельные админ-страницы ✅ Выполнено

| Метод | Endpoint | Статус |
|-------|----------|--------|
| `kpiList()` | `GET /admin/kpi` | ✅ Вкладка KPI с выбором месяца/года и кнопкой пересчёта |
| `kpiByUser()` | `GET /admin/kpi/user/:id` | ✅ Используется через kpiList с фильтром пользователя |
| `recalculateKpi()` | `POST /admin/kpi/recalculate` | ✅ Кнопка "Пересчитать KPI" |
| `workloadReport()` | `GET /admin/analytics/workload` | ✅ Вкладка Аналитика с фильтрами дат и команды |
| `aiForecast()` | `GET /admin/ai/overtime-forecast` | ✅ Вкладка AI Forecast с фильтром команды |
| `addOvertime()` | `POST /admin/overtime` | ✅ Вкладка Овертайм — модалка добавления |
| `overtimeReport()` | `GET /admin/reports/overtime` | ✅ Вкладка Овертайм — сводка по отделам |
| `payrollReport()` | `GET /admin/reports/payroll` | ✅ Экспорт CSV |
| `overtimeCalendar()` | `GET /admin/overtime/calendar` | ✅ Календарь овертайма с фильтром по сотруднику |
| `userOvertime()` | `GET /admin/overtime/user/:userId` | ✅ Вкладка Овертайм — выбор сотрудника + список записей |
| `cancelOvertime()` | `PATCH /admin/overtime/:id/cancel` | ✅ Вкладка Овертайм — иконка корзины на записи |
| `updatePosition()` | `PATCH /admin/users/:id/position` | ✅ Модалка редактирования пользователя |
| `positionHistory()` | `GET /admin/users/:id/position-history` | ✅ История должностей в модалке редактирования |
| `updateHourlyRate()` | `PATCH /admin/users/:id/hourly-rate` | ✅ Модалка редактирования пользователя |

### B3. Низкий приоритет — экспорт ✅ Выполнено

| Метод | Endpoint | Статус |
|-------|----------|--------|
| `exportOvertimeCsv()` | `GET /admin/export/overtime.csv` | ✅ Вкладка Экспорт |
| `exportPayrollCsv()` | `GET /admin/export/payroll.csv` | ✅ Вкладка Экспорт |
| `exportKpiCsv()` | `GET /admin/export/kpi.csv` | ✅ Вкладка Экспорт |
| `export1cOvertimeCsv()` | `GET /admin/export/1c/overtime.csv` | ✅ Вкладка Экспорт |
| `export1cPayrollCsv()` | `GET /admin/export/1c/payroll.csv` | ✅ Вкладка Экспорт |

### B4. Низкий приоритет — редко используемые

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `balanceOperations()` | `GET /balance/operations` | Заменяется `balanceLedger()` на BalancePage |
| `userOperations()` | `GET /balance/operations/:userId` | Админский просмотр операций пользователя |
| `updateCalendarEvent()` | `PATCH /calendar/events/:id` | CalendarEventsPage — редактирование события (drag'n'drop) |

---

## Итого

| Категория | Статус | Оценка |
|-----------|--------|--------|
| A: добавить методы в client.ts | ✅ Выполнено | 1 час |
| A: пометить `@deprecated` дубликаты | ✅ Выполнено | 1 час |
| B1: интегрировать в существующие страницы | ✅ Выполнено | 4 часа |
| B2: новые вкладки в AdminPage (KPI, Овертайм, Аналитика) | ✅ Выполнено | ~8 часов |
| B3: экспорт (кнопки экспорта) | ✅ Выполнено | 1 час |
| B4: редкие (`balanceOperations`, `userOperations`, `updateCalendarEvent`, `aiForecast`, `overtimeCalendar`, `cancelOvertime`, `updatePosition`, `positionHistory`, `updateHourlyRate`) | ✅ Выполнено | ~8 часов |
