'use client';

import { useLanguage } from './LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === 'ru' ? 'en' : 'ru';

  return (
    <button
      type="button"
      className="header-action language-toggle"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={nextLanguage === 'en' ? t('switchToEnglish') : t('switchToRussian')}
      title={nextLanguage === 'en' ? t('switchToEnglish') : t('switchToRussian')}
    >
      <span aria-hidden="true">{nextLanguage.toUpperCase()}</span>
    </button>
  );
}
