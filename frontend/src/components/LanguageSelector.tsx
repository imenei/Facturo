'use client';

import { Globe } from 'lucide-react';
import { Locale, useI18nStore } from '@/store/i18nStore';

const LANGUAGES: { code: Locale; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'ar', label: 'العربية', short: 'AR' },
  { code: 'en', label: 'English', short: 'EN' },
];

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18nStore();
  const active = LANGUAGES.find((language) => language.code === locale) ?? LANGUAGES[0];

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-all w-full"
      >
        <Globe size={16} />
        {!compact && <span>{active.short} {active.label}</span>}
        {compact && <span>{active.short}</span>}
      </button>

      <div className="absolute bottom-full left-0 mb-1 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {LANGUAGES.map((language) => (
          <button
            type="button"
            key={language.code}
            onClick={() => void setLocale(language.code)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
              locale === language.code
                ? 'bg-brand-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{language.short}</span>
            <span>{language.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
