-- CreateEnum
CREATE TYPE "LeaveRequestType" AS ENUM ('TIME_OFF', 'VACATION');

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "type" "LeaveRequestType" NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3),
    "hours" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approverComment" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX "LeaveRequest_teamId_idx" ON "LeaveRequest"("teamId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_userId_createdAt_idx" ON "LeaveRequest"("userId", "createdAt");
CREATE INDEX "LeaveRequest_teamId_createdAt_idx" ON "LeaveRequest"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
