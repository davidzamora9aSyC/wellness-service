import { Injectable, NotFoundException } from '@nestjs/common';
import { WellnessAudience, WellnessSessionStatus, type WellnessProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  calculateSessionGain,
  getNextTierInfo,
  getWeeklyGoal,
  getWellScoreMotivation,
  getWellScoreTier,
  getWeekStartKey,
  toDateKey,
} from './wellness-score.util';
import { WellnessEventsPublisher } from './wellness-events.publisher';

type SubjectContext = {
  authUserId: string;
  subjectId: string;
  subjectRole: string;
};

@Injectable()
export class WellnessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: WellnessEventsPublisher,
  ) {}

  parseAudience(value?: string): WellnessAudience {
    return value?.toLowerCase() === 'company' ? WellnessAudience.COMPANY : WellnessAudience.PATIENT;
  }

  private normalizeProfileWeek(profile: WellnessProfile, today = new Date()) {
    const weekStart = getWeekStartKey(today);
    if (profile.weekStartDate === weekStart) return profile;
    return this.prisma.wellnessProfile.update({
      where: { id: profile.id },
      data: { weeklySessions: 0, weekStartDate: weekStart },
    });
  }

  private async getOrCreateProfile(subject: SubjectContext, audience: WellnessAudience) {
    const existing = await this.prisma.wellnessProfile.findUnique({
      where: { authUserId_audience: { authUserId: subject.authUserId, audience } },
    });
    if (existing) return this.normalizeProfileWeek(existing);

    const weekStart = getWeekStartKey(new Date());
    return this.prisma.wellnessProfile.create({
      data: {
        authUserId: subject.authUserId,
        subjectId: subject.subjectId,
        subjectRole: subject.subjectRole,
        audience,
        weekStartDate: weekStart,
      },
    });
  }

  private async findIncompleteSession(profileId: string, dismissedAt: Date | null) {
    const session = await this.prisma.wellnessSession.findFirst({
      where: {
        profileId,
        status: { in: [WellnessSessionStatus.IN_PROGRESS, WellnessSessionStatus.ABANDONED] },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return null;
    if (session.status === WellnessSessionStatus.ABANDONED && dismissedAt && session.abandonedAt && session.abandonedAt <= dismissedAt) {
      return null;
    }
    if (session.status === WellnessSessionStatus.IN_PROGRESS && session.progressPct >= 95) {
      return null;
    }
    return session;
  }

  private mapProfileResponse(profile: WellnessProfile, incompleteSession: Awaited<ReturnType<typeof this.findIncompleteSession>>) {
    const weeklyGoal = getWeeklyGoal(profile.audience);
    const tier = getWellScoreTier(profile.score);
    const nextTier = getNextTierInfo(profile.score);
    const motivation = getWellScoreMotivation(profile, weeklyGoal);
    const weeklyPct = Math.min(100, Math.round((profile.weeklySessions / weeklyGoal) * 100));

    return {
      profile: {
        score: profile.score,
        sessionsCompleted: profile.sessionsCompleted,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        lastSessionDate: profile.lastSessionDate,
        weeklySessions: profile.weeklySessions,
        weekStartDate: profile.weekStartDate,
        tier: tier.tier,
        tierLabel: tier.label,
      },
      weeklyGoal,
      weeklyPct,
      nextTier,
      motivation,
      incompleteSession: incompleteSession
        ? {
            id: incompleteSession.id,
            status: incompleteSession.status,
            progressPct: incompleteSession.progressPct,
            compliancePct: incompleteSession.compliancePct,
            motionLevelAvg: incompleteSession.motionLevelAvg,
            durationSec: incompleteSession.durationSec,
            startedAt: incompleteSession.startedAt.toISOString(),
            abandonedAt: incompleteSession.abandonedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async getDashboard(subject: SubjectContext, audienceRaw?: string) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);
    const incompleteSession = await this.findIncompleteSession(profile.id, profile.incompleteDismissedAt);
    return this.mapProfileResponse(profile, incompleteSession);
  }

  async startSession(subject: SubjectContext, audienceRaw?: string) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);

    await this.prisma.wellnessSession.updateMany({
      where: {
        profileId: profile.id,
        status: WellnessSessionStatus.IN_PROGRESS,
      },
      data: {
        status: WellnessSessionStatus.ABANDONED,
        abandonedAt: new Date(),
      },
    });

    const session = await this.prisma.wellnessSession.create({
      data: { profileId: profile.id },
    });

    return { sessionId: session.id, startedAt: session.startedAt.toISOString() };
  }

  async updateSessionProgress(
    subject: SubjectContext,
    sessionId: string,
    audienceRaw: string | undefined,
    progressPct: number,
    motionLevelAvg?: number,
  ) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);
    const session = await this.prisma.wellnessSession.findFirst({
      where: { id: sessionId, profileId: profile.id, status: WellnessSessionStatus.IN_PROGRESS },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    return this.prisma.wellnessSession.update({
      where: { id: session.id },
      data: {
        progressPct,
        motionLevelAvg: motionLevelAvg ?? session.motionLevelAvg,
      },
    });
  }

  async completeSession(
    subject: SubjectContext,
    sessionId: string,
    audienceRaw: string | undefined,
    compliancePct: number,
    motionLevelAvg?: number,
    durationSec?: number,
  ) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);
    const session = await this.prisma.wellnessSession.findFirst({
      where: { id: sessionId, profileId: profile.id, status: WellnessSessionStatus.IN_PROGRESS },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const gain = calculateSessionGain(compliancePct);
    const newScore = Math.min(100, profile.score + gain);
    const today = new Date();
    const todayKey = toDateKey(today);
    const weekStart = getWeekStartKey(today);

    let weeklySessions = profile.weekStartDate === weekStart ? profile.weeklySessions : 0;
    weeklySessions += 1;

    let currentStreak = profile.currentStreak;
    if (profile.lastSessionDate !== todayKey) {
      const yesterdayKey = toDateKey(addDays(today, -1));
      currentStreak = profile.lastSessionDate === yesterdayKey ? profile.currentStreak + 1 : 1;
    }

    const longestStreak = Math.max(profile.longestStreak, currentStreak);
    const tier = getWellScoreTier(newScore);

    const [updatedProfile] = await this.prisma.$transaction([
      this.prisma.wellnessProfile.update({
        where: { id: profile.id },
        data: {
          score: newScore,
          sessionsCompleted: profile.sessionsCompleted + 1,
          currentStreak,
          longestStreak,
          lastSessionDate: todayKey,
          weeklySessions,
          weekStartDate: weekStart,
          incompleteDismissedAt: null,
        },
      }),
      this.prisma.wellnessSession.update({
        where: { id: session.id },
        data: {
          status: WellnessSessionStatus.COMPLETED,
          compliancePct,
          motionLevelAvg: motionLevelAvg ?? null,
          durationSec: durationSec ?? session.durationSec,
          progressPct: 100,
          scoreGain: gain,
          completedAt: new Date(),
        },
      }),
    ]);

    this.events.publishSessionCompleted({
      sessionId: session.id,
      authUserId: subject.authUserId,
      audience: profile.audience,
      compliancePct,
      motionLevelAvg: motionLevelAvg ?? null,
      scoreGain: gain,
      score: updatedProfile.score,
    });

    return {
      previousScore: profile.score,
      newScore,
      gain,
      tier: tier.tier,
      tierLabel: tier.label,
      sessionsCompleted: updatedProfile.sessionsCompleted,
      currentStreak,
      weeklySessions,
      weeklyGoal: getWeeklyGoal(profile.audience),
      compliancePct,
      motionLevelAvg: motionLevelAvg ?? null,
    };
  }

  async abandonSession(
    subject: SubjectContext,
    sessionId: string,
    audienceRaw: string | undefined,
    progressPct: number,
    compliancePct?: number,
    motionLevelAvg?: number,
    durationSec?: number,
  ) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);
    const session = await this.prisma.wellnessSession.findFirst({
      where: {
        id: sessionId,
        profileId: profile.id,
        status: WellnessSessionStatus.IN_PROGRESS,
      },
    });
    if (!session) return { ok: true, skipped: true };

    if (progressPct < 5) {
      await this.prisma.wellnessSession.delete({ where: { id: session.id } });
      return { ok: true, deleted: true };
    }

    await this.prisma.wellnessSession.update({
      where: { id: session.id },
      data: {
        status: WellnessSessionStatus.ABANDONED,
        progressPct,
        compliancePct: compliancePct ?? null,
        motionLevelAvg: motionLevelAvg ?? null,
        durationSec: durationSec ?? session.durationSec,
        abandonedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async dismissIncomplete(subject: SubjectContext, audienceRaw?: string) {
    const audience = this.parseAudience(audienceRaw);
    const profile = await this.getOrCreateProfile(subject, audience);
    await this.prisma.wellnessProfile.update({
      where: { id: profile.id },
      data: { incompleteDismissedAt: new Date() },
    });
    return { ok: true };
  }
}
