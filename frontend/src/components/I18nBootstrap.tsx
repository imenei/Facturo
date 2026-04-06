'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useI18nStore } from '@/store/i18nStore';

function normalizeTranslationKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveTranslation(translations: Record<string, any>, source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;

  const direct = trimmed.split('.').reduce((acc, key) => acc?.[key], translations);
  if (typeof direct === 'string') return direct;

  const normalized = normalizeTranslationKey(trimmed);
  const normalizedValue = normalized.split('.').reduce((acc, key) => acc?.[key], translations);
  return typeof normalizedValue === 'string' ? normalizedValue : null;
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(tag);
}

function translateDom(translations: Record<string, any>) {
  if (typeof document === 'undefined') return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of textNodes) {
    if (shouldSkipTextNode(node)) continue;
    const raw = node.nodeValue ?? '';
    if (!raw.trim()) continue;

    const original = ((node as any).__i18nOriginalText as string | undefined) ?? raw;
    if (!(node as any).__i18nOriginalText) {
      (node as any).__i18nOriginalText = original;
    }

    const translated = resolveTranslation(translations, original);
    node.nodeValue = translated ? raw.replace(original.trim(), translated) : original;
  }

  const elements = document.body.querySelectorAll<HTMLElement>('input, textarea, button, option, [title], [aria-label]');
  for (const el of elements) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const placeholder = el.dataset.i18nOriginalPlaceholder ?? el.getAttribute('placeholder') ?? '';
      if (placeholder) {
        el.dataset.i18nOriginalPlaceholder = placeholder;
        const translatedPlaceholder = resolveTranslation(translations, placeholder);
        el.setAttribute('placeholder', translatedPlaceholder || placeholder);
      }
    }

    const title = el.dataset.i18nOriginalTitle ?? el.getAttribute('title') ?? '';
    if (title) {
      el.dataset.i18nOriginalTitle = title;
      const translatedTitle = resolveTranslation(translations, title);
      el.setAttribute('title', translatedTitle || title);
    }

    const ariaLabel = el.dataset.i18nOriginalAriaLabel ?? el.getAttribute('aria-label') ?? '';
    if (ariaLabel) {
      el.dataset.i18nOriginalAriaLabel = ariaLabel;
      const translatedAriaLabel = resolveTranslation(translations, ariaLabel);
      el.setAttribute('aria-label', translatedAriaLabel || ariaLabel);
    }
  }
}

export default function I18nBootstrap() {
  const pathname = usePathname();
  const { locale, setLocale, translations } = useI18nStore();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      translateDom(translations);
    }, 0);

    return () => window.clearTimeout(id);
  }, [translations, locale, pathname]);

  return null;
}
