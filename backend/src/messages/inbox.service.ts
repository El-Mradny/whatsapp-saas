import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { normalizePhone } from '../common/phone';
import { AiService } from '../core/ai.service';
import { MessagesService } from '../core/messages.service';
import { Contact, Message, WaNumber } from '../entities';

export class ReplyDto {
  @IsString() numberId: string;
  @IsString() @MinLength(5) chatId: string;
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
}
export class SuggestDto {
  @IsString() numberId: string;
  @IsString() chatId: string;
}

@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(Message) private msgs: Repository<Message>,
    @InjectRepository(WaNumber) private numbers: Repository<WaNumber>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    private messages: MessagesService,
    private ai: AiService,
  ) {}

  private async number(userId: string, id: string) {
    const n = await this.numbers.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Number not found');
    return n;
  }

  /** One row per (number, contact) conversation, newest first. */
  async conversations(userId: string, numberId?: string) {
    const rows = await this.msgs.find({
      where: numberId ? { userId, numberId } : { userId },
      order: { createdAt: 'DESC' },
      take: 2000,
    });
    console.log(rows);
    const map = new Map<string, any>();
    for (const m of rows) {
      const key = `${m.numberId}:${m.chatId}`;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          numberId: m.numberId,
          chatId: m.chatId,
          name: m.contactName || m.chatId,
          lastMessage: m.body,
          lastDirection: m.direction,
          lastAt: m.createdAt,
          unanswered: m.direction === 'in',
        });
      } else if (!cur.name || cur.name === cur.chatId) {
        cur.name = m.contactName || cur.name;
      }
    }
    return [...map.values()];
  }

  async thread(userId: string, numberId: string, chatId: string) {
    await this.number(userId, numberId);
    return this.messages.history(numberId, normalizePhone(chatId), 200);
  }

  async reply(userId: string, dto: ReplyDto) {
    const number = await this.number(userId, dto.numberId);
    const phone = normalizePhone(dto.chatId);
    const contact = await this.contacts.findOne({ where: { userId, phone } });
    return this.messages.sendAndStore({ number, phone, text: dto.text, source: 'manual', contactName: contact?.name });
  }

  /** Draft a reply with AI for the agent to review/edit before sending. */
  async suggest(userId: string, dto: SuggestDto) {
    const number = await this.number(userId, dto.numberId);
    const history = await this.messages.history(number.id, normalizePhone(dto.chatId), 30);
    if (!history.length) throw new BadRequestException('Empty conversation');
    return { text: await this.ai.reply(number, history) };
  }
}
