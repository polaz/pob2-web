/**
 * Unit tests for i18n utilities.
 *
 * Tests localized string handling, script type detection,
 * and n-gram size calculation for different locales.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getScriptType,
  getNgramSize,
  getLocalizedText,
  hasLocale,
  createLocalizedString,
  mergeLocalizedStrings,
  type LocalizedString,
} from 'src/types/i18n';

describe('i18n utilities', () => {
  describe('constants', () => {
    it('should have en-US as default locale', () => {
      expect(DEFAULT_LOCALE).toBe('en-US');
    });

    it('should have all expected locales', () => {
      const locales = Object.keys(SUPPORTED_LOCALES);

      expect(locales).toContain('en-US');
      expect(locales).toContain('ru');
      expect(locales).toContain('zh-CN');
      expect(locales).toContain('ja');
      expect(locales).toContain('ko');
      expect(locales).toContain('th');
    });
  });

  describe('getScriptType', () => {
    it('should return latin for English', () => {
      expect(getScriptType('en-US')).toBe('latin');
    });

    it('should return latin for Russian', () => {
      expect(getScriptType('ru')).toBe('latin');
    });

    it('should return latin for German', () => {
      expect(getScriptType('de')).toBe('latin');
    });

    it('should return cjk for Chinese Simplified', () => {
      expect(getScriptType('zh-CN')).toBe('cjk');
    });

    it('should return cjk for Chinese Traditional', () => {
      expect(getScriptType('zh-TW')).toBe('cjk');
    });

    it('should return cjk for Japanese', () => {
      expect(getScriptType('ja')).toBe('cjk');
    });

    it('should return cjk for Korean', () => {
      expect(getScriptType('ko')).toBe('cjk');
    });

    it('should return thai for Thai', () => {
      expect(getScriptType('th')).toBe('thai');
    });

    it('should fallback to latin for unknown locales', () => {
      expect(getScriptType('xyz-unknown')).toBe('latin');
    });

    it('should detect CJK from prefix for unknown variants', () => {
      expect(getScriptType('zh-HK')).toBe('cjk');
      expect(getScriptType('ja-JP')).toBe('cjk');
      expect(getScriptType('ko-KR')).toBe('cjk');
    });

    it('should detect Thai from prefix for unknown variants', () => {
      expect(getScriptType('th-TH')).toBe('thai');
    });
  });

  describe('getNgramSize', () => {
    it('should return 3 for latin script', () => {
      expect(getNgramSize('latin')).toBe(3);
    });

    it('should return 2 for cjk script', () => {
      expect(getNgramSize('cjk')).toBe(2);
    });

    it('should return 2 for thai script', () => {
      expect(getNgramSize('thai')).toBe(2);
    });
  });

  describe('getLocalizedText', () => {
    const localized: LocalizedString = {
      'en-US': 'Fireball',
      'ru': 'Огненный шар',
      'zh-CN': '火球术',
    };

    it('should return exact locale match', () => {
      expect(getLocalizedText(localized, 'en-US')).toBe('Fireball');
      expect(getLocalizedText(localized, 'ru')).toBe('Огненный шар');
      expect(getLocalizedText(localized, 'zh-CN')).toBe('火球术');
    });

    it('should fallback to en-US for missing locale', () => {
      expect(getLocalizedText(localized, 'de')).toBe('Fireball');
    });

    it('should use custom fallback locale', () => {
      expect(getLocalizedText(localized, 'de', 'ru')).toBe('Огненный шар');
    });

    it('should return first available if fallback also missing', () => {
      const partial: LocalizedString = { 'zh-CN': '火球术' };
      expect(getLocalizedText(partial, 'de')).toBe('火球术');
    });

    it('should return empty string for null/undefined', () => {
      expect(getLocalizedText(null, 'en-US')).toBe('');
      expect(getLocalizedText(undefined, 'en-US')).toBe('');
    });

    it('should return empty string for empty object', () => {
      expect(getLocalizedText({}, 'en-US')).toBe('');
    });
  });

  describe('hasLocale', () => {
    const localized: LocalizedString = {
      'en-US': 'Fireball',
      'ru': 'Огненный шар',
      'de': '', // Empty string
    };

    it('should return true for existing locale', () => {
      expect(hasLocale(localized, 'en-US')).toBe(true);
      expect(hasLocale(localized, 'ru')).toBe(true);
    });

    it('should return false for missing locale', () => {
      expect(hasLocale(localized, 'zh-CN')).toBe(false);
    });

    it('should return false for empty string value', () => {
      expect(hasLocale(localized, 'de')).toBe(false);
    });

    it('should return false for null/undefined input', () => {
      expect(hasLocale(null, 'en-US')).toBe(false);
      expect(hasLocale(undefined, 'en-US')).toBe(false);
    });
  });

  describe('createLocalizedString', () => {
    it('should create with default locale', () => {
      const result = createLocalizedString('Fireball');
      expect(result).toEqual({ 'en-US': 'Fireball' });
    });

    it('should create with custom locale', () => {
      const result = createLocalizedString('Огненный шар', 'ru');
      expect(result).toEqual({ 'ru': 'Огненный шар' });
    });
  });

  describe('mergeLocalizedStrings', () => {
    it('should merge multiple strings', () => {
      const en = { 'en-US': 'Fireball' };
      const ru = { 'ru': 'Огненный шар' };
      const zh = { 'zh-CN': '火球术' };

      const result = mergeLocalizedStrings(en, ru, zh);

      expect(result).toEqual({
        'en-US': 'Fireball',
        'ru': 'Огненный шар',
        'zh-CN': '火球术',
      });
    });

    it('should override with later values', () => {
      const base = { 'en-US': 'Old' };
      const override = { 'en-US': 'New' };

      const result = mergeLocalizedStrings(base, override);

      expect(result).toEqual({ 'en-US': 'New' });
    });

    it('should skip null/undefined inputs', () => {
      const valid = { 'en-US': 'Fireball' };

      const result = mergeLocalizedStrings(null, valid, undefined);

      expect(result).toEqual({ 'en-US': 'Fireball' });
    });

    it('should return empty object for no inputs', () => {
      const result = mergeLocalizedStrings();
      expect(result).toEqual({});
    });
  });
});
