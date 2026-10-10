import i18n from '@/i18n/config';

export function requestError(error: unknown): string {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : '';
  const known: Record<string, string> = {
    'Invalid email or password': 'feedback.invalidCredentials',
    'Account is suspended or banned': 'feedback.accountBlocked',
  };
  return message ? known[message] ? i18n.t(known[message]) : message : i18n.t('feedback.requestFailed');
}
