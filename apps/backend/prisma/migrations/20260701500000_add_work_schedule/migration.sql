CREATE TYPE "ScheduleType" AS ENUM ('STANDARD_5_2', 'SHIFT_2_2', 'SHIFT_3_3', 'SHIFT_4_4', 'NIGHT_SHIFT', 'FLEXIBLE', 'CUSTOM');

ALTER TYPE "ImportType" ADD VALUE 'SCHEDULES';

CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'STANDARD_5_2',
    "workingDays" INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    "hoursPerDay" INTEGER NOT NULL DEFAULT 8,
    "shiftStartTime" TEXT,
    "shiftEndTime" TEXT,
    "cycleStartDate" TIMESTAMP(3),
    "cycleWorkDays" INTEGER,
    "cycleRestDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkSchedule_userId_key" ON "WorkSchedule"("userId");
CREATE INDEX "WorkSchedule_organizationId_idx" ON "WorkSchedule"("organizationId");
CREATE INDEX "WorkSchedule_userId_idx" ON "WorkSchedule"("userId");

ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
