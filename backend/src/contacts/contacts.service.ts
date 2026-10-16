import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { In, Repository } from 'typeorm';
import { normalizePhone } from '../common/phone';
import { Contact } from '../entities';

export class ContactDto {
  @IsString() @MinLength(1) name: string;
  @IsString() @MinLength(5) phone: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
}
export class UpdateContactDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(5) phone?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
}
export class ImportDto {
  /** Raw CSV text. Columns: name, phone, tags (semicolon-separated, optional) */
  @IsString() csv: string;
}
export class BulkDeleteDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}

const cleanTags = (t?: string[]) => (t || []).map((x) => x.trim()).filter(Boolean);

@Injectable()
export class ContactsService {
  constructor(@InjectRepository(Contact) private repo: Repository<Contact>) {}

  async list(userId: string, search?: string, tag?: string) {
    let rows = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s));
    }
    if (tag) rows = rows.filter((c) => (c.tags || []).includes(tag));
    return rows;
  }

  async create(userId: string, dto: ContactDto) {
    const phone = normalizePhone(dto.phone);
    if (phone.length < 7) throw new BadRequestException('Invalid phone number');
    if (await this.repo.findOne({ where: { userId, phone } })) throw new ConflictException('Contact already exists');
    return this.repo.save(
      this.repo.create({ userId, name: dto.name.trim(), phone, tags: cleanTags(dto.tags), notes: dto.notes }),
    );
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    const c = await this.repo.findOne({ where: { id, userId } });
    if (!c) throw new NotFoundException();
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.phone !== undefined) c.phone = normalizePhone(dto.phone);
    if (dto.tags !== undefined) c.tags = cleanTags(dto.tags);
    if (dto.notes !== undefined) c.notes = dto.notes;
    return this.repo.save(c);
  }

  async remove(userId: string, id: string) {
    await this.repo.delete({ id, userId });
    return { ok: true };
  }

  async bulkRemove(userId: string, ids: string[]) {
    await this.repo.delete({ userId, id: In(ids) });
    return { ok: true };
  }

  async importCsv(userId: string, csv: string) {
    let records: any[];
    try {
      records = parse(csv, { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
    } catch (e: any) {
      throw new BadRequestException(`Could not parse CSV: ${e.message}`);
    }
    const existing = new Set((await this.repo.find({ where: { userId }, select: ['phone'] })).map((c) => c.phone));
    const toSave: Contact[] = [];
    let skipped = 0;
    for (const r of records) {
      const phone = normalizePhone(r.phone || r.number || r.mobile || '');
      if (phone.length < 7 || existing.has(phone)) {
        skipped++;
        continue;
      }
      existing.add(phone);
      toSave.push(
        this.repo.create({
          userId,
          phone,
          name: (r.name || phone).trim(),
          tags: cleanTags(String(r.tags || '').split(/[;|]/)),
        }),
      );
    }
    if (toSave.length) await this.repo.save(toSave, { chunk: 200 });
    return { created: toSave.length, skipped };
  }
}
