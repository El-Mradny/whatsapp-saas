import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { requireEnv } from '../common/env';
import { toChatId } from '../common/phone';
import { NumberStatus } from '../entities';

/**
 * Adapter for the OpenWA REST API (https://docs.open-wa.org/api-reference/).
 *
 * Authentication: EVERY request carries the `X-API-Key` header (set once on the axios instance below).
 * The key lives only in the backend environment — it is never sent to the browser, never put in a URL,
 * and never logged (errors are rewritten so axios' request config / headers can't leak).
 *
 * Endpoints used (all under /api):
 *   POST   /sessions                          body { name, config?, proxyUrl? }
 *   POST   /sessions/:id/start | /stop
 *   GET    /sessions/:id
 *   GET    /sessions/:id/qr
 *   DELETE /sessions/:id
 *   POST   /sessions/:id/messages/send-text   body { chatId, text }
 *   POST   /sessions/:id/webhooks             body { url, events, secret }
 */
@Injectable()
export class OpenWaService {
  private readonly log = new Logger(OpenWaService.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = requireEnv('OPENWA_URL').replace(/\/+$/, '').replace(/\/api$/, ''); // tolerate a trailing /api
    const apiKey = requireEnv('OPENWA_API_KEY');
    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': apiKey },
      maxBodyLength: Infinity,
    });
  }

  private async call<T = any>(method: 'get' | 'post' | 'delete', path: string, data?: unknown): Promise<T> {
    const url = `/api${path}`;
    try {
      const res = await this.http.request({ method, url, data });
      return res.data as T;
    } catch (e) {
      const err = e as AxiosError<any>;
      // Deliberately build the message from status/body only — never from err.config (contains the API key).
      if (err.response) {
        const body = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
        throw new BadGatewayException(`OpenWA ${method.toUpperCase()} ${url} -> ${err.response.status}: ${body}`.slice(0, 600));
      }
      throw new BadGatewayException(`Cannot reach OpenWA (${method.toUpperCase()} ${url}): ${err.code || err.message}`);
    }
  }

  /** Unwrap `{ data: ... }` envelopes if present. */
  private unwrap(d: any) {
    return d && typeof d === 'object' && 'data' in d && d.data !== null && typeof d.data === 'object' ? d.data : d;
  }

  async createSession(name: string): Promise<string> {
    const d = this.unwrap(await this.call('post', '/sessions', { name }));
    const id = d?.id ?? d?.sessionId ?? d?.name;
    if (!id) throw new BadGatewayException('OpenWA did not return a session id');
    return String(id);
  }

  startSession(id: string) {
    return this.call('post', `/sessions/${encodeURIComponent(id)}/start`);
  }

  async stopSession(id: string) {
    try {
      await this.call('post', `/sessions/${encodeURIComponent(id)}/stop`);
    } catch (e: any) {
      this.log.warn(`stopSession: ${e.message}`); // 409 when already stopped is fine
    }
  }

  async deleteSession(id: string) {
    await this.stopSession(id);
    try {
      await this.call('delete', `/sessions/${encodeURIComponent(id)}`); // 204 No Content
    } catch (e: any) {
      this.log.warn(`deleteSession: ${e.message}`);
    }
  }

  /** Returns the QR as a data-URL image or raw QR string, or null while none is available. */
  async getQr(id: string): Promise<string | null> {
    try {
      const d = this.unwrap(await this.call('get', `/sessions/${encodeURIComponent(id)}/qr`));
      if (typeof d === 'string') return d;
      return d?.qrCode ?? d?.qr ?? d?.base64 ?? d?.image ?? d?.dataUrl ?? null;
    } catch {
      return null; // 400/404 while the session is still starting or already connected
    }
  }



  async getSession(id: string): Promise<{ status: NumberStatus; phone?: string }> {
    const d = this.unwrap(await this.call('get', `/sessions/${encodeURIComponent(id)}`));
    return { status: d.status, phone: extractPhone(d) };
  }

  /** Registers a signed webhook. OpenWA signs each delivery: X-OpenWA-Signature = sha256=HMAC(secret, rawBody). */
  registerWebhook(id: string, url: string, secret: string, events: string[] = ['message.received', 'session.status']) {
    return this.call('post', `/sessions/${encodeURIComponent(id)}/webhooks`, { url, events, secret });
  }

  async sendText(id: string, phoneOrChatId: string, text: string): Promise<string | undefined> {
    const d = this.unwrap(
      await this.call('post', `/sessions/${encodeURIComponent(id)}/messages/send-text`, {
        chatId: toChatId(phoneOrChatId),
        text,
      }),
    );
    const mid = d?.id ?? d?.messageId ?? d?.key?.id;
    return mid && typeof mid === 'object' ? mid._serialized ?? mid.id : mid;
  }
}

/** Shared by the REST poller and the session.status webhook so both interpret statuses identically. */
export function mapStatus(raw: unknown): NumberStatus {
  const s = String(raw ?? '').toLowerCase();
  if (/(ready|connected|authenticated|working|open)/.test(s) && !/dis/.test(s)) return 'ready';
  if (s.includes('qr')) return 'qr_ready';
  if (/(stop|disconnect|fail|logout|logged_out|closed|error|revoked)/.test(s)) return 'disconnected';
  return 'created'; // created / starting / initializing / unknown
}

export function extractPhone(d: any): string | undefined {
  const p = d?.phone ?? d?.phoneNumber ?? d?.me?.user ?? d?.me?.id?.user ?? d?.info?.wid?.user ?? d?.wid?.user;
  const digits = p ? String(p).split('@')[0].replace(/\D/g, '') : '';
  return digits || undefined;
}
