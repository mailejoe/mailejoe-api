import { parse } from 'accept-language-parser';
import { Request } from 'express';

const DEFAULT_LOCALE = 'en';
const LOCALE_HEADER = 'accept-language';
const AVAILABLE_LOCALES = ['en', 'es'];

/**
 * Determines the best locale option by looking the Accept-Language header in the
 * request and determining is a suitable supported locale can be matched. Default
 * is `en`.
 * @param {Object} request - the HTTP request object
 * @param {string[]} [request.headers] - an array of headers on the HTTP request
 * @return {boolean}
 */
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