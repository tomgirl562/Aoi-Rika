import { addWeeks, differenceInCalendarDays, endOfWeek, startOfWeek, subWeeks } from 'date-fns'

export interface WeekRange {
  start: Date
  end: Date // exclusive
}

/** The week containing `reference`, per the user's configured week_start_day (0=Sun..6=Sat). */
export function currentWeekRange(reference: Date, weekStartDay: number): WeekRange {
  const start = startOfWeek(reference, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
  const end = addWeeks(start, 1)
  return { start, end }
}

/** The N weeks immediately before the current week (does not include the current week). */
export function trailingWeekRanges(reference: Date, weekStartDay: number, count: number): WeekRange[] {
  const { start: currentStart } = currentWeekRange(reference, weekStartDay)
  const ranges: WeekRange[] = []
  for (let i = count; i >= 1; i--) {
    const start = subWeeks(currentStart, i)
    ranges.push({ start, end: addWeeks(start, 1) })
  }
  return ranges
}

export function daysElapsedInWeek(reference: Date, week: WeekRange): number {
  // Day 1 = the first day of the week has "elapsed" once it's underway.
  return Math.min(7, Math.max(1, differenceInCalendarDays(reference, week.start) + 1))
}

export function isWithin(date: Date, range: WeekRange): boolean {
  return date >= range.start && date < range.end
}

export function currentMonthRange(reference: Date): WeekRange {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return { start, end }
}

export { endOfWeek }
