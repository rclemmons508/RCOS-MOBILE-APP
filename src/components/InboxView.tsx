import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  ChevronRight,
  Clock,
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  Phone,
  Users,
} from 'lucide-react';
import {
  AgentInboxMessage,
  CustomerRequest,
  RCOSNotification,
  TabType,
  TeamMessage,
  VoicemailRecord,
} from '../types';
import { teamService } from '../services/teamService';
import { apiFetch } from '../lib/api';
import { haptic } from '../utils/haptics';

/**
 * One Inbox, Phase 1 — READ-ONLY aggregation.
 *
 * This screen reads the stores the app already loads (agent messages,
 * notifications, customer requests, team messages, voicemails) and links
 * each row to the screen that already exists. It moves no data, adds no
 * server endpoints, and changes nothing inside Team Chat or Gmail.
 *
 * One count is deliberately NOT shown, because there is no honest source
 * for it: Gmail unread/latest-sender lives only inside GmailTab's own
 * session. The team unread count, by contrast, is real now — the
 * real-time work merged in main added the team read marker, so the Team
 * section shows it and the Messages badge includes it. Nothing here is
 * guessed.
 */

interface InboxViewProps {
  agentMessages: AgentInboxMessage[];
  notifications: RCOSNotification[];
  customerRequests: CustomerRequest[];
  businessId: string;
  currentUserEmail: string;
  /** Unread Team Chat messages, from main's team read marker. */
  teamUnreadCount?: number;
  onNavigateTab: (tab: TabType) => void;
  onOpenInbox: () => void;
  onOpenNotifications: () => void;
  onOpenRequest: (id: string) => void;
  onOpenVoicemail: () => void;
}

type InboxRow = {
  key: string;
  title: string;
  body: string;
  tag?: string;
  tagTone?: 'red' | 'lime' | 'zinc';
  time?: string;
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
        <span className="text-lime-400">{icon}</span>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-lime-500/15 text-lime-300 border border-lime-500/30 text-[11px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
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
      className="w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-zinc-900/60 transition-colors cursor-pointer min-h-[44px]"
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-white truncate">{row.title}</span>
          {row.tag && (
            <span
              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                row.tagTone === 'red'
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : row.tagTone === 'lime'
                    ? 'bg-lime-500/10 text-lime-300 border-lime-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {row.tag}
            </span>
          )}
        </span>
        {row.body && <span className="block text-[11px] text-zinc-400 truncate mt-0.5">{row.body}</span>}
        {row.time && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
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
  businessId,
  currentUserEmail,
  teamUnreadCount = 0,
  onNavigateTab,
  onOpenInbox,
  onOpenNotifications,
  onOpenRequest,
  onOpenVoicemail,
}) => {
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamFailed, setTeamFailed] = useState(false);
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);

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
    apiFetch<VoicemailRecord[]>('/api/phone/voicemails')
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setVoicemails(data);
      })
      .catch(() => {
        // Voicemails stay out of the list; requests still show. Never faked.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            time: timeAgo(n.timestamp),
            onTap: onOpenNotifications,
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
            time: timeAgo(m.createdAt),
            onTap: onOpenInbox,
          },
        });
      });
    return rows.sort((a, b) => b.time - a.time).map((r) => r.row);
  }, [notifications, customerRequests, agentMessages, onOpenNotifications, onOpenRequest, onOpenInbox]);

  const aiRows = useMemo<InboxRow[]>(
    () =>
      newestFirst(
        agentMessages.filter((m) => m.status === 'unread' || m.status === 'read' || m.status === 'snoozed'),
        (m) => m.createdAt
      )
        .slice(0, 10)
        .map((m) => ({
          key: m.id,
          title: m.title,
          body: snippet(`${AGENT_LABEL[m.agent] || 'AI Team'} · ${KIND_LABEL[m.kind] || m.kind} — ${m.body}`),
          tag: m.status === 'unread' ? 'Unread' : m.status === 'snoozed' ? 'Snoozed' : undefined,
          tagTone: (m.status === 'unread' ? 'lime' : 'zinc') as 'lime' | 'zinc',
          time: timeAgo(m.createdAt),
          onTap: onOpenInbox,
        })),
    [agentMessages, onOpenInbox]
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
          time: timeAgo(n.timestamp),
          onTap: onOpenNotifications,
        })),
    [notifications, onOpenNotifications]
  );

  const contentCount =
    needsRows.length +
    aiRows.length +
    openRequests.length +
    openVoicemails.length +
    (latestTeam || teamFailed ? 1 : 0) +
    alertRows.length;

  return (
    <div className="pb-4">
      <div className="px-3.5 sm:px-4 pt-2 pb-1">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <InboxIcon className="w-5 h-5 text-lime-400" />
          Inbox
        </h1>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Everything that needs you, in one place. Tapping a row opens the screen it already lives on.
        </p>
      </div>

      {contentCount === 0 && (
        <div className="px-3.5 sm:px-4 pt-4">
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 px-4 py-6 text-center">
            <p className="text-sm font-bold text-white">You&apos;re all caught up.</p>
            <p className="text-xs text-zinc-400 mt-1">Nothing needs you right now.</p>
          </div>
        </div>
      )}

      {needsRows.length > 0 && (
        <Section icon={<AlertTriangle className="w-4 h-4" />} title="Needs you now" count={needsRows.length}>
          {needsRows.slice(0, 10).map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </Section>
      )}

      <Section icon={<Bot className="w-4 h-4" />} title="AI Team" count={aiRows.length}>
        {aiRows.length === 0 ? (
          <EmptyRow text="No AI Team messages right now." />
        ) : (
          aiRows.map((row) => <Row key={row.key} row={row} />)
        )}
      </Section>

      <Section
        icon={<Users className="w-4 h-4" />}
        title="Customers"
        count={openRequests.length + openVoicemails.length}
      >
        {openRequests.length === 0 && openVoicemails.length === 0 ? (
          <EmptyRow text="No new requests or voicemails." />
        ) : (
          <>
            {openRequests.map((r) => (
              <Row
                key={r.id}
                row={{
                  key: r.id,
                  title: `${r.customerName} — new request`,
                  body: snippet(`${r.serviceCategory || r.serviceType || ''} ${r.description}`.trim()),
                  tag: isRequestOverdue(r) ? 'Overdue' : 'New',
                  tagTone: isRequestOverdue(r) ? 'red' : 'lime',
                  time: timeAgo(r.createdAt),
                  onTap: () => onOpenRequest(r.id),
                }}
              />
            ))}
            {openVoicemails.map((v) => (
              <Row
                key={v.id}
                row={{
                  key: v.id,
                  title: `${v.callerName} — voicemail needs a callback`,
                  body: snippet(v.transcription || v.summary),
                  tag: v.urgency === 'urgent' || v.urgency === 'high' ? 'Urgent' : undefined,
                  tagTone: 'red',
                  time: timeAgo(v.timestamp),
                  onTap: onOpenVoicemail,
                }}
              />
            ))}
          </>
        )}
      </Section>

      <Section icon={<MessageSquare className="w-4 h-4" />} title="Team" count={teamUnreadCount}>
        {teamFailed ? (
          <Row
            row={{
              key: 'team-failed',
              title: 'Team chat couldn’t load here',
              body: 'Tap to open Team Chat.',
              onTap: () => onNavigateTab('team-chat'),
            }}
          />
        ) : latestTeam ? (
          <Row
            row={{
              key: latestTeam.id,
              title: `${latestTeam.senderName} — latest team message`,
              body: snippet(latestTeam.text),
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
              onTap: () => onNavigateTab('team-chat'),
            }}
          />
        )}
      </Section>

      <Section icon={<Mail className="w-4 h-4" />} title="Email">
        <Row
          row={{
            key: 'email-open',
            title: 'Email',
            body: 'Open your inbox — email, drafts, and sent mail.',
            onTap: () => onNavigateTab('gmail'),
          }}
        />
      </Section>

      <Section icon={<Bell className="w-4 h-4" />} title="Alerts" count={alertRows.length}>
        {alertRows.length === 0 ? (
          <EmptyRow text="No alerts right now." />
        ) : (
          alertRows.map((row) => <Row key={row.key} row={row} />)
        )}
      </Section>

      <p className="px-3.5 sm:px-4 pt-4 text-[11px] text-zinc-500 flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5" />
        Phone calls and the older Dispatch Radio stay on the Phone screen, unchanged.
      </p>
    </div>
  );
};
