/** Amounts are stored as integer centavos everywhere. These are the only two places that convert to/from display pesos. */

export function centavosToPesos(centavos: number): number {
  return centavos / 100
}

export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100)
}

const formatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

export function formatMoney(centavos: number): string {
  return formatter.format(centavosToPesos(centavos))
}
