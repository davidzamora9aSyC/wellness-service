CREATE SCHEMA IF NOT EXISTS "wellness";

CREATE TYPE "wellness"."WellnessAudience" AS ENUM ('PATIENT', 'COMPANY');
CREATE TYPE "wellness"."WellnessSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TABLE "wellness"."WellnessProfile" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectRole" TEXT NOT NULL,
    "audience" "wellness"."WellnessAudience" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 58,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSessionDate" TEXT,
    "weeklySessions" INTEGER NOT NULL DEFAULT 0,
    "weekStartDate" TEXT,
    "incompleteDismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wellness"."WellnessSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "wellness"."WellnessSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "compliancePct" INTEGER,
    "motionLevelAvg" INTEGER,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "scoreGain" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),

    CONSTRAINT "WellnessSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WellnessProfile_authUserId_audience_key" ON "wellness"."WellnessProfile"("authUserId", "audience");
CREATE INDEX "WellnessProfile_subjectId_audience_idx" ON "wellness"."WellnessProfile"("subjectId", "audience");
CREATE INDEX "WellnessSession_profileId_status_idx" ON "wellness"."WellnessSession"("profileId", "status");
CREATE INDEX "WellnessSession_startedAt_idx" ON "wellness"."WellnessSession"("startedAt");

ALTER TABLE "wellness"."WellnessSession" ADD CONSTRAINT "WellnessSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "wellness"."WellnessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
