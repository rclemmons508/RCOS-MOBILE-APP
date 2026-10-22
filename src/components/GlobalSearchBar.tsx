import React, { useMemo, useRef, useState } from 'react';
import { Search, X, Wrench, Users, Inbox, FileText, Receipt, ChevronRight } from 'lucide-react';
import { Job, Client, CustomerRequest, ActionRecord, TabType } from '../types';

interface GlobalSearchBarProps {
  jobs: Job[];
  clients: Client[];
  customerRequests: CustomerRequest[];
  actions: ActionRecord[];
  onNavigateTab: (tab: TabType) => void;
}

interface SearchHit {
  key: string;
  group: 'Jobs' | 'Clients' | 'Requests' | 'Quotes' | 'Invoices';
  title: string;
  subtitle: string;
  tab: TabType;
  icon: React.ReactNode;
}

const GROUP_ORDER = ['Jobs', 'Clients', 'Requests', 'Quotes', 'Invoices'] as const;

/** Case-insensitive "contains" across the haystack fields. */
function matches(query: string, ...fields: Array<string | number | undefined | null>): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  return fields.some((f) => f !== undefined && f !== null && String(f).toLowerCase().includes(q));
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  jobs,
  clients,
  customerRequests,
  actions,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchHit[] = [];

    for (const j of jobs) {
      if (matches(q, j.title, j.clientName, j.clientPhone, j.address, j.description, j.category, j.id)) {
        out.push({
          key: `job-${j.id}`,
          group: 'Jobs',
          title: j.title || 'Untitled job',
          subtitle: `${j.clientName}${j.status ? ` · ${statusLabel(j.status)}` : ''}`,
          tab: 'jobs',
          icon: <Wrench className="w-4 h-4 text-lime-400" />,
        });
      }
    }

    for (const c of clients) {
      if (matches(q, c.name, c.company, c.phone, c.email, c.id, ...(c.tags || []))) {
        out.push({
          key: `client-${c.id}`,
          group: 'Clients',
          title: c.name || 'Unnamed client',
          subtitle: `${c.company || ''}${c.company && c.phone ? ' · ' : ''}${c.phone || ''}`.trim() || statusLabel(c.status),
          tab: 'clients',
          icon: <Users className="w-4 h-4 text-sky-400" />,
        });
      }
    }

    for (const r of customerRequests) {
      if (matches(q, r.customerName, r.customerEmail, r.customerPhone, r.serviceType, r.serviceCategory, r.description, r.id)) {
        out.push({
          key: `request-${r.id}`,
          group: 'Requests',
          title: r.customerName || 'Customer request',
          subtitle: `${r.serviceType || r.serviceCategory || ''}${r.status ? ` · ${statusLabel(r.status)}` : ''}`.trim() || 'Customer request',
          tab: 'requests',
          icon: <Inbox className="w-4 h-4 text-amber-400" />,
        });
      }
    }

    for (const a of actions) {
      if (a.actionType !== 'generate_quote' && a.actionType !== 'send_invoice') continue;
      if (!matches(q, a.title, a.description, a.id)) continue;
      const isQuote = a.actionType === 'generate_quote';
      const amount = a.financialAmount ?? a.dollarAmount;
      out.push({
        key: `action-${a.id}`,
        group: isQuote ? 'Quotes' : 'Invoices',
        title: a.title || (isQuote ? 'Quote' : 'Invoice'),
        subtitle: [
          amount !== undefined && amount !== null ? `$${Number(amount).toLocaleString('en-US')}` : '',
          a.status ? statusLabel(a.status) : '',
        ].filter(Boolean).join(' · ') || (isQuote ? 'Quote' : 'Invoice'),
        tab: 'approvals',
        icon: isQuote ? <FileText className="w-4 h-4 text-violet-400" /> : <Receipt className="w-4 h-4 text-emerald-400" />,
      });
    }

    // Cap per group so one noisy source can't bury the others.
    const seen: Record<string, number> = {};
    const capped = out.filter((h) => {
      seen[h.group] = (seen[h.group] || 0) + 1;
      return seen[h.group] <= 8;
    });
    return capped.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [query, jobs, clients, customerRequests, actions]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const arr = map.get(h.group) || [];
      arr.push(h);
      map.set(h.group, arr);
    }
    return [...map.entries()];
  }, [hits]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    onNavigateTab(hit.tab);
  };

  return (
    <div className="relative">
      {/* Search box */}
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-900/90 border border-zinc-800 px-3 py-2.5 focus-within:border-lime-500/60 transition-colors">
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a tap on a result still registers before the panel closes.
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Search jobs, clients, quotes, invoices, requests…"
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
          aria-label="Search everything"
        />
        {query.length > 0 && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQuery('')}
            className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white shrink-0"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results panel */}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/60 max-h-80 overflow-y-auto">
          {hits.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-zinc-500">
              No jobs, clients, quotes, invoices, or requests match “{query.trim()}”.
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group}>
                <div className="sticky top-0 bg-zinc-950 px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {group} ({list.length})
                </div>
                {list.map((hit) => (
                  <button
                    key={hit.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(hit)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-900 active:bg-zinc-900 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      {hit.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">{hit.title}</span>
                      <span className="block text-[11px] text-zinc-500 truncate">{hit.subtitle}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
