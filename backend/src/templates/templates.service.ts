import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Template, TemplateButton, TemplateCategory, TemplateHeaderType } from '../entities';

export class CreateTemplateDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() category?: TemplateCategory;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() headerType?: TemplateHeaderType;
  @IsOptional() @IsString() headerContent?: string;
  @IsString() @MinLength(1) @MaxLength(4000) body: string;
  @IsOptional() @IsString() @MaxLength(500) footer?: string;
  @IsOptional() @IsArray() buttons?: TemplateButton[];
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() category?: TemplateCategory;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() headerType?: TemplateHeaderType;
  @IsOptional() @IsString() headerContent?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) body?: string;
  @IsOptional() @IsString() @MaxLength(500) footer?: string;
  @IsOptional() @IsArray() buttons?: TemplateButton[];
}

const DEFAULT_STARTER_TEMPLATES: Omit<CreateTemplateDto, 'name'>[] = [
  {
    category: 'MARKETING',
    language: 'en',
    headerType: 'text',
    headerContent: 'Welcome to our Family! 🎉',
    body: 'Hi *{{name}}* 👋,\n\nThank you for reaching out to us! We are thrilled to connect with you.\n\nHow can we best help you today?',
    footer: 'Wavely WhatsApp Support • We reply fast',
    buttons: [
      { type: 'quick_reply', text: 'Explore Services 🔍' },
      { type: 'quick_reply', text: 'Chat with Agent 💬' },
    ],
  },
  {
    category: 'MARKETING',
    language: 'en',
    headerType: 'text',
    headerContent: 'Exclusive 25% Off Deal! 🎁',
    body: 'Hello *{{name}}*! 🌟\n\nFor a limited time, enjoy *25% OFF* your next order with coupon code *SAVE25*.\n\nDon’t miss out on our best deals of the season!',
    footer: 'Valid this week only • Terms apply',
    buttons: [
      { type: 'url', text: 'Claim Discount 🏷️', value: 'https://example.com/promo' },
      { type: 'quick_reply', text: 'Ask a Question ❓' },
    ],
  },
  {
    category: 'UTILITY',
    language: 'en',
    headerType: 'text',
    headerContent: 'Appointment Reminder 📅',
    body: 'Hi *{{name}}*,\n\nThis is a friendly reminder regarding your upcoming appointment scheduled for *tomorrow*.\n\nPlease let us know if you need to reschedule.',
    footer: 'Reply YES to confirm or RESCHEDULE',
    buttons: [
      { type: 'quick_reply', text: 'Confirm Attendance ✅' },
      { type: 'quick_reply', text: 'Need to Reschedule 🔄' },
    ],
  },
];

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template) private templates: Repository<Template>,
  ) {}

  async list(userId: string): Promise<Template[]> {
    let rows = await this.templates.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Auto-seed starter templates on first view if user has none
    if (rows.length === 0) {
      const seeded = DEFAULT_STARTER_TEMPLATES.map((item, idx) =>
        this.templates.create({
          userId,
          name: idx === 0 ? 'Welcome Lead' : idx === 1 ? 'Special Offer Promo' : 'Appointment Reminder',
          category: item.category,
          language: item.language,
          headerType: item.headerType,
          headerContent: item.headerContent,
          body: item.body,
          footer: item.footer,
          buttons: item.buttons,
        }),
      );
      rows = await this.templates.save(seeded);
    }

    return rows;
  }

  async get(userId: string, id: string): Promise<Template> {
    const t = await this.templates.findOne({ where: { id, userId } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async create(userId: string, dto: CreateTemplateDto): Promise<Template> {
    const existing = await this.templates.findOne({ where: { userId, name: dto.name.trim() } });
    if (existing) {
      throw new BadRequestException(`Template with name "${dto.name}" already exists`);
    }

    const t = this.templates.create({
      userId,
      name: dto.name.trim(),
      category: dto.category || 'MARKETING',
      language: dto.language || 'en',
      headerType: dto.headerType || 'none',
      headerContent: dto.headerContent?.trim() || null,
      body: dto.body.trim(),
      footer: dto.footer?.trim() || null,
      buttons: dto.buttons || [],
    });

    return this.templates.save(t);
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto): Promise<Template> {
    const t = await this.get(userId, id);

    if (dto.name && dto.name.trim() !== t.name) {
      const existing = await this.templates.findOne({ where: { userId, name: dto.name.trim() } });
      if (existing) {
        throw new BadRequestException(`Template with name "${dto.name}" already exists`);
      }
      t.name = dto.name.trim();
    }

    if (dto.category) t.category = dto.category;
    if (dto.language) t.language = dto.language;
    if (dto.headerType !== undefined) t.headerType = dto.headerType;
    if (dto.headerContent !== undefined) t.headerContent = dto.headerContent?.trim() || null;
    if (dto.body !== undefined) t.body = dto.body.trim();
    if (dto.footer !== undefined) t.footer = dto.footer?.trim() || null;
    if (dto.buttons !== undefined) t.buttons = dto.buttons;

    return this.templates.save(t);
  }

  async remove(userId: string, id: string): Promise<{ ok: boolean }> {
    const t = await this.get(userId, id);
    await this.templates.delete(t.id);
    return { ok: true };
  }
}
