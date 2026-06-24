-- AlterTable: make telegramId optional, add passwordHash
ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
