export function formatISODate(date: Date): string {
  // PocketBase date fields accept ISO strings.
  return date.toISOString();
}

export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start, end };
}

export function getDueDateForMonth(date: Date, dayOfMonth: number): Date {
  const clamped = Math.max(1, Math.min(28, dayOfMonth));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), clamped));
}

export function computePlatformFeeUsd(totalSalaryUsd: number): number {
  const percentRaw = process.env.SALARY_PLATFORM_FEE_PERCENT;
  const fixedRaw = process.env.SALARY_PLATFORM_FEE_FIXED_USD;
  const percent = percentRaw ? Number(percentRaw) : 0;
  const fixed = fixedRaw ? Number(fixedRaw) : 0;

  const feeFromPercent = Number.isFinite(percent) && percent > 0 ? (totalSalaryUsd * percent) / 100 : 0;
  const feeFromFixed = Number.isFinite(fixed) && fixed > 0 ? fixed : 0;
  const fee = feeFromPercent + feeFromFixed;

  // 2-decimal currency rounding
  return Math.max(0, Math.round(fee * 100) / 100);
}

