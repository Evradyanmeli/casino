import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/services/auth';
import { requestError } from '@/services/feedback';
import { PlayingCard, CasinoChip } from '@/components/games/GameVisuals';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await authApi.resetPassword(email);
      setMessage(result.message);
    } catch (err) {
      setError(requestError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="player-shell min-h-screen flex items-center justify-center px-3 py-6 sm:px-6 sm:py-12">
      <div className="grid w-full max-w-5xl min-w-0 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="casino-stage flex min-w-0 items-center justify-between gap-4 p-5 sm:p-8 lg:flex-col lg:items-start lg:justify-center lg:p-10">
          <div className="min-w-0">
            <p className="casino-eyebrow">CASINO X</p>
            <h2 className="text-xl text-[#f1e7d1] sm:text-3xl lg:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>Votre espace personnel.</h2>
            <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-[#b8c5be] lg:block">{t('casino.disclaimer')}</p>
          </div>
          <div className="flex shrink-0 items-end gap-2 lg:mt-10 lg:gap-5" aria-hidden="true">
            <PlayingCard small hidden className="-rotate-12 lg:!w-[72px]" />
            <CasinoChip value="GC" className="lg:!h-16 lg:!w-16" />
          </div>
        </section>

        <section className="casino-panel min-w-0 p-5 sm:p-8 lg:p-10" aria-labelledby="reset-title">
          <p className="casino-eyebrow">Votre compte</p>
          <h1 id="reset-title" className="casino-title mb-6">{t('auth.reset.title')}</h1>
          <p className="mb-6 rounded-xl border border-[#c5a05a]/25 bg-[#c5a05a]/5 p-4 text-sm leading-relaxed text-[#d4c6a6]">La reinitialisation par email est actuellement indisponible. Aucun email ne peut etre envoye pour le moment.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label={t('auth.reset.email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              required
            />

            {error && (
              <div role="alert" className="bg-error/10 border border-error text-error text-sm rounded-lg p-3">
                {error}
              </div>
            )}
            {message && <p role="status" className="rounded-lg border border-white/10 p-3 text-sm text-gray-300">{message}</p>}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? t('common.loading') : t('auth.reset.submit')}
            </Button>

            <div className="text-center">
              <Link to="/login" className="inline-flex min-h-11 items-center text-sm text-[#d9bf83] hover:underline">
                {t('auth.reset.back')}
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
