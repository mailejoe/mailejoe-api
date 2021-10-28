import { Request } from 'express';

import { getLocale } from '../locale';

describe('getLocale', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  
  it('should default to en when header does not exist', () => {
    expect(getLocale(({ headers: {} } as Request))).toBe('en');
  });

  it('should use locale specified when header specifies a single locale which is supported', () => {
    expect(getLocale(({ headers: { 'accept-language': 'en' } } as Request))).toBe('en');
  });

  it('should use first supported locale when header specifies multiple weighted locales', () => {
    expect(getLocale(({ headers: { 'accept-language': 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5' } } as Request))).toBe('en');
  });

  it('should default to en when header specifies unsupported locale', () => {
    expect(getLocale(({ headers: { 'accept-language': 'fr-CH' } } as Request))).toBe('en');
  });

  it('should use locale specified when header specifies supported locale', () => {
    expect(getLocale(({ headers: { 'accept-language': 'es' } } as Request))).toBe('es');
  });
});