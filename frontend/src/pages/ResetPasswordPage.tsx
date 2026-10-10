import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/services/auth';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D1A] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-gold tracking-wider mb-2">
            CASINO<span className="text-white">X</span>
          </h1>
          <p className="text-gray-400">{t('auth.reset.title')}</p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-300">{t('auth.reset.sent')}</p>
              <Link to="/login">
                <Button variant="outline">{t('auth.reset.back')}</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label={t('auth.reset.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@email.com"
                required
              />

              {error && (
                <div className="bg-error/10 border border-error text-error text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? t('common.loading') : t('auth.reset.submit')}
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  {t('auth.reset.back')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
