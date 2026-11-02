import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class WellnessAudienceQueryDto {
  audience?: 'patient' | 'company';
}

export class StartSessionDto {
  @IsOptional()
  audience?: 'patient' | 'company';
}

export class CompleteSessionDto {
  @IsInt()
  @Min(0)
  @Max(100)
  compliancePct!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  motionLevelAvg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}

export class AbandonSessionDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progressPct!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  compliancePct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  motionLevelAvg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}

export class UpdateSessionProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progressPct!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  motionLevelAvg?: number;
}
