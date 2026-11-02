import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { AbandonSessionDto, CompleteSessionDto, StartSessionDto, UpdateSessionProgressDto } from './dto/wellness.dto';
import { WellnessService } from './wellness.service';

@Controller()
export class WellnessController {
  constructor(private readonly wellnessService: WellnessService) {}

  @Get('wellness/me')
  getDashboard(
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
    @Query('audience') audience?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.getDashboard(subject, audience);
  }

  @Post('wellness/me/sessions/start')
  startSession(
    @Body() dto: StartSessionDto,
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.startSession(subject, dto.audience);
  }

  @Post('wellness/me/sessions/:sessionId/progress')
  updateProgress(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionProgressDto,
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
    @Query('audience') audience?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.updateSessionProgress(
      subject,
      sessionId,
      audience,
      dto.progressPct,
      dto.motionLevelAvg,
    );
  }

  @Post('wellness/me/sessions/:sessionId/complete')
  completeSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: CompleteSessionDto,
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
    @Query('audience') audience?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.completeSession(
      subject,
      sessionId,
      audience,
      dto.compliancePct,
      dto.motionLevelAvg,
      dto.durationSec,
    );
  }

  @Post('wellness/me/sessions/:sessionId/abandon')
  abandonSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: AbandonSessionDto,
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
    @Query('audience') audience?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.abandonSession(
      subject,
      sessionId,
      audience,
      dto.progressPct,
      dto.compliancePct,
      dto.motionLevelAvg,
      dto.durationSec,
    );
  }

  @Post('wellness/me/incomplete/dismiss')
  dismissIncomplete(
    @Headers('x-auth-user-id') authUserId?: string,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-role') role?: string,
    @Query('audience') audience?: string,
  ) {
    const subject = this.ensureSubject(authUserId, subjectId, role);
    return this.wellnessService.dismissIncomplete(subject, audience);
  }

  private ensureSubject(authUserId?: string, subjectId?: string, role?: string) {
    const normalizedRole = role?.toUpperCase();
    if (!authUserId || !subjectId || !normalizedRole) {
      throw new ForbiddenException('No autorizado');
    }
    const allowed = ['PATIENT', 'DOCTOR', 'EMPLOYER', 'COLLABORATOR'];
    if (!allowed.includes(normalizedRole)) {
      throw new ForbiddenException('No autorizado');
    }
    return { authUserId, subjectId, subjectRole: normalizedRole };
  }
}
