import { Request } from 'express';
import { parse } from 'accept-language-parser';

const DEFAULT_LOCALE = 'en';
const LOCALE_HEADER = 'accept-language';
const AVAILABLE_LOCALES = ['en', 'es'];

export function getLocale(req: Request): string {
  const header = Object.keys(req.headers).find(h => h.toLowerCase() === LOCALE_HEADER);

  const raw = parse(req.headers[header]);
  let locales: Array<string> = raw.map((value) => {
    return value.region ? value.code + '_' + value.region : value.code;
  });

  if (!locales) {
    return DEFAULT_LOCALE;
  }

  if (!Array.isArray(locales)) {
    locales = [locales];
  }

  return locales.find(l => AVAILABLE_LOCALES.includes(l)) || DEFAULT_LOCALE;
}