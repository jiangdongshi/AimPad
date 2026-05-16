import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isInTraining = location.pathname === '/training' && (searchParams.has('task') || searchParams.has('custom'));

  return (
    <div className="min-h-screen bg-surface-900">
      {!isInTraining && <Header />}
      <main className={isInTraining ? '' : 'pt-16'}>
        <Outlet />
      </main>
    </div>
  );
}
