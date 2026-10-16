import { createHmac, timingSafeEqual } from 'crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { webhookSecretFor } from '../common/env';
import { normalizePhone } from '../common/phone';
import { AiService } from '../core/ai.service';
import { MessagesService } from '../core/messages.service';
import { extractPhone, mapStatus } from '../core/openwa.service';
import { WaNumber } from '../entities';

/**
 * Receives events from OpenWA. Public endpoint, authenticated by OpenWA's HMAC signature:
 *   X-OpenWA-Signature: sha256=<hex HMAC-SHA256 of the raw request body, keyed with the webhook secret>
 *   X-OpenWA-Event:     e.g. message.received, session.status
 * Payload field names are parsed tolerantly — verify `extract()` against a real delivery from your OpenWA.
 */
@Controller('webhooks')
export class WebhooksController {
  private readonly log = new Logger(WebhooksController.name);

  constructor(
    @InjectRepository(WaNumber) private numbers: Repository<WaNumber>,
    private messages: MessagesService,
    private ai: AiService,
  ) {}

  @Post('openwa/:numberId')
  @HttpCode(200)
  async handle(
    @Param('numberId') numberId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-openwa-signature') signature: string | undefined,
    @Headers('x-openwa-event') eventHeader: string | undefined,
    @Body() body: any,
  ) {
    // 1) Authenticate: signature must match, computed over the exact raw bytes.
    if (!this.validSignature(numberId, req.rawBody, signature)) throw new ForbiddenException('Invalid signature');

    const number = await this.numbers.findOne({ where: { id: numberId } });
    if (!number) return { ok: true }; // number deleted; ignore quietly

    const event = String(eventHeader ?? body?.event ?? body?.type ?? '').toLowerCase();
    const data = body?.data ?? body?.payload ?? body;

    if (event.includes('session') || event.includes('status')) {
      number.status = mapStatus(data?.status ?? data?.state);
      const phone = extractPhone(data);
      if (phone) number.phone = phone;
      await this.numbers.save(number);
      return { ok: true };
    }

    if (event.includes('message')) {
      const m = this.extract(data);
      if (m && !m.fromMe) {
        const stored = await this.messages.storeInbound(number, m.phone, m.text, m.name, m.id);
        if (stored && number.aiEnabled && this.ai.configured) {
          // Don't block the webhook response on the LLM
          void this.autoReply(number, m.phone, m.name).catch((e) => this.log.warn(`AI reply failed: ${e.message}`));
        }
      }
    }
    return { ok: true };
  }

  private validSignature(numberId: string, raw: Buffer | undefined, header: string | undefined): boolean {
    if (!raw || !header) return false;
    const expected = 'sha256=' + createHmac('sha256', webhookSecretFor(numberId)).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(header.trim());
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private extract(d: any): { phone: string; text: string; name?: string; id?: string; fromMe: boolean } | null {
    const from = String(d?.from ?? d?.chatId ?? d?.sender ?? '');
    if (!from || from.endsWith('@g.us') || from.includes('status@broadcast')) return null; // skip groups/status
    const text = d?.body ?? d?.text ?? d?.content ?? d?.message?.text;
    if (typeof text !== 'string' || !text.trim()) return null; // text only for now
    const phone = normalizePhone(from);
    if (!phone) return null;
    return {
      phone,
      text,
      name: d?.pushName ?? d?.notifyName ?? d?.senderName,
      id: d?.id?._serialized ?? (typeof d?.id === 'string' ? d.id : d?.messageId),
      fromMe: !!(d?.fromMe ?? d?.isFromMe),
    };
  }

  private async autoReply(number: WaNumber, phone: string, name?: string) {
    const history = await this.messages.history(number.id, phone, 30);
    const text = await this.ai.reply(number, history);
    if (!text) return;
    await this.messages.sendAndStore({ number, phone, text, source: 'ai', contactName: name });
  }
}
