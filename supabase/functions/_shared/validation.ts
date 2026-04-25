export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function sanitizeEmailSubject(str: string): string {
  if (!str) return '';
  return str.replace(/[\r\n]/g, '').substring(0, 200);
}
