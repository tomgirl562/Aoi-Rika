import type { Category, Transaction } from '../types'
import { currentWeekRange, daysElapsedInWeek, isWithin, trailingWeekRanges, type WeekRange } from '../dates'

/** Real personal spend/income only: excludes transfers between your own accounts and anything reimbursement-tagged. */
function isPersonal(tx: Transaction): boolean {
  return !tx.deleted_at && !tx.is_reimbursement && tx.type !== 'transfer'
}

function sumInRange(transactions: Transaction[], range: WeekRange, predicate: (tx: Transaction) => boolean): number {
  let total = 0
  for (const tx of transactions) {
    if (!predicate(tx)) continue
    if (!isWithin(new Date(tx.occurred_at), range)) continue
    total += tx.amount
  }
  return total
}

export interface WeeklyTotals {
  totalIn: number
  totalOut: number
  net: number
}

export function weeklyTotals(transactions: Transaction[], range: WeekRange): WeeklyTotals {
  const totalIn = sumInRange(transactions, range, (tx) => isPersonal(tx) && tx.type === 'income')
  const totalOut = sumInRange(transactions, range, (tx) => isPersonal(tx) && tx.type === 'expense')
  return { totalIn, totalOut, net: totalIn - totalOut }
}

export function categorySpendInRange(transactions: Transaction[], categoryId: string, range: WeekRange): number {
  return sumInRange(
    transactions,
    range,
    (tx) => isPersonal(tx) && tx.type === 'expense' && tx.category_id === categoryId,
  )
}

/** Average weekly spend for a category over the trailing N weeks (not including the current week). */
export function trailingAverageForCategory(
  transactions: Transaction[],
  categoryId: string,
  reference: Date,
  weekStartDay: number,
  weeks = 4,
): number {
  const ranges = trailingWeekRanges(reference, weekStartDay, weeks)
  const total = ranges.reduce((sum, range) => sum + categorySpendInRange(transactions, categoryId, range), 0)
  return ranges.length > 0 ? total / ranges.length : 0
}

/** Average total monthly expense over the trailing N weeks, annualized to a month - used as the safety-net basis. */
export function trailingAverageMonthlyExpense(transactions: Transaction[], reference: Date, weekStartDay: number, weeks = 4): number {
  const ranges = trailingWeekRanges(reference, weekStartDay, weeks)
  const total = ranges.reduce((sum, range) => {
    return sum + sumInRange(transactions, range, (tx) => isPersonal(tx) && tx.type === 'expense')
  }, 0)
  const avgWeekly = ranges.length > 0 ? total / ranges.length : 0
  return avgWeekly * (30 / 7)
}

export interface CategoryNudge {
  categoryId: string
  categoryName: string
  severity: 'ok' | 'watch' | 'over'
  thisWeekSpend: number
  proratedExpected: number
  trailingAverage: number
  message: string
}

/**
 * Plain-language pacing check per category: compares this week's spend-to-date against a
 * day-prorated share of the trailing 4-week average, plus a flat comparison against that average.
 */
export function buildCategoryNudges(
  transactions: Transaction[],
  categories: Category[],
  reference: Date,
  weekStartDay: number,
): CategoryNudge[] {
  const week = currentWeekRange(reference, weekStartDay)
  const daysElapsed = daysElapsedInWeek(reference, week)
  const daysLeft = 7 - daysElapsed

  const nudges: CategoryNudge[] = []
  for (const category of categories) {
    if (category.archived_at) continue
    const trailingAverage = trailingAverageForCategory(transactions, category.id, reference, weekStartDay)
    const thisWeekSpend = categorySpendInRange(transactions, category.id, week)
    if (trailingAverage === 0 && thisWeekSpend === 0) continue

    const proratedExpected = trailingAverage * (daysElapsed / 7)
    const pctOfProrated = proratedExpected > 0 ? thisWeekSpend / proratedExpected : thisWeekSpend > 0 ? Infinity : 0
    const overTrailingAverage = trailingAverage > 0 && thisWeekSpend > trailingAverage

    let severity: CategoryNudge['severity'] = 'ok'
    let message = `${category.name} is on track this week.`

    if (overTrailingAverage) {
      severity = 'over'
      message = `This week's ${category.name} (₱${(thisWeekSpend / 100).toFixed(0)}) is already higher than your 4-week average (₱${(trailingAverage / 100).toFixed(0)}).`
    } else if (pctOfProrated >= 0.8 && daysLeft > 0) {
      severity = 'watch'
      message = `You've spent ${Math.round(pctOfProrated * 100)}% of your usual ${category.name} budget with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`
    }

    nudges.push({
      categoryId: category.id,
      categoryName: category.name,
      severity,
      thisWeekSpend,
      proratedExpected,
      trailingAverage,
      message,
    })
  }

  return nudges.sort((a, b) => {
    const order = { over: 0, watch: 1, ok: 2 }
    return order[a.severity] - order[b.severity]
  })
}

export interface SafeToSpendResult {
  spendingAccountBalance: number
  safetyNet: number
  outstandingIOwe: number
  safeToSpend: number
}

export function computeSafeToSpend(
  spendingAccountBalance: number,
  safetyNet: number,
  outstandingIOwe: number,
): SafeToSpendResult {
  const safeToSpend = Math.max(0, spendingAccountBalance - safetyNet - outstandingIOwe)
  return { spendingAccountBalance, safetyNet, outstandingIOwe, safeToSpend }
}

export function resolveSafetyNet(overrideAmount: number | null, autoMonths: number, trailingMonthlyExpense: number): number {
  if (overrideAmount !== null) return overrideAmount
  return Math.round(autoMonths * trailingMonthlyExpense)
}
