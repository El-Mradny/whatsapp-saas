/** Strip everything except digits; drop a leading "00" international prefix. */
export function normalizePhone(input: string): string {
  if (!input) return '';
  let d = String(input).split('@')[0].replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  return d;
}

export function toChatId(phone: string): string {
  if (phone.includes('@')) return phone;
  return `${normalizePhone(phone)}@c.us`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
