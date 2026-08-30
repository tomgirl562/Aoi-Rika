import { addWeeks, differenceInCalendarWeeks } from 'date-fns'
import type { GoalContribution, SavingsGoal } from '../types'
import { trailingWeekRanges } from '../dates'

export function goalProgress(goal: SavingsGoal, contributions: GoalContribution[]): number {
  return contributions
    .filter((c) => c.goal_id === goal.id && !c.deleted_at)
    .reduce((sum, c) => sum + c.amount, 0)
}

/**
 * Average weekly net contribution, used to project a completion date. Prefers the trailing N
 * *complete* weeks (not including the current one) so pace isn't skewed by a partial week. But a
 * goal created this week has no complete trailing weeks yet - falls back to its pace since the
 * first contribution so a brand-new goal still gets a projection instead of "not enough data".
 */
export function averageWeeklyContributionRate(
  goal: SavingsGoal,
  contributions: GoalContribution[],
  reference: Date,
  weekStartDay: number,
  weeks = 4,
): number {
  const relevant = contributions.filter((c) => c.goal_id === goal.id && !c.deleted_at)
  const ranges = trailingWeekRanges(reference, weekStartDay, weeks)
  const trailingTotal = ranges.reduce((sum, range) => {
    const inRange = relevant.filter((c) => {
      const d = new Date(c.created_at)
      return d >= range.start && d < range.end
    })
    return sum + inRange.reduce((s, c) => s + c.amount, 0)
  }, 0)
  if (trailingTotal > 0) return trailingTotal / ranges.length

  if (relevant.length === 0) return 0
  const earliest = relevant.reduce(
    (min, c) => (new Date(c.created_at) < min ? new Date(c.created_at) : min),
    new Date(relevant[0].created_at),
  )
  const weeksSinceFirstContribution = Math.max(1, differenceInCalendarWeeks(reference, earliest) + 1)
  const total = relevant.reduce((s, c) => s + c.amount, 0)
  return total / weeksSinceFirstContribution
}

export interface GoalProjection {
  progress: number
  remaining: number
  percentComplete: number
  weeklyRate: number
  projectedCompletionDate: Date | null
  /** null target_date means no deadline was set, so "on pace" is undefined. */
  onPaceForTargetDate: boolean | null
  requiredWeeklyContribution: number | null
}

export function projectGoal(
  goal: SavingsGoal,
  contributions: GoalContribution[],
  reference: Date,
  weekStartDay: number,
): GoalProjection {
  const progress = goalProgress(goal, contributions)
  const remaining = Math.max(0, goal.target_amount - progress)
  const percentComplete = goal.target_amount > 0 ? Math.min(1, progress / goal.target_amount) : 0
  const weeklyRate = averageWeeklyContributionRate(goal, contributions, reference, weekStartDay)

  const projectedCompletionDate =
    remaining <= 0 ? reference : weeklyRate > 0 ? addWeeks(reference, Math.ceil(remaining / weeklyRate)) : null

  let onPaceForTargetDate: boolean | null = null
  let requiredWeeklyContribution: number | null = null
  if (goal.target_date) {
    const weeksLeft = Math.max(1, differenceInCalendarWeeks(new Date(goal.target_date), reference))
    requiredWeeklyContribution = Math.ceil(remaining / weeksLeft)
    onPaceForTargetDate = remaining <= 0 || (projectedCompletionDate !== null && projectedCompletionDate <= new Date(goal.target_date))
  }

  return { progress, remaining, percentComplete, weeklyRate, projectedCompletionDate, onPaceForTargetDate, requiredWeeklyContribution }
}

/**
 * Flags goals whose required-this-week contribution (from a given funding account) would push
 * that account's safe-to-spend below zero once earlier goals in the list have already claimed their share.
 * Pass goals most-urgent-first (e.g. nearest target_date first) so scarce cushion goes to the goal that needs it most.
 */
export function flagGoalsAgainstSafetyNet(
  goalsWithProjections: Array<{ goal: SavingsGoal; projection: GoalProjection }>,
  fundingAccountSafeToSpend: number,
): Map<string, boolean> {
  const flags = new Map<string, boolean>()
  let remainingCushion = fundingAccountSafeToSpend
  for (const { goal, projection } of goalsWithProjections) {
    const need = projection.requiredWeeklyContribution ?? 0
    if (need <= 0) {
      flags.set(goal.id, false)
      continue
    }
    const wouldCompromise = remainingCushion - need < 0
    flags.set(goal.id, wouldCompromise)
    remainingCushion -= need
  }
  return flags
}
