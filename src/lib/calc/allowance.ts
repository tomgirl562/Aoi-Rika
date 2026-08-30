import { currentWeekRange, daysElapsedInWeek, dayOfMonth, daysInMonth } from '../dates'

export type AllowancePeriod = 'weekly' | 'monthly'

export interface AllowancePacing {
  dailyBudget: number // centavos, the even-split target for one day
  daysLeftInPeriod: number // including today
  neededForRestOfPeriod: number // centavos, dailyBudget * daysLeftInPeriod
  safeToSpend: number // centavos, the account's actual safe-to-spend figure
  sustainable: boolean // whether safeToSpend covers neededForRestOfPeriod
}

/**
 * Splits a declared allowance evenly across its period (weekly or monthly) into a simple daily
 * target, then checks that plan against the account's actual safe-to-spend so an unsustainable
 * plan surfaces as a gentle warning instead of silently suggesting more than is really there.
 */
export function computeAllowancePacing(
  allowanceAmount: number | null,
  period: AllowancePeriod,
  reference: Date,
  weekStartDay: number,
  safeToSpend: number,
): AllowancePacing | null {
  if (allowanceAmount === null || allowanceAmount <= 0) return null

  let periodDays: number
  let daysLeftInPeriod: number
  if (period === 'weekly') {
    periodDays = 7
    const week = currentWeekRange(reference, weekStartDay)
    daysLeftInPeriod = 7 - daysElapsedInWeek(reference, week) + 1
  } else {
    periodDays = daysInMonth(reference)
    daysLeftInPeriod = periodDays - dayOfMonth(reference) + 1
  }

  const dailyBudget = allowanceAmount / periodDays
  const neededForRestOfPeriod = dailyBudget * daysLeftInPeriod

  return {
    dailyBudget,
    daysLeftInPeriod,
    neededForRestOfPeriod,
    safeToSpend,
    sustainable: neededForRestOfPeriod <= safeToSpend,
  }
}
