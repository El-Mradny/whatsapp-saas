const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'wavely.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.location.href = '/login';
    }
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || res.statusText;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};

// ---- Types ----
export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  phone?: string;
  timezone?: string;
  createdAt: string;
}
export type NumberStatus = 'created' | 'initializing' | 'qr_ready' | 'authenticating' | 'ready' | 'disconnected' | 'action_required' | 'failed';
export interface WaNumber {
  id: string;
  label: string;
  phone?: string;
  status: NumberStatus;
  aiEnabled: boolean;
  aiPrompt?: string;
}
export interface Contact {
  id: string;
  name: string;
  phone: string;
  tags?: string[];
  notes?: string;
}
export interface Campaign {
  id: string;
  name: string;
  numberId: string;
  message: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduledAt: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  delaySeconds: number;
  lastError?: string;
  createdAt: string;
}
export interface Recipient {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}
export interface Conversation {
  numberId: string;
  chatId: string;
  name: string;
  lastMessage: string;
  lastDirection: 'in' | 'out';
  lastAt: string;
  unanswered: boolean;
}
export interface Msg {
  id: string;
  direction: 'in' | 'out';
  source: 'manual' | 'campaign' | 'ai' | 'contact';
  body: string;
  createdAt: string;
}
export interface Overview {
  totals: {
    numbers: number;
    connectedNumbers: number;
    contacts: number;
    campaigns: number;
    scheduledCampaigns: number;
    campaignMessagesSent: number;
    campaignMessagesFailed: number;
    deliveryRate: number | null;
    messagesReceivedPeriod: number;
    aiRepliesPeriod: number;
    aiHandledRate: number | null;
  };
  series: { date: string; sent: number; received: number; ai: number }[];
  outboundBySource: { manual: number; campaign: number; ai: number };
  campaignStatus: Record<string, number>;
  topCampaigns: { id: string; name: string; status: string; total: number; sent: number; failed: number }[];
}
