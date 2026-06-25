-- Migration: перенос данных из устаревшей модели LeaveRequest в канонические
-- TimeOffRequest (TIME_OFF) и VacationRequest (VACATION).
-- LeaveRequest пока не удаляется — требуется только перенос данных.

-- 1. Перенос отгулов (LeaveRequest.type = 'TIME_OFF' → TimeOffRequest)
INSERT INTO "TimeOffRequest" ("id", "userId", "date", "hours", "reason", "comment", "status", "approverId", "approverComment", "approvedAt", "createdAt", "updatedAt")
SELECT
  lr."id",
  lr."userId",
  lr."dateFrom",
  lr."hours",
  lr."reason",
  lr."comment",
  lr."status",
  lr."approverId",
  lr."approverComment",
  lr."approvedAt",
  lr."createdAt",
  lr."updatedAt"
FROM "LeaveRequest" lr
WHERE lr."type" = 'TIME_OFF'
  AND NOT EXISTS (SELECT 1 FROM "TimeOffRequest" tor WHERE tor."id" = lr."id");

-- 2. Перенос отпусков (LeaveRequest.type = 'VACATION' → VacationRequest)
INSERT INTO "VacationRequest" ("id", "userId", "startDate", "endDate", "daysCount", "vacationType", "status", "comment", "approverId", "approverComment", "approvedAt", "createdAt", "updatedAt")
SELECT
  lr."id",
  lr."userId",
  lr."dateFrom",
  COALESCE(lr."dateTo", lr."dateFrom"),
  GREATEST(1, (COALESCE(lr."dateTo", lr."dateFrom")::date - lr."dateFrom"::date) + 1),
  'OTHER'::"VacationType",
  lr."status",
  lr."comment",
  lr."approverId",
  lr."approverComment",
  lr."approvedAt",
  lr."createdAt",
  lr."updatedAt"
FROM "LeaveRequest" lr
WHERE lr."type" = 'VACATION'
  AND NOT EXISTS (SELECT 1 FROM "VacationRequest" vr WHERE vr."id" = lr."id");
