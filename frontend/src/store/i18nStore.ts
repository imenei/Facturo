'use client';

import type { GetServerSidePropsContext } from 'next';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'fr' | 'ar' | 'en';

type TranslationDictionary = Record<string, any> & {
  __flat?: Record<string, string>;
};

interface I18nState {
  locale: Locale;
  translations: TranslationDictionary;
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

function flattenTranslations(
  input: Record<string, any>,
  prefix = '',
  target: Record<string, string> = {},
): Record<string, string> {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      target[path] = value;
      target[normalizeTranslationKey(path)] = value;
      target[key] = value;
      target[normalizeTranslationKey(key)] = value;
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenTranslations(value, path, target);
    }
  }

  return target;
}

async function loadTranslations(locale: Locale): Promise<Record<string, any>> {
  try {
    const res = await fetch(`/locales/${locale}/common.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Unable to load locale ${locale}`);

    const raw = await res.text();
    const parsed = mergeTranslationChunks(raw);
    if (Object.keys(parsed).length > 0) return parsed;
  } catch {
    if (locale !== 'fr') {
      return loadTranslations('fr');
    }
  }

  return {};
}

async function loadTranslationsFromPublic(locale: Locale): Promise<Record<string, any>> {
  try {
    const messages = await import(`../../public/locales/${locale}/common.json`);
    return (messages.default ?? messages) as Record<string, any>;
  } catch {
    if (locale !== 'fr') {
      return loadTranslationsFromPublic('fr');
    }
  }

  return {};
}

export async function loadTranslationsSSR(locale: Locale, ctx?: GetServerSidePropsContext) {
  void ctx;
  return loadTranslationsFromPublic(locale);
}

function getNestedValue(obj: Record<string, any>, key: string): any {
  return key.split('.').reduce((acc, k) => acc?.[k], obj) ?? key;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'fr',
      translations: {},
      isRTL: false,

      setLocale: async (locale: Locale) => {
        const translations =
          typeof window === 'undefined'
            ? await loadTranslationsSSR(locale)
            : await loadTranslations(locale);

        const isRTL = locale === 'ar';
        const flatTranslations = flattenTranslations(translations);

        if (typeof document !== 'undefined') {
          document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
          document.documentElement.lang = locale;
          document.documentElement.classList.toggle('rtl', isRTL);
        }

        set({
          locale,
          translations: { ...translations, __flat: flatTranslations },
          isRTL,
        });
      },

      t: (key: string, vars?: Record<string, string>) => {
        const { translations } = get();
        const flatTranslations = translations.__flat ?? {};
        let value = getNestedValue(translations, key);

        if (value === key) {
          const normalizedKey = normalizeTranslationKey(key);
          if (normalizedKey && normalizedKey !== key) {
            value = getNestedValue(translations, normalizedKey);
          }
        }

        if (value === key) {
          value = flatTranslations[key] ?? flatTranslations[normalizeTranslationKey(key)] ?? key;
        }

        if (value === key && key.includes('.')) {
          const leafKey = key.split('.').pop() ?? key;
          value = flatTranslations[leafKey] ?? flatTranslations[normalizeTranslationKey(leafKey)] ?? key;
        }

        if (typeof value !== 'string') value = key;

        if (vars) {
          Object.entries(vars).forEach(([name, replacement]) => {
            value = value.replace(new RegExp(`{{${name}}}`, 'g'), replacement);
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
          void state.setLocale(state.locale);
        } else {
          void state?.setLocale('fr');
        }
      },
    },
  ),
);
