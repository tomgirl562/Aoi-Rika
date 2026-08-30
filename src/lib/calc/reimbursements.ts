import type { Reimbursement } from '../types'

export function outstandingReimbursements(reimbursements: Reimbursement[]): Reimbursement[] {
  return reimbursements.filter((r) => !r.deleted_at && r.status === 'outstanding')
}

export interface OutstandingTotals {
  owedToMe: number // others owe you
  iOwe: number // you owe others
}

export function outstandingTotals(reimbursements: Reimbursement[]): OutstandingTotals {
  const outstanding = outstandingReimbursements(reimbursements)
  return {
    owedToMe: outstanding.filter((r) => r.direction === 'owed_to_me').reduce((s, r) => s + r.amount, 0),
    iOwe: outstanding.filter((r) => r.direction === 'i_owe').reduce((s, r) => s + r.amount, 0),
  }
}
