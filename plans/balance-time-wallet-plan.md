# Balance (Time Wallet) Screen - Implementation Plan

## Current State Analysis

### Existing Backend (`apps/backend/src/balance/`)
- `BalanceModule` with controller + service
- `GET /balance/me` → returns `TimeBalance` (balanceHours, totalAddedHours, totalUsedHours)
- `POST /balance/add` → admin adds hours with transaction + notification
- `POST /balance/write-off` → admin writes off hours with balance check
- `GET /balance/operations` → returns `BalanceOperation[]` (without pagination)
- `GET /balance/operations/:userId` → user-specific operations
- Prisma models: `TimeBalance`, `BalanceOperation` (with `ADD`, `WRITE_OFF`, `MANUAL_CORRECTION`, `EXPIRED`)

### Existing Frontend (`apps/frontend/src/pages/BalancePage.tsx`)
- Basic balance view with donut chart
- Two metric cards (accrued/used)
- Operations list with filters
- Uses enterprise card style from recent redesign

## Implementation Plan

### Phase 1: Backend Enhancements

#### 1.1 Add `GET /balance/history` endpoint
Returns daily balance snapshots for chart visualization.
Path: `apps/backend/src/balance/balance.controller.ts`
Response: `Array<{ date: string; balance: number; accrued: number; used: number }>`

Implementation approach: Generate history from `BalanceOperation` records by computing running totals per day. No new DB table needed.

#### 1.2 Add `GET /balance/ledger` endpoint
Returns paginated, immutable transaction log.
Path: `apps/backend/src/balance/balance.controller.ts`
Response: `{ items: LedgerEntry[], total: number, page: number }`
Each entry: `{ id, type, value, status, createdBy, timestamp, comment }`

#### 1.3 Add `GET /balance/summary` endpoint
Returns aggregated KPI data.
Path: `apps/backend/src/balance/balance.controller.ts`
Response: `{ accruedHours, usedHours, overtimeMultiplier, pendingRequests }`

### Phase 2: Frontend Rewrite

#### 2.1 Enterprise BalancePage.tsx
Layout (desktop 4:3):
- LEFT (70%): Balance card + KPI cards + Chart
- RIGHT (30%): Employee info + Ledger

Components:
1. **BalanceHeader** - Avatar, name, role badge, department, online status
2. **BalanceRingCard** - Main focus: ring progress SVG, balance hours, percentage, month selector
3. **KpiCards** - Accrued (with overtime multiplier) + Used (leave + deductions)
4. **BalanceChart** - Line chart (SVG-based), 7/30/90/365 day toggle
5. **BalanceLedger** - Immutable transaction log, paginated, banking style
6. **FAB** - Role-based actions (overtime request / leave request / admin adjustments)

### Phase 3: API Client Updates

Add to `apps/frontend/src/shared/api/client.ts`:
- `balanceHistory` → `GET /balance/history`
- `balanceLedger` → `GET /balance/ledger`
- `balanceSummary` → `GET /balance/summary`

### Phase 4: Router Update

No changes needed - already routes to `/balance` which renders `BalancePage`.

## Files to Create/Modify

### Backend (code mode):
1. `apps/backend/src/balance/balance.controller.ts` - Add 3 new endpoints
2. `apps/backend/src/balance/balance.service.ts` - Add history computation logic
3. `apps/backend/src/balance/dto/` - Add response DTOs if needed

### Frontend (code mode):
1. `apps/frontend/src/pages/BalancePage.tsx` - Complete rewrite
2. `apps/frontend/src/components/balance/BalanceSummary.tsx` - Update if used
3. `apps/frontend/src/shared/api/client.ts` - Add new API methods

## No New DB Tables Needed
The existing `BalanceOperation` table already stores all immutable transactions with timestamps. History can be computed by aggregating operations per day. This keeps the schema clean and avoids migration overhead.

## Design System
Uses the same enterprise compact style from the HomePage redesign:
- `enterprise-card` class
- `#111A2E` card backgrounds
- 12px border radius
- `#4C7DFF` primary accent
- Dark premium theme
