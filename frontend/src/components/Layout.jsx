import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  dashboard: 'M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z',
  products: 'M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4',
  sell: 'M3 3h2l2.4 12h10.2L20 7H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  sales: 'M4 4v16h16M8 16V10m4 6V6m4 10v-4',
  reports: 'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 3v4h4M14 3h7v7M21 3l-9 9',
  store: 'M4 9h16v11H4V9Zm0 0 2-5h12l2 5M9 20v-6h6v6',
  orders: 'M20 7h-3V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v3H4l1.5 13h13L20 7ZM9 7V5h6v2M9 11v5m6-5v5',
  staff: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
};

function Icon({ path }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/admin/products', label: 'Products', icon: 'products' },
    { to: '/admin/orders', label: 'Orders', icon: 'orders' },
    { to: '/admin/sales', label: 'Sales', icon: 'sales' },
    { to: '/admin/reports', label: 'Reports', icon: 'reports' },
    // Managing staff is desk work, so it stays out of the tablet bottom bar
    // where space is tight and every tap should be one you make at the till.
    { to: '/admin/staff', label: 'Staff', icon: 'staff', deskOnly: true },
  ],
  cashier: [
    { to: '/cashier', label: 'Sell', icon: 'sell', end: true },
    { to: '/cashier/sales', label: 'My sales', icon: 'sales' },
    { to: '/cashier/products', label: 'Products', icon: 'products' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV[user?.role] || [];
  const mobileLinks = links.filter((l) => !l.deskOnly);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white">
            <Icon path={ICONS.store} />
          </span>
          <span className="text-[15px] font-semibold leading-tight">Store POS</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              <Icon path={ICONS[l.icon]} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="text-xs capitalize text-slate-500">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
              <Icon path={ICONS.store} />
            </span>
            Store POS
          </span>
          <button onClick={handleLogout} className="text-sm font-medium text-slate-600">
            Sign out
          </button>
        </header>

        <main className="flex-1 pb-24 lg:pb-0">
          <Outlet />
        </main>

        {/* Bottom bar — mobile/tablet. Thumb-reachable, which matters when a
            cashier is holding a tablet in one hand. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white lg:hidden"
             style={{ gridTemplateColumns: `repeat(${mobileLinks.length || 1}, minmax(0, 1fr))` }}>
          {mobileLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-brand-600' : 'text-slate-500'
                }`
              }
            >
              <Icon path={ICONS[l.icon]} />
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
