'use client'; // nécessaire pour Zustand côté client

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GetServerSidePropsContext } from 'next';

export type Locale = 'fr' | 'ar' | 'en';

interface I18nState {
  locale: Locale;
  translations: Record<string, any>;
  isRTL: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, vars?: Record<string, string>) => string;
}

// Fonction pour charger les traductions côté client
async function loadTranslations(locale: Locale): Promise<Record<string, any>> {
  try {
    const res = await fetch(`/locales/${locale}/common.json`);
    return res.json();
  } catch {
    return {};
  }
}

// Fonction pour charger les traductions côté serveur (SSR)
export async function loadTranslationsSSR(locale: Locale, ctx?: GetServerSidePropsContext) {
  try {
    // Next.js côté serveur peut utiliser import()
    const translations = await import(`../public/locales/${locale}/common.json`);
    return translations.default ?? {};
  } catch {
    return {};
  }
}

function getNestedValue(obj: Record<string, any>, key: string): any {
  return key.split('.').reduce((acc, k) => acc?.[k], obj) ?? key;
}
// Store Zustand
export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'fr',
      translations: {},
      isRTL: false,

      setLocale: async (locale: Locale) => {
        let translations: Record<string, any> = {};
        if (typeof window === 'undefined') {
          // SSR : on peut charger statiquement via import
          translations = await loadTranslationsSSR(locale);
        } else {
          // Client
          translations = await loadTranslations(locale);
        }

        const isRTL = locale === 'ar';

        // Appliquer la direction du texte côté client
        if (typeof document !== 'undefined') {
          document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
          document.documentElement.lang = locale;
          document.documentElement.classList.toggle('rtl', isRTL);
        }

        set({ locale, translations, isRTL });
      },

      t: (key: string, vars?: Record<string, string>) => {
        const { translations } = get();
        let value = getNestedValue(translations, key);
        if (vars) {
          Object.entries(vars).forEach(([k, v]) => {
            value = value.replace(new RegExp(`{{${k}}}`, 'g'), v);
          });
        }
        return value || key;
      },
    }),
    {
      name: 'facturo_i18n',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          state.setLocale(state.locale);
        }
      },
    },
  ),
);