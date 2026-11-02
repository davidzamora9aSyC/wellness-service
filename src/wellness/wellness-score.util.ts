export type WellScoreTier = 'inicio' | 'constante' | 'pro' | 'elite';

const TIER_THRESHOLDS: { min: number; tier: WellScoreTier; label: string }[] = [
  { min: 85, tier: 'elite', label: 'Bienestar elite' },
  { min: 72, tier: 'pro', label: 'Ritmo saludable' },
  { min: 60, tier: 'constante', label: 'Hábito en formación' },
  { min: 0, tier: 'inicio', label: 'Primeros pasos' },
];

export const PATIENT_WEEKLY_PAUSA_GOAL = 5;
export const COMPANY_WEEKLY_PAUSA_GOAL = 3;
export const DEFAULT_SCORE = 58;

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getWeekStartKey = (date: Date) => {
  const start = new Date(date);
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diff);
  return toDateKey(start);
};

export const getWeeklyGoal = (audience: 'PATIENT' | 'COMPANY') =>
  audience === 'PATIENT' ? PATIENT_WEEKLY_PAUSA_GOAL : COMPANY_WEEKLY_PAUSA_GOAL;

export const getWellScoreTier = (score: number) => {
  const match = TIER_THRESHOLDS.find((entry) => score >= entry.min) ?? TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
  return { tier: match.tier, label: match.label };
};

export const getNextTierInfo = (score: number) => {
  if (score >= 85) {
    return { nextLabel: 'Bienestar elite', pointsToNext: 0, progressPct: 100, atMaxTier: true };
  }
  const milestones = [60, 72, 85];
  const next = milestones.find((value) => value > score) ?? 85;
  const previous = milestones.filter((value) => value <= score).pop() ?? 0;
  const progressPct = Math.round(((score - previous) / (next - previous)) * 100);
  return {
    nextLabel: getWellScoreTier(next).label,
    pointsToNext: next - score,
    progressPct: Math.max(0, Math.min(100, progressPct)),
    atMaxTier: false,
  };
};

export const calculateSessionGain = (overallProgress: number) => {
  const completionRatio = overallProgress / 100;
  const base = 4;
  const performanceBonus = Math.round(completionRatio * 7);
  const fullRoutineBonus = overallProgress >= 95 ? 2 : 0;
  return Math.max(2, Math.min(13, base + performanceBonus + fullRoutineBonus));
};

export const getWellScoreMotivation = (
  profile: {
    score: number;
    sessionsCompleted: number;
    currentStreak: number;
    lastSessionDate: string | null;
    weeklySessions: number;
  },
  weeklyGoal: number,
  today = new Date(),
) => {
  const todayKey = toDateKey(today);
  const practicedToday = profile.lastSessionDate === todayKey;

  if (profile.weeklySessions >= weeklyGoal) {
    return {
      title: 'Meta semanal cumplida',
      subtitle: 'Mantén la constancia: cada pausa suma a tu prevención y a tu WellScore.',
    };
  }
  if (profile.currentStreak >= 7) {
    return {
      title: 'Racha de bienestar imparable',
      subtitle: `${profile.currentStreak} días seguidos cuidando tu cuerpo. Sigue así para consolidar el hábito.`,
    };
  }
  if (practicedToday) {
    return {
      title: 'Ya moviste el cuerpo hoy',
      subtitle: `Te faltan ${Math.max(0, weeklyGoal - profile.weeklySessions)} pausas para cerrar tu meta semanal.`,
    };
  }
  if (profile.currentStreak >= 3) {
    return {
      title: 'Tu racha está en marcha',
      subtitle: `Llevas ${profile.currentStreak} días consecutivos. Una pausa hoy protege tu progreso.`,
    };
  }
  if (profile.sessionsCompleted === 0) {
    return {
      title: 'Empieza tu perfil de bienestar',
      subtitle: 'Completa tu primera pausa activa y desbloquea puntos, racha y nivel WellScore.',
    };
  }
  return {
    title: 'Tu cuerpo te lo agradecerá',
    subtitle: 'Una pausa guiada puede sumar hasta +13 puntos a tu WellScore.',
  };
};
