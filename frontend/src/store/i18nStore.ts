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

function normalizeTranslationKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mergeTranslationChunks(raw: string): Record<string, any> {
  const content = raw.trim();
  if (!content) return {};

  try {
    return JSON.parse(content);
  } catch {
    const chunks: string[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          chunks.push(content.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return chunks.reduce<Record<string, any>>((acc, chunk) => {
      try {
        const parsed = JSON.parse(chunk);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.assign(acc, parsed);
        }
      } catch {
        // Ignore malformed fragments and keep the valid ones.
      }
      return acc;
    }, {});
  }
}

// Fonction pour charger les traductions côté client
async function loadTranslations(locale: Locale): Promise<Record<string, any>> {
  try {
    const res = await fetch(`/locales/${locale}/common.json`);
    const raw = await res.text();
    return mergeTranslationChunks(raw);
  } catch {
    return {};
  }
}

// Fonction pour charger les traductions côté serveur (SSR)
export async function loadTranslationsSSR(locale: Locale, ctx?: GetServerSidePropsContext) {
  void locale;
  void ctx;
  return {};
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
        if (value === key) {
          const normalizedKey = normalizeTranslationKey(key);
          if (normalizedKey && normalizedKey !== key) {
            value = getNestedValue(translations, normalizedKey);
          }
        }
        if (typeof value !== 'string') value = key;
        if (vars) {
          Object.entries(vars).forEach(([k, v]) => {
            value = value.replace(new RegExp(`{{${k}}}`, 'g'), v);
          });
        }
        return value || key;
      },
    }),
    {
      name: 'facturo_i18n_v2',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          state.setLocale(state.locale);
        } else {
          state?.setLocale('fr');
        }
      },
    },
  ),
);
