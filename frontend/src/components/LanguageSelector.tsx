'use client';
import { useI18nStore, Locale } from '@/store/i18nStore';
import { Globe } from 'lucide-react';

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇩🇿' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18nStore();

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-all w-full">
        <Globe size={16} />
        {!compact && (
          <span>{LANGUAGES.find((l) => l.code === locale)?.flag} {LANGUAGES.find((l) => l.code === locale)?.label}</span>
        )}
        {compact && <span>{LANGUAGES.find((l) => l.code === locale)?.flag}</span>}
      </button>

      {/* Dropdown */}
      <div className="absolute bottom-full left-0 mb-1 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
              locale === lang.code
                ? 'bg-brand-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
