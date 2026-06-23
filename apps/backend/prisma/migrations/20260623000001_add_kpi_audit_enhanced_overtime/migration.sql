-- Add currency to User
ALTER TABLE "User" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';

-- Add status, multiplier, calculatedCost, cancelledById, cancelledAt to Overtime
CREATE TYPE "OvertimeStatus" AS ENUM ('APPROVED', 'CANCELLED');
ALTER TABLE "Overtime" ADD COLUMN "status" "OvertimeStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Overtime" ADD COLUMN "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "Overtime" ADD COLUMN "calculatedCost" DOUBLE PRECISION;
ALTER TABLE "Overtime" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Overtime" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Add foreign key for cancelledBy
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: KpiPeriod
CREATE TABLE "KpiPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "plannedHours" INTEGER NOT NULL DEFAULT 0,
    "actualWorkedHours" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" INTEGER NOT NULL DEFAULT 0,
    "approvedRequests" INTEGER NOT NULL DEFAULT 0,
    "rejectedRequests" INTEGER NOT NULL DEFAULT 0,
    "cancelledRequests" INTEGER NOT NULL DEFAULT 0,
    "responseTimeAvgHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workloadScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpiScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiPeriod_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for KpiPeriod
ALTER TABLE "KpiPeriod" ADD CONSTRAINT "KpiPeriod_userId_month_year_key" UNIQUE ("userId", "month", "year");

-- AddForeignKey for KpiPeriod
ALTER TABLE "KpiPeriod" ADD CONSTRAINT "KpiPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey for AuditLog
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex for AuditLog (for efficient querying)
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
