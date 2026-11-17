import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ActionRecord,
  AgentInboxMessage,
  CustomerRequest,
  Job,
  PhoneCall,
  RCOSNotification,
  TabType,
  TeamMessage,
  VoicemailRecord,
} from '../types';
import { teamService } from '../services/teamService';
import { apiFetch } from '../lib/api';
import { withBusinessId, filterToBusiness } from '../lib/businessScope';
import { normalizePhone } from '../utils/followups';
import { haptic } from '../utils/haptics';
import { WeeklyCard } from './dashboard/WeeklyCard';
import { AgentInboxMessageCard } from './AgentInboxMessageCard';

/**
 * Operations — the ONE merged inbox (sidebar design Stage 2).
 *
 * The three overlapping inboxes are one feed now: the old InboxView tab,
 * the Agent Inbox modal, and the Notification Center modal. The modals
 * are retired — their content lives here, inline, with the same actions
 * (reply / snooze / dismiss on AI Team messages, follow-up Send now /
 * Edit / Dismiss, Mark All Read / Clear on alerts). Header buttons and
 * Dashboard cards open this feed at the right section instead of a
 * pop-up. Nothing here invents rows: every row comes from a store the
 * app already loads.
 *
 * Sections, in the approved One Inbox order: Needs you now, AI Team,
 * Customers, Team, Email, Alerts. One badge lives on the bottom-nav
 * Operations item (computed in App.tsx) — no other badge counts these
 * same items.
 *
 * Pill filters (All / Calls / Leads) filter the feed rows themselves.
 * Counts are the rows actually shown. The Team preview and Email rows
 * are navigation, not items, so they only show under All.
 */

interface InboxViewProps {
  agentMessages: AgentInboxMessage[];
  notifications: RCOSNotification[];
  customerRequests: CustomerRequest[];
  actions: ActionRecord[];
  jobs: Job[];
  serverCalls: PhoneCall[];
  businessId: string;
  currentUserEmail: string;
  /** Unread Team Chat messages, from main's team read marker. */
  teamUnreadCount?: number;
  /** Section to scroll to when the feed opens from a shortcut. */
  sectionTarget?: string | null;
  onSectionTargetConsumed: () => void;
  onNavigateTab: (tab: TabType) => void;
  onRespond: (msg: AgentInboxMessage, action: 'answered' | 'dismissed' | 'snoozed', text?: string) => void;
  onMarkRead: (msg: AgentInboxMessage) => void;
  onMarkNotifRead: (id: string) => void;
  onMarkAllNotifsRead: () => void;
  onClearNotifs: () => void;
  onOpenNotifPrefs: () => void;
  onTriggerTestPush: () => void;
  onOpenRequest: (id: string) => void;
  onOpenVoicemail: () => void;
}

type FeedFilter = 'all' | 'calls' | 'leads';
type RowTag = 'call' | 'lead' | 'other';

type InboxRow = {
  key: string;
  title: string;
  body: string;
  tag?: string;
  tagTone?: 'red' | 'lime' | 'zinc';
  time?: string;
  /** Which pill filter this row belongs to. */
  filter: RowTag;
  onTap: () => void;
};

function timeOf(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  // Unparseable stamps (e.g. "Just now" on a fresh push) sort as newest.
  return Number.isNaN(t) ? Date.now() : t;
}

function timeAgo(iso?: string): string {
  const t = timeOf(iso);
  if (!t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function snippet(text: string, max = 100): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function newestFirst<T>(items: T[], stamp: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => timeOf(stamp(b)) - timeOf(stamp(a)));
}

function withinDays(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t <= now && now - t <= days * 24 * 3600 * 1000;
}

/** Day string for a call timestamp (YYYY-MM-DD), same convention as the
 *  missed-call follow-up dedupe key in App.tsx. Unparseable stamps fall
 *  back to today so the key still matches a draft fired today. */
function dayOf(iso: string | undefined): string {
  const parsed = new Date(iso || '');
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Same response window the Requests screen uses: 8h urgent, 24h otherwise. */
function isRequestOverdue(req: CustomerRequest): boolean {
  const urgent = req.urgency === 'urgent' || req.urgency === 'emergency';
  const limitMs = urgent ? 8 * 3600 * 1000 : 24 * 3600 * 1000;
  return Date.now() - timeOf(req.createdAt) > limitMs;
}

const AGENT_LABEL: Record<string, string> = {
  sales: 'Sales',
  operations: 'Operations',
  marketing: 'Marketing',
  support: 'Support',
  receptionist: 'Receptionist',
  system: 'System',
};

const KIND_LABEL: Record<string, string> = {
  alert: 'Alert',
  suggestion: 'Suggestion',
  question: 'Question',
};

/** Which pill a message belongs to, from its dedupe key. */
function messageTag(m: AgentInboxMessage): RowTag {
  const k = m.dedupeKey || '';
  if (k.startsWith('followup:missed:') || k.startsWith('mainai:missed_call:')) return 'call';
  if (k.startsWith('mainai:new_request:') || k.startsWith('followup:welcome:')) return 'lead';
  return 'other';
}

/** Where a notification's "open" action goes — same mapping the old
 *  Notification Center modal used. */
function notifTab(n: RCOSNotification): TabType {
  if (n.module === 'Jobs Dispatcher') return 'jobs';
  if (n.module === 'Phone System') return 'phone';
  if (n.module === 'CRM') return 'clients';
  return 'dashboard';
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="px-3.5 sm:px-4 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#22ec72]">{icon}</span>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#22ec72]/15 text-[#22ec72] border border-[#22ec72]/30 text-xs font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] divide-y divide-[#1d2b26]/60 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Row({ row }: { row: InboxRow }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.light();
        row.onTap();
      }}
      className="w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-[#05090a]/60 transition-colors cursor-pointer min-h-[44px]"
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-white truncate">{row.title}</span>
          {row.tag && (
            <span
              className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full border ${
                row.tagTone === 'red'
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : row.tagTone === 'lime'
                    ? 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {row.tag}
            </span>
          )}
        </span>
        {row.body && <span className="block text-xs text-zinc-400 truncate mt-0.5">{row.body}</span>}
        {row.time && (
          <span className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
            <Clock className="w-3 h-3" />
            {row.time}
          </span>
        )}
      </span>
      <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
    </button>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-3.5 py-3 text-xs text-zinc-500">{text}</p>;
}

export const InboxView: React.FC<InboxViewProps> = ({
  agentMessages,
  notifications,
  customerRequests,
  actions,
  jobs,
  serverCalls,
  businessId,
  currentUserEmail,
  teamUnreadCount = 0,
  sectionTarget,
  onSectionTargetConsumed,
  onNavigateTab,
  onRespond,
  onMarkRead,
  onMarkNotifRead,
  onMarkAllNotifsRead,
  onClearNotifs,
  onOpenNotifPrefs,
  onTriggerTestPush,
  onOpenRequest,
  onOpenVoicemail,
}) => {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamFailed, setTeamFailed] = useState(false);
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Opening the feed marks AI Team messages read — the same rule the
  // old Agent Inbox modal had (it marked unread read on open). The
  // Operations badge drops once the feed has been opened; responding
  // or dismissing still moves a message to Handled.
  useEffect(() => {
    agentMessages.filter((m) => m.status === 'unread').forEach(onMarkRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A shortcut (header bell / inbox button) opens the feed at a section.
  // The filter resets to All first so the section is actually visible.
  useEffect(() => {
    if (!sectionTarget) return;
    setFilter('all');
    const t = window.setTimeout(() => {
      sectionRefs.current[sectionTarget]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSectionTargetConsumed();
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTarget]);

  const jumpToSection = useCallback((id: string) => {
    setFilter('all');
    window.setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  // Read-only loads from the same endpoints the existing screens already use.
  // A failed load leaves that section empty — it never invents rows.
  useEffect(() => {
    if (!businessId || !currentUserEmail) return;
    let cancelled = false;
    teamService
      .getTeamMessages(businessId, currentUserEmail)
      .then((msgs) => {
        if (!cancelled) setTeamMessages(Array.isArray(msgs) ? msgs : []);
      })
      .catch(() => {
        if (!cancelled) setTeamFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, currentUserEmail]);

  useEffect(() => {
    let cancelled = false;
    // Scoped to this business; records naming another business are dropped.
    apiFetch<VoicemailRecord[]>(withBusinessId('/api/phone/voicemails', businessId))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setVoicemails(filterToBusiness(data, businessId));
      })
      .catch(() => {
        // Voicemails stay out of the list; requests still show. Never faked.
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  // --- Dedupe sets so one record never surfaces twice. ---
  // A quote with a main-AI "quote waiting" alert already shows in AI
  // Team; the Needs row only covers quotes with no alert yet.
  const alertedQuoteIds = useMemo(
    () =>
      new Set(
        agentMessages
          .filter((m) => (m.dedupeKey || '').startsWith('mainai:quote_waiting:'))
          .map((m) => (m.dedupeKey || '').slice('mainai:quote_waiting:'.length))
      ),
    [agentMessages]
  );
  // A missed call with a follow-up draft (or a main-AI missed-call
  // alert) already shows in AI Team / Needs; the raw call row only
  // covers real missed calls with neither yet.
  const followupMissedKeys = useMemo(
    () =>
      new Set(
        agentMessages
          .filter((m) => (m.dedupeKey || '').startsWith('followup:missed:'))
          .map((m) => (m.dedupeKey || '').slice('followup:missed:'.length))
      ),
    [agentMessages]
  );
  const alertedMissedCallIds = useMemo(
    () =>
      new Set(
        agentMessages
          .filter((m) => (m.dedupeKey || '').startsWith('mainai:missed_call:'))
          .map((m) => (m.dedupeKey || '').slice('mainai:missed_call:'.length))
      ),
    [agentMessages]
  );

  const needsRows = useMemo<InboxRow[]>(() => {
    const rows: { row: InboxRow; time: number }[] = [];
    notifications
      .filter((n) => n.type === 'emergency_dispatch' && !n.read)
      .forEach((n) => {
        rows.push({
          time: timeOf(n.timestamp),
          row: {
            key: `emergency-${n.id}`,
            title: n.title,
            body: snippet(n.message),
            tag: 'Emergency',
            tagTone: 'red',
            filter: 'other',
            time: timeAgo(n.timestamp),
            onTap: () => jumpToSection('alerts'),
          },
        });
      });
    customerRequests
      .filter((r) => (r.status === 'pending' || r.status === 'in_progress') && isRequestOverdue(r))
      .forEach((r) => {
        rows.push({
          time: timeOf(r.createdAt),
          row: {
            key: `overdue-${r.id}`,
            title: `${r.customerName} — request overdue`,
            body: snippet(r.description),
            tag: 'Request overdue',
            tagTone: 'red',
            filter: 'lead',
            time: timeAgo(r.createdAt),
            onTap: () => onOpenRequest(r.id),
          },
        });
      });
    agentMessages
      .filter(
        (m) =>
          m.dedupeKey?.startsWith('followup:missed:') && (m.status === 'unread' || m.status === 'read')
      )
      .forEach((m) => {
        rows.push({
          time: timeOf(m.createdAt),
          row: {
            key: `followup-${m.id}`,
            title: m.title,
            body: snippet(m.body),
            tag: 'Follow-up waiting',
            tagTone: 'lime',
            filter: 'call',
            time: timeAgo(m.createdAt),
            onTap: () => jumpToSection('ai-team'),
          },
        });
      });
    // Quotes waiting for approval — the decision that is owed. Only
    // quotes with no main-AI alert yet; alerted ones live in AI Team.
    actions
      .filter(
        (a) =>
          a.status === 'awaiting_approval' && a.result?.quoteDetails && !alertedQuoteIds.has(a.id)
      )
      .forEach((a) => {
        const q = a.result!.quoteDetails!;
        rows.push({
          time: timeOf(a.updatedAt || a.createdAt),
          row: {
            key: `quote-${a.id}`,
            title: `Quote waiting: ${q.clientName} — ${money(q.totalAmount)}`,
            body: 'Waiting for your approval.',
            tag: 'Quote pending',
            tagTone: 'lime',
            filter: 'other',
            time: timeAgo(a.updatedAt || a.createdAt),
            onTap: () => onNavigateTab('approvals'),
          },
        });
      });
    // Real missed calls with no follow-up draft and no alert yet —
    // last 7 days only, so old calls never linger as fake urgency.
    // Only real carrier calls count (isRealPstnCall must be true).
    serverCalls
      .filter(
        (c) =>
          c.isRealPstnCall === true &&
          (c.type === 'missed' || c.status === 'missed') &&
          c.callerNumber &&
          withinDays(c.timestamp, 7) &&
          !followupMissedKeys.has(`${normalizePhone(c.callerNumber)}:${dayOf(c.timestamp)}`) &&
          !alertedMissedCallIds.has(c.id)
      )
      .forEach((c) => {
        rows.push({
          time: timeOf(c.timestamp),
          row: {
            key: `missed-${c.id}`,
            title: `Missed call from ${c.callerName || c.callerNumber}`,
            body: snippet(c.summary || 'No follow-up sent yet — tap to call back.'),
            tag: 'Missed call',
            tagTone: 'red',
            filter: 'call',
            time: timeAgo(c.timestamp),
            onTap: () => onNavigateTab('phone'),
          },
        });
      });
    return rows
      .sort((a, b) => b.time - a.time)
      .slice(0, 10)
      .map((r) => r.row);
  }, [notifications, customerRequests, agentMessages, actions, serverCalls, alertedQuoteIds, followupMissedKeys, alertedMissedCallIds, onNavigateTab, onOpenRequest, jumpToSection]);

  const activeAiMessages = useMemo(
    () =>
      newestFirst(
        agentMessages.filter((m) => m.status === 'unread' || m.status === 'read' || m.status === 'snoozed'),
        (m) => m.createdAt
      ).slice(0, 10),
    [agentMessages]
  );
  const handledAiMessages = useMemo(
    () =>
      newestFirst(
        agentMessages.filter((m) => m.status === 'answered' || m.status === 'dismissed'),
        (m) => m.createdAt
      ).slice(0, 5),
    [agentMessages]
  );

  const openRequests = useMemo(
    () =>
      newestFirst(
        customerRequests.filter((r) => r.status === 'pending' || r.status === 'in_progress'),
        (r) => r.createdAt
      ).slice(0, 10),
    [customerRequests]
  );

  const openVoicemails = useMemo(
    () => newestFirst(voicemails.filter((v) => !v.reviewed), (v) => v.timestamp).slice(0, 10),
    [voicemails]
  );

  // Jobs scheduled — unfinished jobs, newest first. These are today's
  // work, not things needing a decision; they show under Customers and
  // do not by themselves keep the feed from saying "all caught up".
  const scheduledJobs = useMemo(
    () => jobs.filter((j) => j.status !== 'completed').slice(0, 5),
    [jobs]
  );

  const latestTeam = teamMessages.length > 0 ? teamMessages[teamMessages.length - 1] : null;

  const alertRows = useMemo<InboxRow[]>(
    () =>
      newestFirst(notifications, (n) => n.timestamp)
        .slice(0, 10)
        .map((n) => ({
          key: n.id,
          title: n.title,
          body: snippet(n.message),
          tag: n.read ? undefined : 'Unread',
          tagTone: 'lime' as const,
          filter: (n.type === 'call_event' ? 'call' : 'other') as RowTag,
          time: timeAgo(n.timestamp),
          onTap: () => {
            onMarkNotifRead(n.id);
            onNavigateTab(notifTab(n));
          },
        })),
    [notifications, onMarkNotifRead, onNavigateTab]
  );

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  // --- Pill counts: the rows actually shown, per filter. ---
  const filterOf = (rows: InboxRow[], tag: RowTag) => rows.filter((r) => r.filter === tag).length;
  const allCount =
    needsRows.length +
    activeAiMessages.length +
    openRequests.length +
    openVoicemails.length +
    scheduledJobs.length +
    alertRows.length;
  const callsCount =
    filterOf(needsRows, 'call') +
    activeAiMessages.filter((m) => messageTag(m) === 'call').length +
    openVoicemails.length +
    filterOf(alertRows, 'call');
  const leadsCount =
    filterOf(needsRows, 'lead') +
    activeAiMessages.filter((m) => messageTag(m) === 'lead').length +
    openRequests.length;

  // Pill filter → row tag. Pills say "Calls"/"Leads"; rows are tagged
  // 'call'/'lead'. Team/Email are navigation, not items, so they only
  // show under All.
  const activeTag: RowTag | null = filter === 'calls' ? 'call' : filter === 'leads' ? 'lead' : null;
  const visibleNeeds = activeTag ? needsRows.filter((r) => r.filter === activeTag) : needsRows;
  const visibleAi =
    activeTag ? activeAiMessages.filter((m) => messageTag(m) === activeTag) : activeAiMessages;
  const visibleRequests = filter === 'all' ? openRequests : filter === 'leads' ? openRequests : [];
  const visibleVoicemails = filter === 'all' ? openVoicemails : filter === 'calls' ? openVoicemails : [];
  const visibleJobs = filter === 'all' ? scheduledJobs : [];
  const visibleAlerts = activeTag ? alertRows.filter((r) => r.filter === activeTag) : alertRows;

  // Attention items only — scheduled jobs are today's work, not
  // something owed, so they never block the "all caught up" state.
  const attentionCount =
    needsRows.length +
    activeAiMessages.length +
    openRequests.length +
    openVoicemails.length +
    alertRows.length +
    (latestTeam || teamFailed ? 1 : 0);

  const pill = (id: FeedFilter, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        haptic.light();
        setFilter(id);
      }}
      aria-pressed={filter === id}
      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[32px] ${
        filter === id
          ? 'bg-[#22ec72] text-black'
          : 'bg-[#0c1211] border border-[#1d2b26] text-zinc-400 hover:text-white'
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="pb-4">
      <div className="px-3.5 sm:px-4 pt-2 pb-1">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#22ec72]" />
          Operations
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">Manage your daily workflow.</p>
      </div>

      {/* Pill filters — All / Calls / Leads, real counts of rows shown. */}
      <div className="px-3.5 sm:px-4 pt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
        {pill('all', 'All', allCount)}
        {pill('calls', 'Calls', callsCount)}
        {pill('leads', 'Leads', leadsCount)}
      </div>

      {/* This week — what the AI team did. Moved here from the Dashboard
          in Stage 2; same component, same real data. */}
      {filter === 'all' && (
        <div className="px-3.5 sm:px-4 pt-3">
          <WeeklyCard
            serverCalls={serverCalls}
            jobs={jobs}
            actions={actions}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {attentionCount === 0 && (
        <div className="px-3.5 sm:px-4 pt-4">
          <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] px-4 py-6 text-center">
            <p className="text-sm font-bold text-white">You&apos;re all caught up.</p>
            <p className="text-xs text-zinc-400 mt-1">Nothing needs you right now.</p>
          </div>
        </div>
      )}

      {attentionCount > 0 && (
        <>
          {visibleNeeds.length > 0 && (
            <div ref={(el) => { sectionRefs.current['needs'] = el; }}>
              <Section icon={<AlertTriangle className="w-4 h-4" />} title="Needs you now" count={visibleNeeds.length}>
                {visibleNeeds.map((row) => (
                  <Row key={row.key} row={row} />
                ))}
              </Section>
            </div>
          )}

          {visibleAi.length > 0 && (
            <div ref={(el) => { sectionRefs.current['ai-team'] = el; }}>
              <Section icon={<Bot className="w-4 h-4" />} title="AI Team" count={visibleAi.length}>
                <div className="p-3 space-y-2.5">
                  {visibleAi.map((m) => (
                    <AgentInboxMessageCard
                      key={m.id}
                      msg={m}
                      onRespond={onRespond}
                      onNavigateTab={onNavigateTab}
                    />
                  ))}
                </div>
              </Section>
            </div>
          )}
          {filter === 'all' && handledAiMessages.length > 0 && (
            <div className="px-3.5 sm:px-4 pt-4">
              <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider pb-2">Handled</div>
              <div className="space-y-2.5">
                {handledAiMessages.map((m) => (
                  <AgentInboxMessageCard
                    key={m.id}
                    msg={m}
                    onRespond={onRespond}
                    onNavigateTab={onNavigateTab}
                  />
                ))}
              </div>
            </div>
          )}

          {(visibleRequests.length > 0 || visibleVoicemails.length > 0 || visibleJobs.length > 0) && (
            <div ref={(el) => { sectionRefs.current['customers'] = el; }}>
              <Section
                icon={<Users className="w-4 h-4" />}
                title="Customers"
                count={visibleRequests.length + visibleVoicemails.length + visibleJobs.length}
              >
                {visibleRequests.map((r) => (
                  <Row
                    key={r.id}
                    row={{
                      key: r.id,
                      title: `${r.customerName} — new request`,
                      body: snippet(`${r.serviceCategory || r.serviceType || ''} ${r.description}`.trim()),
                      tag: isRequestOverdue(r) ? 'Overdue' : 'New',
                      tagTone: isRequestOverdue(r) ? 'red' : 'lime',
                      filter: 'lead',
                      time: timeAgo(r.createdAt),
                      onTap: () => onOpenRequest(r.id),
                    }}
                  />
                ))}
                {visibleVoicemails.map((v) => (
                  <Row
                    key={v.id}
                    row={{
                      key: v.id,
                      title: `${v.callerName} — voicemail needs a callback`,
                      body: snippet(v.transcription || v.summary),
                      tag: v.urgency === 'urgent' || v.urgency === 'high' ? 'Urgent' : undefined,
                      tagTone: 'red',
                      filter: 'call',
                      time: timeAgo(v.timestamp),
                      onTap: onOpenVoicemail,
                    }}
                  />
                ))}
                {visibleJobs.map((j) => (
                  <Row
                    key={j.id}
                    row={{
                      key: j.id,
                      title: `${j.clientName} — job scheduled`,
                      body: snippet(`${j.title} · ${j.scheduledTime}`),
                      tag: 'Scheduled',
                      tagTone: 'lime',
                      filter: 'other',
                      onTap: () => onNavigateTab('jobs'),
                    }}
                  />
                ))}
              </Section>
            </div>
          )}

          {filter === 'all' && (
            <div ref={(el) => { sectionRefs.current['team'] = el; }}>
              <Section icon={<MessageSquare className="w-4 h-4" />} title="Team" count={teamUnreadCount}>
                {teamFailed ? (
                  <Row
                    row={{
                      key: 'team-failed',
                      title: 'Team chat couldn’t load here',
                      body: 'Tap to open Team Chat.',
                      filter: 'other',
                      onTap: () => onNavigateTab('team-chat'),
                    }}
                  />
                ) : latestTeam ? (
                  <Row
                    row={{
                      key: latestTeam.id,
                      title: `${latestTeam.senderName} — latest team message`,
                      body: snippet(latestTeam.text),
                      filter: 'other',
                      time: timeAgo(latestTeam.timestamp),
                      onTap: () => onNavigateTab('team-chat'),
                    }}
                  />
                ) : (
                  <Row
                    row={{
                      key: 'team-empty',
                      title: 'No team messages yet',
                      body: 'Tap to open Team Chat.',
                      filter: 'other',
                      onTap: () => onNavigateTab('team-chat'),
                    }}
                  />
                )}
              </Section>
            </div>
          )}

          {filter === 'all' && (
            <div ref={(el) => { sectionRefs.current['email'] = el; }}>
              <Section icon={<Mail className="w-4 h-4" />} title="Email">
                <Row
                  row={{
                    key: 'email-open',
                    title: 'Email',
                    body: 'Open your inbox — email, drafts, and sent mail.',
                    filter: 'other',
                    onTap: () => onNavigateTab('gmail'),
                  }}
                />
              </Section>
            </div>
          )}

          {visibleAlerts.length > 0 && (
            <div ref={(el) => { sectionRefs.current['alerts'] = el; }}>
              <Section icon={<Bell className="w-4 h-4" />} title="Alerts" count={visibleAlerts.length}>
                <div className="flex items-center gap-3 px-3.5 py-2 border-b border-[#1d2b26]/60">
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotifsRead}
                      className="min-h-[48px] text-xs text-zinc-400 hover:text-[#22ec72] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark All Read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearNotifs}
                      className="min-h-[48px] text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onTriggerTestPush}
                    className="min-h-[48px] text-xs text-[#22ec72] hover:underline font-semibold cursor-pointer"
                  >
                    + Test Push
                  </button>
                  <button
                    type="button"
                    onClick={onOpenNotifPrefs}
                    aria-label="Notification preferences"
                    title="Notification preferences"
                    className="min-h-[48px] ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                {visibleAlerts.map((row) => (
                  <Row key={row.key} row={row} />
                ))}
              </Section>
            </div>
          )}
        </>
      )}

      <p className="px-3.5 sm:px-4 pt-4 text-xs text-zinc-500 flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5" />
        Phone calls and the older Dispatch Radio stay on the Phone screen, unchanged.
      </p>
    </div>
  );
};
