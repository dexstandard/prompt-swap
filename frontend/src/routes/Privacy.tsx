import { useTranslation } from '../lib/i18n';

export default function Privacy() {
  const t = useTranslation();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">{t('privacy_title')}</h2>
      <p>{t('privacy_p1')}</p>
      <p>{t('privacy_p2')}</p>
      <p>{t('privacy_p3')}</p>
    </div>
  );
}
