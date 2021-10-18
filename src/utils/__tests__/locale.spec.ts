import { getLocale } from '../locale';

describe('getLocale', () => {
  test('header does not exist', () => {
    expect(getLocale({ headers: {} })).toBe('en');
  });

  test('header specifies a single locale', () => {
    expect(getLocale({ headers: { 'accept-language': 'en' } })).toBe('en');
  });

  test('header specifies multiple weighted locales', () => {
    expect(getLocale({ headers: { 'accept-language': 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5' } })).toBe('en');
  });

  test('header specifies unsupported locale', () => {
    expect(getLocale({ headers: { 'accept-language': 'fr-CH' } })).toBe('en');
  });

  test('header specifies supported locale', () => {
    expect(getLocale({ headers: { 'accept-language': 'es' } })).toBe('es');
  });
});