-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'QA TimeOff',
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "workWeekDays" INTEGER NOT NULL DEFAULT 5,
    "workingHoursPerDay" INTEGER NOT NULL DEFAULT 8,
    "defaultAnnualHours" INTEGER NOT NULL DEFAULT 1760,
    "minimumTeamCoveragePercent" INTEGER NOT NULL DEFAULT 70,
    "approvalPolicy" TEXT NOT NULL DEFAULT 'MANAGER_OR_ADMIN',
    "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "telegramNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- Seed default settings
INSERT INTO "CompanySettings" ("id", "companyName", "timezone", "locale", "workWeekDays", "workingHoursPerDay", "defaultAnnualHours", "minimumTeamCoveragePercent", "approvalPolicy", "allowNegativeBalance", "emailNotificationsEnabled", "telegramNotificationsEnabled", "createdAt", "updatedAt")
VALUES ('default-company', 'QA TimeOff', 'Europe/Moscow', 'ru', 5, 8, 1760, 70, 'MANAGER_OR_ADMIN', false, true, false, NOW(), NOW());
