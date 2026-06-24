-- AlterTable: add lastLoginAt to User
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
