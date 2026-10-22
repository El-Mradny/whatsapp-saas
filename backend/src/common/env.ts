import { createHmac } from 'crypto';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return v.trim();
}

/**
 * Per-number webhook secret, derived from WEBHOOK_SECRET so nothing extra is stored in the DB.
 * It is sent to OpenWA once when the webhook is registered; OpenWA then signs every delivery with it
 * (HMAC-SHA256 of the raw body, header `X-OpenWA-Signature: sha256=<hex>`).
 * NOTE: rotating WEBHOOK_SECRET invalidates existing registrations (re-create or restart the numbers).
 */
export function webhookSecretFor(numberId: string): string {
  return createHmac('sha256', requireEnv('WEBHOOK_SECRET')).update(numberId).digest('hex');
}

export function webhookUrlFor(numberId: string): string {
  const base = requireEnv('PUBLIC_URL').replace(/\/$/, '');
  return `${base}/api/webhooks/openwa/${numberId}`;
}


