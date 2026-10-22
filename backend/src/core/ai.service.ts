import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Message, WaNumber } from '../entities';

const DEFAULT_PROMPT =
  'You are a friendly, concise customer-support assistant replying on WhatsApp on behalf of a business. ' +
  'Keep answers short (1-3 sentences), plain text, no markdown. Reply in the same language as the customer. ' +
  "If you don't know something or the customer asks for a human, say a team member will follow up shortly.";

@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);

  get configured() {
    return !!process.env.AI_API_KEY;
  }

  /** Build a reply for the latest customer message, given recent history (oldest first). */
  async reply(number: WaNumber, history: Message[]): Promise<string> {
    if (!this.configured) throw new ServiceUnavailableException('AI_API_KEY is not configured');
    const system = number.aiPrompt?.trim() || DEFAULT_PROMPT;
    const turns = history.slice(-12).map((m) => ({
      role: m.direction === 'in' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    }));
    // Providers require the conversation to start with a user turn.
    while (turns.length && turns[0].role !== 'user') turns.shift();
    if (!turns.length) throw new ServiceUnavailableException('No customer message to reply to');

    const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
    const model = process.env.AI_MODEL || 'claude-sonnet-5-5';
    const text = provider === 'openai' ? await this.openai(model, system, turns) : await this.anthropic(model, system, turns);
    return text.trim();
  }

  private async anthropic(model: string, system: string, messages: any[]) {
    // Merge consecutive same-role turns (Anthropic API requires alternation)
    const merged: any[] = [];
    for (const m of messages) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) last.content += '\n' + m.content;
      else merged.push({ ...m });
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.AI_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 400, system, messages: merged }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }

  private async openai(model: string, system: string, messages: any[]) {
    const base = (process.env.AI_BASE_URL).replace(/\/$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: 'system', content: system }, ...messages] }),
    });
    if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

}
