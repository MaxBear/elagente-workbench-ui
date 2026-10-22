/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, LanguageSwitcher, getLocale, setLocale, useI18n, formatDate, formatNumber, resolveTranslation, resources, type TranslationKey } from './index';
import { buildAttachmentPlaceholder } from '../components/composer/composerUtils';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, detectLocale, normalizeLocale } from './locales';

beforeEach(() => { localStorage.clear(); setLocale('en', false); });
afterEach(() => { setLocale('en', false); vi.restoreAllMocks(); });

describe('locale resolution', () => {
  it('normalizes common locale aliases without depending on casing or separators', () => {
    for (const alias of ['zh', 'ZH_cn', 'zh-Hans', 'zh-Hans-CN', 'zh-SG', 'zh-TW', 'zh-HK', '中文', 'Chinese']) expect(normalizeLocale(alias)).toBe('zh-CN');
    for (const alias of ['en', 'en-US', 'en_GB', 'EN-ca', 'English']) expect(normalizeLocale(alias)).toBe('en');
    for (const unsupported of [null, undefined, '', 'fr-FR', 'invalid']) expect(normalizeLocale(unsupported)).toBe(DEFAULT_LOCALE);
  });
  it('honors an explicit saved preference and otherwise finds the first supported browser language', () => {
    expect(detectLocale('en-US', ['zh-CN'])).toBe('en');
    expect(detectLocale('zh_hans', ['en-US'])).toBe('zh-CN');
    expect(detectLocale('fr', ['zh-CN'])).toBe('en');
    expect(detectLocale(null, ['fr', 'zh-SG', 'en-US'])).toBe('zh-CN');
    expect(detectLocale(null, ['fr', 'de'])).toBe('en');
  });
  it('persists canonical preferences, updates the document and can restore on fresh initialization', async () => {
    setLocale('zh_Hans');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    const store = (globalThis as unknown as Record<symbol, { initialized: boolean; locale: string }>)[Symbol.for('remote-codex.i18n')]!;
    store.initialized = false; store.locale = 'en';
    expect(getLocale()).toBe('zh-CN');
    setLocale('unsupported');
    expect(document.documentElement.lang).toBe('en');
  });
  it('switches even when browser storage is denied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => setLocale('zh')).not.toThrow();
    expect(getLocale()).toBe('zh-CN');
  });
});

describe('translation resources', () => {
  it('has exact key and placeholder parity, with no empty translations', () => {
    expect(Object.keys(resources['zh-CN']).sort()).toEqual(Object.keys(resources.en).sort());
    const placeholders = (text: string) => [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))].sort();
    for (const key of Object.keys(resources.en) as TranslationKey[]) {
      const english = resources.en[key]; const chinese = resources['zh-CN'][key];
      const variants = typeof english === 'string' ? [[english, chinese]] : [[english.one, (chinese as { one: string; other: string }).one], [english.other, (chinese as { one: string; other: string }).other]];
      for (const [left, right] of variants) { expect(typeof right, key).toBe('string'); expect(String(right).trim(), key).not.toBe(''); expect(placeholders(String(right)), key).toEqual(placeholders(String(left))); }
    }
  });
  it('falls back to English, interpolates literal user values, and detects missing keys/values', () => {
    expect(resolveTranslation('zh-CN', 'common.language', {}, { en: resources.en })).toBe('Language');
    expect(resolveTranslation('zh-CN', 'files.edit', { value1: '<script>{{untrusted}}</script>' })).toContain('<script>{{untrusted}}</script>');
    expect(() => resolveTranslation('en', 'files.edit')).toThrow('Missing interpolation value');
    expect(() => resolveTranslation('en', 'missing.key' as TranslationKey)).toThrow('Missing translation key');
  });
  it('uses locale plural rules and the selected locale for dates/numbers', () => {
    expect(resolveTranslation('en', 'common.items', { count: 1 })).toBe('1 item');
    expect(resolveTranslation('en', 'common.items', { count: 2 })).toBe('2 items');
    expect(resolveTranslation('zh-CN', 'common.items', { count: 2 })).toBe('2 项');
    setLocale('zh-CN');
    expect(formatDate('2026-10-07T12:00:00Z', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })).toBe('2026年10月7日');
    expect(formatNumber(1234.5)).toBe(new Intl.NumberFormat('zh-CN').format(1234.5));
  });
});

it('updates host and shared subscribers together without remounting the draft, and handles another tab', () => {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  function Host() { const { t } = useI18n(); const [draft] = useState('user message in English'); return <><LanguageSwitcher /><p data-host>{t('common.language')}</p><input value={draft} readOnly /></>; }
  function Shared() { const { t } = useI18n(); return <p data-shared>{t('common.language')}</p>; }
  try {
    flushSync(() => root.render(<I18nProvider><Host /><Shared /></I18nProvider>));
    flushSync(() => setLocale('zh'));
    expect(container.querySelector('[data-host]')?.textContent).toBe('语言');
    expect(container.querySelector('[data-shared]')?.textContent).toBe('语言');
    expect(container.querySelector('input')?.value).toBe('user message in English');
    flushSync(() => window.dispatchEvent(new StorageEvent('storage', { key: LOCALE_STORAGE_KEY, newValue: 'en-GB' })));
    expect(container.querySelector('[data-shared]')?.textContent).toBe('Language');
  } finally { flushSync(() => root.unmount()); container.remove(); }
});

it('keeps harness-facing attachment prompt tokens invariant across languages', () => {
  for (const locale of ['en', 'zh-CN']) {
    setLocale(locale, false);
    expect(buildAttachmentPlaceholder('photo', 'my image.png', new Set())).toBe('[PHOTO my image.png]');
    expect(buildAttachmentPlaceholder('file', '用户.txt', new Set())).toBe('[FILE 用户.txt]');
  }
});
