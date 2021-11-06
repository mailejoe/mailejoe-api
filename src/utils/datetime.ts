export function convertToUTC(d: Date): Date {
  const asUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  return new Date(asUTC); 
}