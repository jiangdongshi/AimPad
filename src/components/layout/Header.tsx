import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { UserMenu } from '@/components/ui/UserMenu';

export function Header() {
  const location = useLocation();
  const locale = useLocale();
  const { user, isAuthenticated, logout } = useAuthStore();

  const navItems = [
    { path: '/', label: locale['nav.home'] },
    { path: '/training', label: locale['nav.training'] },
    { path: '/statistics', label: locale['nav.statistics'] },
    { path: '/settings', label: locale['nav.settings'] },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-surface-900/80 backdrop-blur-md border-b border-surface-700">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="text-2xl font-gaming text-accent">AimPad</div>
          <div className="text-xs text-text-secondary hidden sm:block">{locale['header.subtitle']}</div>
        </Link>

        {/* 导航 + 语言/主题切换 */}
        <div className="flex items-center gap-3">
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

          {/* Auth section */}
          {isAuthenticated && user ? (
            <UserMenu user={user} onLogout={logout} />
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-md text-sm font-display bg-accent hover:bg-accent-dark text-surface-900 font-semibold transition-colors"
            >
              {locale['auth.login']}
            </Link>
          )}

          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
