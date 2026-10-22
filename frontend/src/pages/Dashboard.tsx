import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, Overview } from '../api';
import { CampaignStatusBadge, Empty, ErrorNote, useLoad } from '../components/ui';
import {useTranslation} from "react-i18next";

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const axis = { fontSize: 12, fill: 'var(--muted)' };
const tipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };

export default function Dashboard() {
  const [days, setDays] = useState(14);
  const { data, error, loading } = useLoad(() => api.get<Overview>(`/analytics/overview?days=${days}`), [days]);
  const total = data?.totals;

  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('dashboard')}</h1>
          <p>How your messaging is performing.</p>
        </div>
        <select style={{ width: 160 }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      <ErrorNote error={error} />

      {loading && !data ? (
        <div className="card"><Empty title="Loading…" /></div>
      ) : data && total ? (
        <>
          {total.numbers === 0 && (
            <div className="notice">
              You haven’t connected a WhatsApp number yet. <Link to="/numbers">Connect one</Link> to start sending.
            </div>
          )}
          <div className="grid cols-4">
            <Stat label="Connected numbers" value={`${total.connectedNumbers}/${total.numbers}`} />
            <Stat label="Contacts" value={total.contacts.toLocaleString()} />
            <Stat label="Campaign delivery" value={pct(total.deliveryRate)} sub={`${total.campaignMessagesSent} sent · ${total.campaignMessagesFailed} failed`} />
            <Stat label="Scheduled campaigns" value={String(total.scheduledCampaigns)} sub={`${total.campaigns} total`} />
            <Stat label="Messages received" value={total.messagesReceivedPeriod.toLocaleString()} sub={`last ${days} days`} />
            <Stat label="AI replies" value={total.aiRepliesPeriod.toLocaleString()} sub={`last ${days} days`} />
            <Stat label="Inbound handled by AI" value={pct(total.aiHandledRate)} />
            <Stat label="Campaign messages (period)" value={data.outboundBySource.campaign.toLocaleString()} sub={`${data.outboundBySource.manual} manual`} />
          </div>

          <div className="card">
            <div className="row spread wrap" style={{ marginBottom: 12 }}>
              <h2>Message volume</h2>
              <div className="legend">
                <span><i style={{ background: 'var(--c1)' }} />Sent</span>
                <span><i style={{ background: 'var(--c2)' }} />Received</span>
                <span><i style={{ background: 'var(--c3)' }} />AI replies</span>
              </div>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} tickFormatter={(d: string) => d.slice(5)} stroke="var(--border)" />
                  <YAxis tick={axis} allowDecimals={false} stroke="var(--border)" />
                  <Tooltip contentStyle={tipStyle} />
                  <Line type="monotone" dataKey="sent" name="Sent" stroke="var(--c1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="received" name="Received" stroke="var(--c2)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ai" name="AI replies" stroke="var(--c3)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Recent campaigns</h2>
            {data.topCampaigns.length === 0 ? (
              <Empty title="No campaigns yet"><Link to="/campaigns">Create one</Link></Empty>
            ) : (
              <>
                <div className="chart-box" style={{ height: 40 + data.topCampaigns.length * 38 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topCampaigns} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={axis} allowDecimals={false} stroke="var(--border)" />
                      <YAxis type="category" dataKey="name" tick={axis} width={120} stroke="var(--border)" />
                      <Tooltip contentStyle={tipStyle} cursor={{ fill: 'var(--bg)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="sent" name="Sent" stackId="a" fill="var(--c1)" />
                      <Bar dataKey="failed" name="Failed" stackId="a" fill="var(--c3)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="row wrap" style={{ marginTop: 10 }}>
                  {data.topCampaigns.map((c) => (
                    <span key={c.id} className="row muted" style={{ gap: 6 }}>{c.name} <CampaignStatusBadge status={c.status as any} /></span>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value mono">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
