import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { webhookSecretFor, webhookUrlFor } from '../common/env';
import { OpenWaService } from '../core/openwa.service';
import { WaNumber } from '../entities';

export class CreateNumberDto {
  @IsString() @MinLength(2) @MaxLength(60) label: string;
}
export class UpdateNumberDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) label?: string;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) aiPrompt?: string;
}

@Injectable()
export class NumbersService {
  constructor(@InjectRepository(WaNumber) private repo: Repository<WaNumber>, private openwa: OpenWaService) {}

  async get(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Number not found');
    return n;
  }

  list(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async create(userId: string, dto: CreateNumberDto) {
    const max = Number(process.env.MAX_NUMBERS_PER_USER || 5);
    if ((await this.repo.count({ where: { userId } })) >= max) {
      throw new BadRequestException(`Plan limit reached: ${max} WhatsApp numbers`);
    }
    const sessionId = await this.openwa.createSession(dto.label);
    const number = await this.repo.save(this.repo.create({ userId, label: dto.label, sessionId, status: 'created' }));
    try {
      await this.openwa.startSession(sessionId);
      await this.openwa.getQr(sessionId)
      // Signed webhook: OpenWA will HMAC every delivery with this per-number secret (X-OpenWA-Signature).
      // await this.openwa.registerWebhook(sessionId, webhookUrlFor(number.id), webhookSecretFor(number.id));
    } catch (e) {
      await this.repo.delete(number.id);
      await this.openwa.deleteSession(sessionId);
      throw e;
    }
    return number;
  }

  /** Pull live status from OpenWA and persist it. */
  async sync(userId: string, id: string) {
    const n = await this.get(userId, id);
    try {
      const s = await this.openwa.getSession(n.sessionId);
      n.status = s.status;
      if (s.phone) n.phone = s.phone;
      await this.repo.save(n);
    } catch {
      /* keep last known state */
    }
    return n;
  }

  async qr(userId: string, id: string) {
    const n = await this.sync(userId, id);
    if (n.status === 'ready') return { status: n.status, qr: null, phone: n.phone };
    const qr = await this.openwa.getQr(n.sessionId);
    if (qr) {
      await this.repo.save(n);
    }
    return { status: n.status, qr, phone: n.phone };
  }


  async restart(userId: string, id: string) {
    const n = await this.get(userId, id);
    await this.openwa.stopSession(n.sessionId);
    await this.openwa.startSession(n.sessionId);
    n.status = 'created';
    return this.repo.save(n);
  }

  async update(userId: string, id: string, dto: UpdateNumberDto) {
    const n = await this.get(userId, id);
    Object.assign(n, dto);
    return this.repo.save(n);
  }

  async remove(userId: string, id: string) {
    const n = await this.get(userId, id);
    await this.openwa.deleteSession(n.sessionId);
    await this.repo.delete(n.id);
    return { ok: true };
  }
}
