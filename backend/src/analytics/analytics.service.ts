import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Campaign, Contact, Message, WaNumber } from '../entities';

const dayKey = (d: Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Message) private msgs: Repository<Message>,
    @InjectRepository(Campaign) private campaigns: Repository<Campaign>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    @InjectRepository(WaNumber) private numbers: Repository<WaNumber>,
  ) {}

  async overview(userId: string, days = 14) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [numbers, contactCount, campaigns, recent] = await Promise.all([
      this.numbers.find({ where: { userId } }),
      this.contacts.count({ where: { userId } }),
      this.campaigns.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      this.msgs.find({ where: { userId, createdAt: MoreThanOrEqual(since) } }),
    ]);

    // Per-day series (zero-filled)
    const series = new Map<string, { date: string; sent: number; received: number; ai: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      series.set(dayKey(d), { date: dayKey(d), sent: 0, received: 0, ai: 0 });
    }
    const bySource = { manual: 0, campaign: 0, ai: 0 };
    for (const m of recent) {
      const row = series.get(dayKey(m.createdAt));
      if (!row) continue;
      if (m.direction === 'in') row.received++;
      else {
        row.sent++;
        if (m.source === 'ai') row.ai++;
        if (m.source in bySource) bySource[m.source]++;
      }
    }

    const sent = campaigns.reduce((a, c) => a + c.sentCount, 0);
    const failed = campaigns.reduce((a, c) => a + c.failedCount, 0);
    const received = recent.filter((m) => m.direction === 'in').length;
    const aiReplies = recent.filter((m) => m.source === 'ai').length;

    return {
      totals: {
        numbers: numbers.length,
        connectedNumbers: numbers.filter((n) => n.status === 'ready').length,
        contacts: contactCount,
        campaigns: campaigns.length,
        scheduledCampaigns: campaigns.filter((c) => c.status === 'scheduled').length,
        campaignMessagesSent: sent,
        campaignMessagesFailed: failed,
        deliveryRate: sent + failed ? Math.round((sent / (sent + failed)) * 1000) / 10 : null,
        messagesReceivedPeriod: received,
        aiRepliesPeriod: aiReplies,
        // share of inbound messages that got an AI answer
        aiHandledRate: received ? Math.round((aiReplies / received) * 1000) / 10 : null,
      },
      series: [...series.values()],
      outboundBySource: bySource,
      campaignStatus: campaigns.reduce((acc: Record<string, number>, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {}),
      topCampaigns: campaigns
        .filter((c) => c.totalCount > 0)
        .slice(0, 6)
        .map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          total: c.totalCount,
          sent: c.sentCount,
          failed: c.failedCount,
        })),
    };
  }
}
