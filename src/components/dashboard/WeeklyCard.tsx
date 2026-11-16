import React from 'react';
import { PhoneCall as PhoneIcon, Briefcase, DollarSign } from 'lucide-react';
import { PhoneCall, Job, ActionRecord, TabType } from '../../types';
import { haptic } from '../../utils/haptics';

interface WeeklyCardProps {
  /** Server-recorded calls (/api/phone/calls, business-scoped) — the
      persistent record. The session-local `calls` list is NOT used here:
      it resets on sign-in, so it would undercount the week. */
  serverCalls: PhoneCall[];
  jobs: Job[];
  actions: ActionRecord[];
  onNavigateTab: (tab: TabType) => void;
}

// Rolling 7-day window, same Date-parsing convention the Morning
// Briefing already uses for call timestamps. A timestamp that does not
// parse (e.g. the "Just now" display string) simply does not count.
function withinDays(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t <= now && now - t <= days * 24 * 3600 * 1000;
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// "After-hours saves" is deliberately NOT a stat here. The business
// record's hours are a free-text string (often missing), and there is no
// call-to-job link in the data, so "a save" cannot be defined honestly.
// It stays out until the record carries structured hours and calls link
// to the jobs they booked — never invented in the meantime.
export const WeeklyCard: React.FC<WeeklyCardProps> = ({ serverCalls, jobs, actions, onNavigateTab }) => {
  const callsAnswered = serverCalls.filter(
    (c) =>
      c.type === 'inbound' &&
      (c.status === 'completed' || c.status === 'transferred') &&
      withinDays(c.timestamp, 7)
  ).length;
  // Jobs carry a booking date only from this build on (createdAt is
  // stamped when a job is created). Older jobs have none and do not
  // count — the figure grows as new jobs are booked, it is never padded.
  const jobsBooked = jobs.filter((j) => withinDays(j.createdAt, 7)).length;
  const earned = actions
    .filter((a) => a.paymentStatus === 'paid' && withinDays(a.paidAt, 7))
    .reduce(
      (sum, a) =>
        sum + (a.paidAmount ?? a.result?.invoiceDetails?.totalAmount ?? a.dollarAmount ?? 0),
      0
    );

  const stats: { label: string; value: string; tab: TabType; icon: React.ReactNode }[] = [
    { label: 'Calls answered', value: String(callsAnswered), tab: 'phone', icon: <PhoneIcon className="w-4 h-4 text-[#22ec72]" /> },
    { label: 'Jobs booked', value: String(jobsBooked), tab: 'jobs', icon: <Briefcase className="w-4 h-4 text-[#22ec72]" /> },
    { label: 'Dollars earned', value: money(earned), tab: 'approvals', icon: <DollarSign className="w-4 h-4 text-[#22ec72]" /> },
  ];
  const allZero = callsAnswered === 0 && jobsBooked === 0 && earned === 0;

  return (
    <div className="rounded-3xl border border-[#22ec72]/25 bg-gradient-to-b from-[#22ec72]/10 to-transparent p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-[#22ec72]/80">This week</div>
        <div className="text-base font-extrabold text-white leading-tight">What your AI team did</div>
        <div className="text-xs text-zinc-500">Last 7 days</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab(s.tab);
            }}
            className="min-h-[48px] rounded-2xl bg-zinc-950/70 border border-zinc-800 px-2 py-3 text-center hover:border-[#22ec72]/40 transition cursor-pointer"
          >
            <span className="flex justify-center mb-1.5">{s.icon}</span>
            <span className="block text-lg font-extrabold text-white leading-none">{s.value}</span>
            <span className="block text-xs text-zinc-400 mt-1 leading-tight">{s.label}</span>
          </button>
        ))}
      </div>
      {allZero && (
        <p className="mt-3 text-xs text-zinc-500 text-center">
          Nothing booked yet this week — your AI team is ready when the phone rings.
        </p>
      )}
    </div>
  );
};
