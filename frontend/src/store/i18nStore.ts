import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'fr' | 'ar' | 'en';

interface I18nState {
  locale: Locale;
  translations: Record<string, any>;
  isRTL: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, vars?: Record<string, string>) => string;
}

async function loadTranslations(locale: Locale): Promise<Record<string, any>> {
  try {
    const res = await fetch(`/locales/${locale}/common.json`);
    return res.json();
  } catch {
    return {};
  }
}

function getNestedValue(obj: Record<string, any>, key: string): string {
  return key.split('.').reduce((acc, k) => acc?.[k], obj) ?? key;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'fr',
      translations: {},
      isRTL: false,

      setLocale: async (locale: Locale) => {
        const translations = await loadTranslations(locale);
        const isRTL = locale === 'ar';

        // Apply RTL to document
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
            value = value.replace(`{{${k}}}`, v);
          });
        }
        return value || key;
      },
    }),
    {
      name: 'facturo_i18n',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        // Auto-load translations on rehydration
        if (state?.locale) {
          state.setLocale(state.locale);
        }
      },
    },
  ),
);
