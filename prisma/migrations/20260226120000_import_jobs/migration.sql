-- Import jobs audit: who imported, what, when, totals, error file
CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "lang" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "originalFilename" TEXT,
  "errorFilePath" TEXT
);

CREATE INDEX IF NOT EXISTS "ImportJob_userId_idx" ON "ImportJob"("userId");
CREATE INDEX IF NOT EXISTS "ImportJob_entityType_idx" ON "ImportJob"("entityType");
CREATE INDEX IF NOT EXISTS "ImportJob_startedAt_idx" ON "ImportJob"("startedAt");
