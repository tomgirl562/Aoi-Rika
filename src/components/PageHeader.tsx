import { Link } from 'react-router-dom'

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.15rem 0 0' }}>{subtitle}</p>
        )}
      </div>
      <Link to="/settings" aria-label="Settings" style={{ fontSize: '1.3rem', textDecoration: 'none' }}>
        ⚙️
      </Link>
    </header>
  )
}
