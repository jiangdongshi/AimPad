import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLocale } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Register() {
  const locale = useLocale();
  const navigate = useNavigate();
  const { register, sendCode, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) return;
    clearError();
    try {
      await sendCode(email, 'register');
      setCodeSent(true);
      startCooldown();
    } catch {
      // error is set in store
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code || !username) return;
    clearError();
    try {
      await register(email, code, username);
      navigate('/');
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <Card variant="elevated" className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-gaming text-accent mb-2">{locale['auth.registerTitle']}</h1>
          <p className="text-text-muted text-sm">{locale['auth.registerSubtitle']}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">{locale['auth.email']}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={locale['auth.emailPlaceholder']}
              className="w-full px-4 py-2.5 rounded-md bg-surface-700 border border-surface-600 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">{locale['auth.username']}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={locale['auth.usernamePlaceholder']}
              pattern="[a-zA-Z0-9_]{3,32}"
              className="w-full px-4 py-2.5 rounded-md bg-surface-700 border border-surface-600 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              required
            />
          </div>

          {/* Verification Code */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">{locale['auth.verificationCode']}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={locale['auth.codePlaceholder']}
                maxLength={6}
                className="flex-1 px-4 py-2.5 rounded-md bg-surface-700 border border-surface-600 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                required
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSendCode}
                disabled={!email || cooldown > 0 || isLoading}
                className="shrink-0 whitespace-nowrap"
              >
                {cooldown > 0
                  ? `${cooldown}s`
                  : codeSent
                    ? locale['auth.resendCode']
                    : locale['auth.sendCode']}
              </Button>
            </div>
          </div>

          {/* Demo hint */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/20">
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-accent">{locale['auth.codeHint']}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-md bg-danger/10 border border-danger/30">
              <span className="text-sm text-danger">{error}</span>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isLoading}
            disabled={!email || !code || !username}
          >
            {isLoading ? locale['auth.registering'] : locale['auth.register']}
          </Button>
        </form>

        {/* Link to login */}
        <p className="mt-6 text-center text-sm text-text-muted">
          {locale['auth.hasAccount']}{' '}
          <Link to="/login" className="text-accent hover:text-accent-dark font-medium">
            {locale['auth.login']}
          </Link>
        </p>
      </Card>
    </div>
  );
}
