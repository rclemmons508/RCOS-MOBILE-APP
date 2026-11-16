import React, { useMemo, useState } from 'react';
import { BarChart3, Briefcase, DollarSign, PhoneCall as PhoneIcon, UserPlus, Users, ChevronRight } from 'lucide-react';
import { ActionRecord, Client, CustomerRequest, Job, PhoneCall, TabType } from '../../types';
import { haptic } from '../../utils/haptics';
import { sidebarCard, sidebarActiveTint, sidebarAccentHex } from '../ui/cards';

interface ReportsTabProps {
  /** Server-recorded calls (/api/phone/calls, business-scoped) — the
      persistent record. The session-local `calls` list is NOT used here:
      it resets on sign-in, so it would undercount the window. */
  serverCalls: PhoneCall[];
  jobs: Job[];
  actions: ActionRecord[];
  clients: Client[];
  customerRequests: CustomerRequest[];
  onNavigateTab: (tab: TabType) => void;
}

type PeriodId = '7d' | '30d' | '90d' | '1y';

const PERIODS: { id: PeriodId; label: string; days: number; buckets: number; mode: 'day' | 'week' | 'month' }[] = [
  { id: '7d', label: '7D', days: 7, buckets: 7, mode: 'day' },
  { id: '30d', label: '30D', days: 30, buckets: 30, mode: 'day' },
  { id: '90d', label: '90D', days: 90, buckets: 13, mode: 'week' },
  { id: '1y', label: '1Y', days: 365, buckets: 12, mode: 'month' },
];

// Same Date-parsing convention the WeeklyCard already uses. A timestamp
// that does not parse (e.g. the "Just now" display string) simply does
// not count — never guessed.
function parseTime(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function withinDays(iso: string | undefined, days: number): boolean {
  const t = parseTime(iso);
  if (t === null) return false;
  const now = Date.now();
  return t <= now && now - t <= days * 24 * 3600 * 1000;
}

// Same paid-amount rule the WeeklyCard and Dashboard already use:
// the amount actually recorded as paid, falling back to the invoice
// total, then the action's dollar amount. Never invented.
function paidAmount(a: ActionRecord): number {
  return a.paidAmount ?? a.result?.invoiceDetails?.totalAmount ?? a.dollarAmount ?? 0;
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// Bucket boundaries for the revenue chart, oldest first. Day mode: one
// bucket per day. Week mode: 13 buckets of 7 days. Month mode: 12
// calendar months.
function bucketStarts(period: (typeof PERIODS)[number]): Date[] {
  const now = new Date();
  if (period.mode === 'day') {
    const starts: Date[] = [];
    for (let i = period.buckets - 1; i >= 0; i--) {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      starts.push(d);
    }
    return starts;
  }
  if (period.mode === 'week') {
    const starts: Date[] = [];
    const first = startOfDay(now);
    first.setDate(first.getDate() - (period.buckets - 1) * 7);
    for (let i = 0; i < period.buckets; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() + i * 7);
      starts.push(d);
    }
    return starts;
  }
  const starts: Date[] = [];
  for (let i = period.buckets - 1; i >= 0; i--) {
    starts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return starts;
}

/**
 * Reports — "Track your growth", from the sidebar-design reference.
 *
 * Every number comes from the real records the app already holds:
 * revenue is invoices actually paid in the window, jobs are jobs booked
 * in the window, leads are customer requests created in the window, and
 * the answer rate is answered inbound calls over all inbound calls in
 * the window. There are no delta percentages anywhere — no
 * prior-period baseline exists — and no targets or forecasts.
 *
 * Two honest limits, stated on screen where they matter: the Client
 * record carries no creation date, so "new customers in the window"
 * cannot be computed — the screen shows Total Customers as an
 * all-time figure instead. Jobs booked before dates were recorded
 * have no createdAt and do not count toward period totals.
 */
export const ReportsTab: React.FC<ReportsTabProps> = ({
  serverCalls,
  jobs,
  actions,
  clients,
  customerRequests,
  onNavigateTab,
}) => {
  const [periodId, setPeriodId] = useState<PeriodId>('7d');
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[0];

  const stats = useMemo(() => {
    const paidInWindow = actions.filter(
      (a) => a.paymentStatus === 'paid' && withinDays(a.paidAt, period.days)
    );
    const revenue = paidInWindow.reduce((sum, a) => sum + paidAmount(a), 0);
    const jobsBooked = jobs.filter((j) => withinDays(j.createdAt, period.days)).length;
    const newLeads = customerRequests.filter((r) => withinDays(r.createdAt, period.days)).length;
    const inboundInWindow = serverCalls.filter(
      (c) => (c.type === 'inbound' || c.type === 'missed') && withinDays(c.timestamp, period.days)
    );
    const answeredInWindow = serverCalls.filter(
      (c) =>
        c.type === 'inbound' &&
        (c.status === 'completed' || c.status === 'transferred') &&
        withinDays(c.timestamp, period.days)
    ).length;
    const answerRate =
      inboundInWindow.length > 0 ? Math.round((answeredInWindow / inboundInWindow.length) * 100) : null;
    const avgInvoice =
      paidInWindow.length > 0 ? Math.round(revenue / paidInWindow.length) : null;

    // Revenue chart: paid amounts bucketed across the window.
    const starts = bucketStarts(period);
    const buckets = starts.map(() => 0);
    for (const a of paidInWindow) {
      const t = parseTime(a.paidAt);
      if (t === null) continue;
      for (let i = 0; i < starts.length; i++) {
        const start = starts[i].getTime();
        const end =
          i + 1 < starts.length
            ? starts[i + 1].getTime()
            : period.mode === 'month'
              ? new Date(starts[i].getFullYear(), starts[i].getMonth() + 1, 1).getTime()
              : start + (period.mode === 'week' ? 7 : 1) * 24 * 3600 * 1000;
        if (t >= start && t < end) {
          buckets[i] += paidAmount(a);
          break;
        }
      }
    }

    // All-time totals (labelled as such — they are not window figures).
    const totalRevenue = actions
      .filter((a) => a.paymentStatus === 'paid')
      .reduce((sum, a) => sum + paidAmount(a), 0);

    return {
      revenue,
      jobsBooked,
      newLeads,
      answerRate,
      avgInvoice,
      buckets,
      bucketStarts: starts,
      totalRevenue,
      totalJobs: jobs.length,
      totalCustomers: clients.length,
      inboundCount: inboundInWindow.length,
    };
  }, [actions, jobs, serverCalls, clients, customerRequests, period]);

  const periodLabel =
    period.id === '7d'
      ? 'Last 7 days'
      : period.id === '30d'
        ? 'Last 30 days'
        : period.id === '90d'
          ? 'Last 90 days'
          : 'Last 12 months';

  // --- Revenue chart geometry (plain SVG, no chart library) ---
  const chartW = 320;
  const chartH = 110;
  const maxBucket = Math.max(...stats.buckets, 0);
  const points = stats.buckets.map((v, i) => {
    const x = stats.buckets.length === 1 ? chartW / 2 : (i / (stats.buckets.length - 1)) * chartW;
    const y = maxBucket > 0 ? chartH - (v / maxBucket) * (chartH - 12) - 4 : chartH - 4;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${chartW},${chartH} L0,${chartH} Z`;
  const firstLabel = shortDate(stats.bucketStarts[0]);
  const lastStart = stats.bucketStarts[stats.bucketStarts.length - 1];
  const lastLabel =
    period.mode === 'month'
      ? lastStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : shortDate(lastStart);

  const allZero =
    stats.revenue === 0 && stats.jobsBooked === 0 && stats.newLeads === 0 && stats.inboundCount === 0;

  const go = (tab: TabType) => {
    haptic.light();
    onNavigateTab(tab);
  };

  const tiles: {
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    tab: TabType;
  }[] = [
    {
      label: 'Total Jobs',
      value: String(stats.jobsBooked),
      sub: periodLabel,
      icon: <Briefcase className="w-4 h-4" />,
      tab: 'jobs',
    },
    {
      label: 'New Leads',
      value: String(stats.newLeads),
      sub: periodLabel,
      icon: <UserPlus className="w-4 h-4" />,
      tab: 'requests',
    },
    {
      label: 'Avg. invoice value',
      value: stats.avgInvoice === null ? '—' : money(stats.avgInvoice),
      sub: stats.avgInvoice === null ? 'No paid invoices' : 'Paid invoices',
      icon: <DollarSign className="w-4 h-4" />,
      tab: 'approvals',
    },
    {
      label: 'Call Answer Rate',
      value: stats.answerRate === null ? '—' : `${stats.answerRate}%`,
      sub: stats.answerRate === null ? 'No inbound calls' : `${stats.inboundCount} inbound call${stats.inboundCount === 1 ? '' : 's'}`,
      icon: <PhoneIcon className="w-4 h-4" />,
      tab: 'phone',
    },
  ];

  return (
    <div className="space-y-4 pb-8 px-3.5 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Header — as in the reference: Reports / Track your growth. */}
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Track your growth</p>
      </div>

      {/* Period pills */}
      <div className="flex gap-1.5 px-1">
        {PERIODS.map((p) => {
          const active = p.id === periodId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                haptic.light();
                setPeriodId(p.id);
              }}
              aria-pressed={active}
              className={`px-3.5 py-2 rounded-full text-xs font-bold border transition cursor-pointer min-h-[36px] ${
                active ? sidebarActiveTint : 'bg-[#0c1211] text-zinc-400 border-[#1d2b26] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Revenue card + chart */}
      <div className={`p-3.5 ${sidebarCard}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-zinc-400">Revenue</div>
            <div className="text-2xl font-extrabold text-white leading-tight">{money(stats.revenue)}</div>
            <div className="text-xs text-zinc-500">{periodLabel} · invoices actually paid</div>
          </div>
          <span className="p-2 rounded-xl bg-[#22ec72]/10 text-[#22ec72] shrink-0">
            <BarChart3 className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-3">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-[110px]"
            role="img"
            aria-label={`Revenue chart, ${periodLabel}, total ${money(stats.revenue)}`}
            preserveAspectRatio="none"
          >
            <line x1="0" y1={chartH - 4} x2={chartW} y2={chartH - 4} stroke="#1d2b26" strokeWidth="1" />
            <line x1="0" y1={(chartH - 4) / 2} x2={chartW} y2={(chartH - 4) / 2} stroke="#1d2b26" strokeWidth="0.5" strokeDasharray="3 3" />
            <path d={areaPath} fill={sidebarAccentHex} fillOpacity="0.08" />
            <path d={linePath} fill="none" stroke={sidebarAccentHex} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={sidebarAccentHex} />
            ))}
          </svg>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
            <span>{firstLabel}</span>
            <span>{maxBucket > 0 ? `Peak ${money(maxBucket)}` : 'No paid revenue in this period'}</span>
            <span>{lastLabel}</span>
          </div>
        </div>
      </div>

      {/* Stat tiles — 2x2, each one tap to the screen that owns the number. */}
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => go(t.tab)}
            className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left min-h-[96px] flex flex-col justify-between gap-1"
          >
            <span className="p-1.5 rounded-lg bg-[#22ec72]/10 text-[#22ec72] self-start">{t.icon}</span>
            <span className="text-2xl font-extrabold text-white leading-none">{t.value}</span>
            <span className="text-xs font-bold text-zinc-400">{t.label}</span>
            <span className="text-xs text-zinc-500">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* All-time totals — labelled as all-time, not window figures. The
          Client record carries no creation date, so "new customers in
          the window" cannot be computed honestly; Total Customers is
          the all-time count instead. */}
      <div className={`p-3.5 ${sidebarCard}`}>
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">All time</div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button
            type="button"
            onClick={() => go('clients')}
            className="min-h-[48px] rounded-xl bg-[#05090a]/60 border border-[#1d2b26] px-2 py-3 text-center hover:border-[#22ec72]/40 transition cursor-pointer"
          >
            <span className="flex justify-center mb-1 text-[#22ec72]">
              <Users className="w-4 h-4" />
            </span>
            <span className="block text-lg font-extrabold text-white leading-none">{stats.totalCustomers}</span>
            <span className="block text-xs text-zinc-400 mt-1">Total Customers</span>
          </button>
          <button
            type="button"
            onClick={() => go('jobs')}
            className="min-h-[48px] rounded-xl bg-[#05090a]/60 border border-[#1d2b26] px-2 py-3 text-center hover:border-[#22ec72]/40 transition cursor-pointer"
          >
            <span className="flex justify-center mb-1 text-[#22ec72]">
              <Briefcase className="w-4 h-4" />
            </span>
            <span className="block text-lg font-extrabold text-white leading-none">{stats.totalJobs}</span>
            <span className="block text-xs text-zinc-400 mt-1">Total Jobs</span>
          </button>
          <button
            type="button"
            onClick={() => go('approvals')}
            className="min-h-[48px] rounded-xl bg-[#05090a]/60 border border-[#1d2b26] px-2 py-3 text-center hover:border-[#22ec72]/40 transition cursor-pointer"
          >
            <span className="flex justify-center mb-1 text-[#22ec72]">
              <DollarSign className="w-4 h-4" />
            </span>
            <span className="block text-lg font-extrabold text-white leading-none">{money(stats.totalRevenue)}</span>
            <span className="block text-xs text-zinc-400 mt-1">Total Revenue</span>
          </button>
        </div>
      </div>

      {allZero && (
        <p className="text-xs text-zinc-500 text-center px-4">
          Nothing in this period yet — as calls come in, jobs get booked, and invoices get paid, the numbers show up here.
        </p>
      )}

      <p className="text-xs text-zinc-600 text-center px-4">
        Period totals count only records with a date — jobs booked before dates were recorded aren&apos;t included.
      </p>

      <button
        type="button"
        onClick={() => go('approvals')}
        className="min-h-[48px] w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left"
      >
        <span className="text-sm font-bold text-white">See invoices &amp; money loop</span>
        <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
      </button>
    </div>
  );
};
