import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { sleep } from '../common/phone';
import { MessagesService } from '../core/messages.service';
import { Campaign, CampaignRecipient, Contact, WaNumber } from '../entities';

export class CreateCampaignDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsString() numberId: string;
  /** Supports {{name}} placeholder */
  @IsOptional() @IsString() @MaxLength(4000) message?: string;
  /** Optional image URL or base64 data-URL */
  @IsOptional() @IsString() mediaUrl?: string;
  /** Explicit contact selection */
  @IsOptional() @IsArray() @IsString({ each: true }) contactIds?: string[];
  /** Or: all contacts having ANY of these tags. If neither is given, all contacts are targeted. */
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  /** ISO date. If in the future the campaign is scheduled, otherwise it stays a draft. */
  @IsOptional() @IsDateString() scheduledAt?: string;
  /** Seconds between messages (anti-ban throttle) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(120) delaySeconds?: number;
}
export class ScheduleDto {
  @IsDateString() scheduledAt: string;
}

@Injectable()
export class CampaignsService implements OnModuleInit {
  private readonly log = new Logger(CampaignsService.name);
  private running = new Set<string>();

  constructor(
    @InjectRepository(Campaign) private campaigns: Repository<Campaign>,
    @InjectRepository(CampaignRecipient) private recipients: Repository<CampaignRecipient>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    @InjectRepository(WaNumber) private numbers: Repository<WaNumber>,
    private messages: MessagesService,
  ) {}

  /** After a restart, campaigns that were mid-flight are picked up again by the scheduler. */
  async onModuleInit() {
    await this.campaigns.update({ status: 'running' }, { status: 'scheduled', scheduledAt: new Date() });
  }

  list(userId: string) {
    return this.campaigns.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async get(userId: string, id: string) {
    const c = await this.campaigns.findOne({ where: { id, userId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async detail(userId: string, id: string) {
    const campaign = await this.get(userId, id);
    const recipients = await this.recipients.find({ where: { campaignId: id }, order: { name: 'ASC' } });
    return { campaign, recipients };
  }

  async create(userId: string, dto: CreateCampaignDto) {
    const number = await this.numbers.findOne({ where: { id: dto.numberId, userId } });
    if (!number) throw new BadRequestException('Unknown WhatsApp number');

    let targets: Contact[];
    if (dto.contactIds?.length) {
      targets = await this.contacts.find({ where: { userId, id: In(dto.contactIds) } });
    } else {
      targets = await this.contacts.find({ where: { userId } });
      if (dto.tags?.length) targets = targets.filter((c) => (c.tags || []).some((t) => dto.tags.includes(t)));
    }
    if (!targets.length) throw new BadRequestException('No contacts match this audience');

    const when = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const scheduled = !!when && when.getTime() > Date.now();

    const campaign = await this.campaigns.save(
      this.campaigns.create({
        userId,
        name: dto.name,
        numberId: number.id,
        message: dto.message || '',
        mediaUrl: dto.mediaUrl || null,
        delaySeconds: dto.delaySeconds ?? 8,
        totalCount: targets.length,
        status: scheduled ? 'scheduled' : 'draft',
        scheduledAt: scheduled ? when : null,
      }),
    );
    await this.recipients.save(
      targets.map((c) => this.recipients.create({ campaignId: campaign.id, contactId: c.id, name: c.name, phone: c.phone })),
      { chunk: 200 },
    );
    return campaign;
  }

  async schedule(userId: string, id: string, dto: ScheduleDto) {
    const c = await this.get(userId, id);
    if (!['draft', 'scheduled'].includes(c.status)) throw new BadRequestException(`Cannot schedule a ${c.status} campaign`);
    const when = new Date(dto.scheduledAt);
    if (when.getTime() <= Date.now()) throw new BadRequestException('Schedule time must be in the future');
    c.scheduledAt = when;
    c.status = 'scheduled';
    return this.campaigns.save(c);
  }

  /** "Send now" */
  async start(userId: string, id: string) {
    const c = await this.get(userId, id);
    if (!['draft', 'scheduled'].includes(c.status)) throw new BadRequestException(`Campaign is already ${c.status}`);
    const number = await this.numbers.findOne({ where: { id: c.numberId } });
    if (number?.status !== 'ready') throw new BadRequestException('The selected WhatsApp number is not connected');
    c.status = 'scheduled';
    c.scheduledAt = new Date();
    await this.campaigns.save(c);
    void this.run(c.id);
    return c;
  }

  async cancel(userId: string, id: string) {
    const c = await this.get(userId, id);
    if (!['draft', 'scheduled', 'running'].includes(c.status)) throw new BadRequestException(`Campaign is already ${c.status}`);
    c.status = 'cancelled';
    return this.campaigns.save(c);
  }

  async remove(userId: string, id: string) {
    const c = await this.get(userId, id);
    if (c.status === 'running') throw new BadRequestException('Cancel the campaign before deleting it');
    await this.recipients.delete({ campaignId: c.id });
    await this.campaigns.delete(c.id);
    return { ok: true };
  }

  /** Scheduler: every 30s pick up campaigns whose time has come. */
  @Cron('*/30 * * * * *')
  async tick() {
    const due = await this.campaigns.find({
      where: { status: 'scheduled', scheduledAt: LessThanOrEqual(new Date()) },
    });
    for (const c of due) void this.run(c.id);
  }

  private async run(id: string) {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      const campaign = await this.campaigns.findOne({ where: { id } });
      if (!campaign || campaign.status !== 'scheduled') return;
      const number = await this.numbers.findOne({ where: { id: campaign.numberId } });

      if (!number || number.status !== 'ready') {
        campaign.status = 'failed';
        campaign.lastError = 'WhatsApp number was not connected at send time';
        await this.campaigns.save(campaign);
        return;
      }

      campaign.status = 'running';
      campaign.startedAt = campaign.startedAt ?? new Date();
      await this.campaigns.save(campaign);

      const pending = await this.recipients.find({ where: { campaignId: id, status: 'pending' } });
      for (const r of pending) {
        // Re-read status so cancel takes effect mid-run
        const fresh = await this.campaigns.findOne({ where: { id } });
        if (!fresh || fresh.status !== 'running') return;

        const text = (campaign.message || '').replace(/\{\{\s*name\s*\}\}/gi, r.name.split(' ')[0] || r.name);
        try {
          await this.messages.sendAndStore({
            number,
            phone: r.phone,
            text,
            mediaUrl: campaign.mediaUrl || undefined,
            source: 'campaign',
            campaignId: id,
            contactName: r.name,
          });
          r.status = 'sent';
          r.sentAt = new Date();
          await this.recipients.save(r);
          await this.campaigns.increment({ id }, 'sentCount', 1);
        } catch (e: any) {
          r.status = 'failed';
          r.error = String(e.message || e).slice(0, 500);
          await this.recipients.save(r);
          await this.campaigns.increment({ id }, 'failedCount', 1);
          await this.campaigns.update({ id }, { lastError: r.error });
        }
        // Randomised delay (±30%) to look less robotic
        const base = campaign.delaySeconds * 1000;
        await sleep(base * (0.7 + Math.random() * 0.6));
      }

      const done = await this.campaigns.findOne({ where: { id } });
      if (done?.status === 'running') {
        done.status = done.sentCount === 0 && done.failedCount > 0 ? 'failed' : 'completed';
        done.completedAt = new Date();
        await this.campaigns.save(done);
      }
    } catch (e: any) {
      this.log.error(`Campaign ${id} crashed: ${e.message}`);
      await this.campaigns.update({ id }, { status: 'failed', lastError: String(e.message).slice(0, 500) });
    } finally {
      this.running.delete(id);
    }
  }
}
