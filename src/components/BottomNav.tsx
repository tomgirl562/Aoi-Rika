import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/weekly', label: 'Weekly', icon: '📅' },
  { to: '/transactions', label: 'Add', icon: '➕' },
  { to: '/reimbursements', label: 'Owed', icon: '🔁' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span aria-hidden style={{ fontSize: '1.15rem' }}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
