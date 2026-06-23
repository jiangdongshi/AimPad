import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '@/hooks/useTheme';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
import { useAdminConfigStore } from '@/stores/adminConfigStore';

export function Header() {
  const location = useLocation();
  const locale = useLocale();
  const isAdmin = useAdminConfigStore((s) => s.isAuthenticated);

  const navItems = [
    { path: '/', label: locale['nav.home'] },
    { path: '/gamepad', label: locale['nav.gamepad'] },
    { path: '/training', label: locale['nav.training'] },
    { path: '/custom-task', label: locale['nav.customTask'] || 'Custom' },
    { path: '/statistics', label: locale['nav.statistics'] },
    { path: '/settings', label: locale['nav.settings'] },
    ...(isAdmin ? [{ path: '/admin' as const, label: locale['nav.admin'] || 'Admin' }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-surface-900/80 backdrop-blur-md border-b border-surface-700">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="text-2xl font-gaming text-accent">AimPad</div>
          <div className="text-xs text-text-secondary hidden sm:block">{locale['header.subtitle']}</div>
        </Link>

        {/* Navigation + Profile + Switchers */}
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

          {/* Profile */}
          <ProfileMenu />

          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
