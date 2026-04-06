'use client';

import React, { ReactNode, useMemo } from 'react';
import i18next from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getOptions, languages, cookieName } from '@/lib/i18n-config';

// Initialize i18next instance
const i18n = i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../../public/locales/${language}/${namespace}.json`)
    )
  );

// Initialization outside the component
i18n.init({
  ...getOptions(),
  detection: {
    order: ['path', 'htmlTag', 'cookie', 'navigator'],
    caches: ['cookie'],
    lookupCookie: cookieName,
  },
});

export function I18nProvider({ children, lng }: { children: ReactNode; lng: string }) {
  // Sync language when lng changes (e.g., on navigation)
  useMemo(() => {
    if (i18n.language !== lng) {
      i18n.changeLanguage(lng);
    }
  }, [lng]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
