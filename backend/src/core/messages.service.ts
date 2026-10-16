import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, Message, MessageSource, WaNumber } from '../entities';
import { normalizePhone } from '../common/phone';
import { OpenWaService } from './openwa.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private msgs: Repository<Message>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    @InjectRepository(WaNumber) private numbers: Repository<WaNumber>,
    private openwa: OpenWaService,
  ) {}

  /** Send through OpenWA and persist as an outbound message. */
  async sendAndStore(opts: {
    number: WaNumber;
    phone: string;
    text: string;
    source: MessageSource;
    campaignId?: string;
    contactName?: string;
  }) {
    const phone = normalizePhone(opts.phone);
    if (!phone) throw new BadRequestException('Invalid phone number');
    if (opts.number.status !== 'ready') {
      throw new BadRequestException(`Number "${opts.number.label}" is not connected`);
    }
    const externalId = await this.openwa.sendText(opts.number.sessionId, phone, opts.text);
    return this.msgs.save(
      this.msgs.create({
        userId: opts.number.userId,
        numberId: opts.number.id,
        chatId: phone,
        direction: 'out',
        source: opts.source,
        body: opts.text,
        contactName: opts.contactName,
        externalId,
        campaignId: opts.campaignId,
      }),
    );
  }

  async storeInbound(number: WaNumber, phone: string, body: string, name?: string, externalId?: string) {
    if (externalId && (await this.msgs.findOne({ where: { externalId, numberId: number.id } }))) return null;
    const contact = await this.contacts.findOne({ where: { userId: number.userId, phone } });
    return this.msgs.save(
      this.msgs.create({
        userId: number.userId,
        numberId: number.id,
        chatId: phone,
        direction: 'in',
        source: 'contact',
        body,
        contactName: contact?.name ?? name,
        externalId,
      }),
    );
  }

  async history(numberId: string, chatId: string, limit = 30) {
    const rows = await this.msgs.find({
      where: { numberId, chatId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.reverse();
  }
}
