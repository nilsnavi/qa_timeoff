CREATE TYPE "ImportType" AS ENUM ('USERS', 'TEAMS', 'BALANCES');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'PROCESSING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED');

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "originalFilePath" TEXT,
    "errorFilePath" TEXT,
    "createdById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,
    "rawValue" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
