'use client';

import { useEffect } from 'react';
import { useI18nStore } from '@/store/i18nStore';

/**
 * Filet de sécurité de traduction.
 *
 * La traduction principale passe par t() dans les composants. Ce composant traduit en plus,
 * dans le DOM, les textes français écrits « en dur » dont la clé existe dans les fichiers de langue,
 * et surtout il le fait de façon fiable :
 *  - un MutationObserver traduit aussi les contenus qui apparaissent après coup (données chargées,
 *    modales, changement de page) : plus besoin de rafraîchir la page ;
 *  - le texte d'origine de chaque nœud est mémorisé, et oublié dès que React le remplace
 *    (sinon un ancien texte pouvait réapparaître après un changement de langue) ;
 *  - au retour en français, les textes d'origine sont restaurés.
 */

function normalizeKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

type Dict = Record<string, string>;
type TextRecord = { orig: string; applied: string };

const textRecords = new WeakMap<Text, TextRecord>();
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
const ATTRIBUTES = [
  { attr: 'placeholder', orig: 'i18nOrigPlaceholder', applied: 'i18nAppliedPlaceholder' },
  { attr: 'title', orig: 'i18nOrigTitle', applied: 'i18nAppliedTitle' },
  { attr: 'aria-label', orig: 'i18nOrigAria', applied: 'i18nAppliedAria' },
] as const;

function lookup(dict: Dict, source: string): string | null {
  const text = source.trim();
  if (!text) return null;
  const direct = dict[text];
  if (typeof direct === 'string') return direct;
  const normalized = normalizeKey(text);
  if (!normalized) return null;
  const value = dict[normalized];
  return typeof value === 'string' ? value : null;
}

function shouldSkip(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  return !!parent.closest('[data-no-i18n], [contenteditable="true"]');
}

function translateTextNode(node: Text, dict: Dict, restoreOnly: boolean) {
  if (shouldSkip(node)) return;
  const raw = node.nodeValue ?? '';
  if (!raw.trim()) return;

  let record = textRecords.get(node);
  if (!record || raw !== record.applied) {
    // Nouveau nœud, ou texte remplacé par React : le texte courant devient la nouvelle référence.
    record = { orig: raw, applied: raw };
    textRecords.set(node, record);
  }

  const source = record.orig;
  const translated = restoreOnly ? null : lookup(dict, source);
  const next = translated ? source.replace(source.trim(), translated) : source;
  if (next !== raw) {
    node.nodeValue = next;
  }
  record.applied = next;
}

function translateElementAttributes(el: HTMLElement, dict: Dict, restoreOnly: boolean) {
  for (const { attr, orig, applied } of ATTRIBUTES) {
    const current = el.getAttribute(attr);
    if (current === null) continue;
    let original = el.dataset[orig];
    if (original === undefined || current !== el.dataset[applied]) {
      original = current;
      el.dataset[orig] = current;
    }
    const translated = restoreOnly ? null : lookup(dict, original);
    const next = translated || original;
    if (next !== current) el.setAttribute(attr, next);
    el.dataset[applied] = next;
  }
}

function translateTree(root: Node, dict: Dict, restoreOnly: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, dict, restoreOnly);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const rootEl = root as HTMLElement;
  if (rootEl.matches?.('[placeholder], [title], [aria-label]')) translateElementAttributes(rootEl, dict, restoreOnly);
  rootEl.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach((el) => {
    translateElementAttributes(el, dict, restoreOnly);
  });

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  for (const node of nodes) translateTextNode(node, dict, restoreOnly);
}

export default function I18nBootstrap() {
  const { locale, setLocale, translations } = useI18nStore();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const dict: Dict = (translations as any)?.__flat ?? {};
    const restoreOnly = locale === 'fr';
    let applying = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<Node>();

    const run = (roots: Iterable<Node>) => {
      applying = true;
      try {
        for (const root of roots) {
          if (root.isConnected) translateTree(root, dict, restoreOnly);
        }
      } finally {
        applying = false;
      }
    };

    // Passe complète immédiate (changement de langue) puis observation continue.
    run([document.body]);

    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => pending.add(node));
        } else if (mutation.type === 'characterData') {
          pending.add(mutation.target);
        } else if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          pending.add(mutation.target);
        }
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const batch = Array.from(pending);
        pending.clear();
        run(batch);
        observer.takeRecords(); // ignore nos propres modifications
      }, 60);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });
    observer.takeRecords();

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [translations, locale]);

  return null;
}
