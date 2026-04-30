import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/training', label: 'Training' },
  { path: '/statistics', label: 'Statistics' },
  { path: '/settings', label: 'Settings' },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-surface-900/80 backdrop-blur-md border-b border-surface-700">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="text-2xl font-gaming text-accent">AimPad</div>
          <div className="text-xs text-text-secondary hidden sm:block">Web 端专业瞄准训练平台</div>
        </Link>

        {/* 导航 */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  px-4 py-2 rounded-md text-sm font-display transition-all duration-200
                  ${isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-700'
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
