export interface BarChartItem {
  label: string
  value: number
  color: string
}

export function BarChart({ items, formatValue }: { items: BarChartItem[]; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div>
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="bar-label" title={item.label}>
            {item.label}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${Math.max(0, Math.min(100, (item.value / max) * 100))}%`, background: item.color }}
            />
          </span>
          <span className="bar-value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  )
}
