-- AlterTable: add notification settings to User
ALTER TABLE "User" ADD COLUMN "notifyRequestUpdates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyTeamRequests" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyEmailDigest" BOOLEAN NOT NULL DEFAULT false;
