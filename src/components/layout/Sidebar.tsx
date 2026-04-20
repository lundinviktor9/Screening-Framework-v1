import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Rankings', icon: '🏆' },
  { to: '/data-entry', label: 'Data Entry', icon: '📝' },
  { to: '/sources', label: 'Data Sources', icon: '🔗' },
  { to: '/map', label: 'Map', icon: '🗺️' },
  { to: '/sensitivity', label: 'Sensitivity', icon: '🎚️' },
  { to: '/add', label: 'Add Market', icon: '➕' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen flex flex-col" style={{ background: '#3B1F6B' }}>
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-white font-bold text-base leading-tight">
          Brunswick<br />
          <span className="font-light text-purple-200">Screening Framework</span>
        </div>
        <div className="text-purple-300 text-xs mt-1">Industrial Real Estate</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-purple-200 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-purple-400 text-xs">v1.0 · 6 pillars · 60 metrics</div>
      </div>
    </aside>
  );
}
