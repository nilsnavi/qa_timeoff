-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "seatsLimit" INTEGER NOT NULL DEFAULT 10,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Create default organization
INSERT INTO "Organization" ("id", "name", "slug", "plan", "seatsLimit", "subscriptionStatus", "trialEndsAt", "createdAt", "updatedAt")
VALUES ('default-org', 'QA TimeOff', 'default', 'ENTERPRISE', 1000, 'ACTIVE', NULL, NOW(), NOW());

-- AlterTable User - add organizationId (nullable first, then set default, then make required)
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;

-- Set default org for all existing users
UPDATE "User" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;

-- Make organizationId required
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AlterTable Team - add organizationId
ALTER TABLE "Team" ADD COLUMN "organizationId" TEXT;

-- Set default org for all existing teams
UPDATE "Team" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;

-- Make organizationId required
ALTER TABLE "Team" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old unique constraint on Team.name, create new scoped one
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_name_key";
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");
