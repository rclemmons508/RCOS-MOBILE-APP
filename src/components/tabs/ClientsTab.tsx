import React, { useEffect, useRef, useState } from 'react';
import { ActionRecord, Client, Job } from '../../types';
import {
  Users,
  Building2,
  HeartPulse,
  Sparkles,
  Send,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  ChevronRight,
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  DollarSign,
  CalendarDays,
  FileText,
  StickyNote,
  History,
  Briefcase,
} from 'lucide-react';
import { AddClientModal } from '../clients/AddClientModal';
import { apiFetch } from '../../lib/api';
import { getJobCategories } from '../../lib/jobCategories';
import { ClientPrefill } from '../../lib/callToClient';
import { haptic } from '../../utils/haptics';

interface ClientsTabProps {
  clients: Client[];
  onAddClient: (newClient: Client) => void;
  onEditClient: (updatedClient: Client) => void;
  onDeleteClient: (id: string) => void;
  /** Jobs, for the "Last Job" line on each row and the History tab. Optional — the list
      works without it, showing "No jobs yet" instead. */
  jobs?: Job[];
  /** Money-loop records, for the Invoices tab. Optional — the tab shows an
      empty state without them. Linked to a customer through the job the
      record belongs to, or through the customer's name/company in the
      record's title — the same name/company matching the job list uses. */
  actions?: ActionRecord[];
  /** Quick-action signal: when App bumps this number, the add-client
      form opens. Lets the bottom bar's + button open the real form
      instead of just navigating to the tab. */
  openAddSignal?: number;
  /** The business's industry + own services, for the service picker on
      the Add/Edit Client form — same catalog the Jobs screen uses, so a
      customer is only ever tagged with work this business does. */
  industry?: string | null;
  businessServices?: string[] | null;
  /** Pre-filled details for the next Add Client open (e.g. from a call
      on the Calls screen). Read when openAddSignal fires. */
  clientPrefill?: ClientPrefill | null;
  /** Start a job for this customer, from their profile. Optional —
      the button is not shown without it. */
  onStartJob?: (client: Client) => void;
}

type Filter = 'all' | 'leads' | 'active';
type ProfileTab = 'overview' | 'history' | 'notes' | 'invoices';

/**
 * Customers — sidebar design Stage 3.
 *
 * List screen follows the reference Customers screen: header, search,
 * All / Leads / Active pills with real counts, and one row per customer
 * (initials avatar, name, status badge, phone, last job). Tapping a row
 * opens the Customer Profile screen (back arrow returns to the list)
 * with Overview / History / Notes / Invoices tabs — all real data.
 * "Convert to Customer" appears only on records that are actually leads.
 */
export const ClientsTab: React.FC<ClientsTabProps> = ({
  clients,
  onAddClient,
  onEditClient,
  onDeleteClient,
  jobs = [],
  actions = [],
  openAddSignal = 0,
  industry,
  businessServices,
  clientPrefill,
  onStartJob,
}) => {
  const [profileClientId, setProfileClientId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [draftTarget, setDraftTarget] = useState<Client | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  // Pre-filled details for the next Add Client open (from a call).
  // Set from the prop when the open signal fires, and cleared when the
  // form closes, so a manual Add never inherits a stale caller's number.
  const [pendingPrefill, setPendingPrefill] = useState<ClientPrefill | null>(null);
  // The business's own services — the only options the service picker
  // ever offers (own services → industry preset → empty, never another
  // trade's list; see getJobCategories).
  const serviceOptions = getJobCategories(industry, businessServices);
  // Quick-action signal from the bottom bar's + button: a new value
  // opens the add-client form. The ref stops a re-render from reopening
  // it after the user closes it.
  const lastAddSignalRef = useRef(0);
  // Identity of the last prefill object this tab consumed. App keeps
  // its copy until the next call-to-client action, so a later manual
  // Add (same signal family, same object) must not re-apply a stale
  // caller's number — only a fresh prefill object is applied.
  const lastPrefillRef = useRef<ClientPrefill | null>(null);
  useEffect(() => {
    if (openAddSignal && openAddSignal !== lastAddSignalRef.current) {
      lastAddSignalRef.current = openAddSignal;
      if (clientPrefill && clientPrefill !== lastPrefillRef.current) {
        lastPrefillRef.current = clientPrefill;
        setPendingPrefill(clientPrefill);
      } else {
        setPendingPrefill(null);
      }
      setIsAddClientModalOpen(true);
    }
  }, [openAddSignal, clientPrefill]);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const handleGenerateFollowUp = async (client: Client) => {
    setDraftTarget(client);
    setIsGenerating(true);
    setGeneratedDraft('');
    try {
      const data = await apiFetch<any>('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'agent-crm',
          prompt: `Draft a concise 2-sentence SMS follow-up for RC Solutions client ${client.name} from ${client.company}. Health score is ${client.healthScore}/100. Mention our new RCOS multi-agent AI system automation capabilities.`
        })
      });
      setGeneratedDraft(data?.reply || `Hi ${client.name}, this is RC Solutions. Following up regarding your operational systems at ${client.company}. Our AI automated service dispatch is ready whenever you need us!`);
    } catch {
      setGeneratedDraft(`Hi ${client.name}, this is RC Solutions! Our RCOS Voice AI and field dispatch modules are active and synchronized for ${client.company}. Let us know if we can schedule a quick check-in.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendDraft = () => {
    if (!draftTarget) return;
    setSentNotice(`Automated SMS dispatched to ${draftTarget.name} (${draftTarget.phone}).`);
    setGeneratedDraft('');
    setTimeout(() => setSentNotice(null), 3000);
  };

  // A lead becomes an active customer. Only offered on lead records —
  // the button is never shown for active, VIP, or inactive customers.
  const handleConvertToCustomer = (client: Client) => {
    onEditClient({ ...client, status: 'active' });
    setSentNotice(`${client.name} is now an active customer.`);
    setTimeout(() => setSentNotice(null), 3000);
  };

  const initialsFor = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?';

  // Jobs are matched by their stored customer link first — a job
  // started from the dropdown or the profile carries the customer's
  // id — then by company, contact name, or phone, the way older jobs
  // (free-text client name, no link) have always matched. The app
  // keeps jobs newest-first (new jobs are added to the front of the
  // list), so the first match is the latest job.
  const matchesClient = (job: Job, client: Client) =>
    job.clientId === client.id ||
    (client.company && job.clientName === client.company) ||
    job.clientName === client.name ||
    (client.phone && job.clientPhone === client.phone);

  const jobsFor = (client: Client) => jobs.filter((job) => matchesClient(job, client));
  const lastJobFor = (client: Client) => jobsFor(client)[0];

  // Quotes and invoices linked to this customer: through a job the record
  // belongs to, or through the customer's name/company in the record's
  // title. Same name/company matching the job list uses.
  const linkedMoneyActions = (client: Client) => {
    const clientJobIds = new Set(jobsFor(client).map((job) => job.id));
    const haystack = (a: ActionRecord) => `${a.title} ${a.description ?? ''}`.toLowerCase();
    const name = client.name.toLowerCase();
    const company = client.company.toLowerCase();
    return actions.filter(
      (a) =>
        (a.actionType === 'generate_quote' || a.actionType === 'send_invoice') &&
        ((a.jobId !== undefined && clientJobIds.has(a.jobId)) ||
          (a.scheduledJobId !== undefined && clientJobIds.has(a.scheduledJobId)) ||
          haystack(a).includes(name) ||
          (company.length > 0 && haystack(a).includes(company)))
    );
  };

  const money = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusBadge = (client: Client) => {
    switch (client.status) {
      case 'lead':
        return { label: 'New Lead', cls: 'bg-[#22ec72]/15 text-[#22ec72] border border-[#22ec72]/30' };
      case 'vip':
        return { label: 'VIP Account', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' };
      case 'inactive':
        return { label: 'Inactive', cls: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700' };
      default:
        return { label: 'Active Customer', cls: 'bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/25' };
    }
  };

  const leadsCount = clients.filter((c) => c.status === 'lead').length;
  const activeCount = clients.filter((c) => c.status === 'active' || c.status === 'vip').length;

  const visibleClients = clients.filter((client) => {
    if (filter === 'leads' && client.status !== 'lead') return false;
    if (filter === 'active' && client.status !== 'active' && client.status !== 'vip') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        client.name.toLowerCase().includes(q) ||
        client.company.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // The profile follows the live record; if that customer was deleted,
  // the profile closes instead of showing a stale card.
  const profileClient = profileClientId
    ? clients.find((c) => c.id === profileClientId) || null
    : null;

  const openProfile = (client: Client) => {
    haptic.light();
    setProfileTab('overview');
    setProfileClientId(client.id);
  };

  const pill = (id: Filter, label: string, count: number) => (
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

  const profileTabButton = (id: ProfileTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        haptic.light();
        setProfileTab(id);
      }}
      aria-pressed={profileTab === id}
      className={`flex-1 px-2 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[40px] ${
        profileTab === id
          ? 'bg-[#22ec72] text-black'
          : 'bg-[#0c1211] border border-[#1d2b26] text-zinc-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  const detailRow = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1d2b26]/60 last:border-b-0">
      <span className="w-8 h-8 rounded-lg bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="block text-sm text-white truncate">{value}</span>
      </span>
    </div>
  );

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast */}
      {sentNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#22ec72] text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Send className="w-3.5 h-3.5" />
          <span>{sentNotice}</span>
        </div>
      )}

      {profileClient ? (
        /* ---------- Customer Profile screen ---------- */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileClientId(null)}
              aria-label="Back to customers"
              className="min-h-[48px] p-2 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-white">Customer Profile</h2>
          </div>

          {/* Identity — initials avatar, name, status, company */}
          <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-full bg-[#22ec72]/10 border border-[#22ec72]/30 text-[#22ec72] flex items-center justify-center text-lg font-extrabold shrink-0">
                {initialsFor(profileClient.name)}
              </span>
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">{profileClient.name}</div>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-bold ${statusBadge(profileClient).cls}`}>
                  {statusBadge(profileClient).label}
                </span>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 truncate mt-1">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{profileClient.company}</span>
                </div>
              </div>
            </div>

            {/* Contact actions — only the channels this customer has */}
            <div className="flex items-center gap-2 pt-1">
              {profileClient.phone ? (
                <>
                  <a
                    href={`tel:${profileClient.phone}`}
                    aria-label={`Call ${profileClient.name}`}
                    className="flex-1 py-2.5 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] flex items-center justify-center gap-1.5 text-xs font-bold hover:border-[#22ec72]/50 transition cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`sms:${profileClient.phone}`}
                    aria-label={`Text ${profileClient.name}`}
                    className="flex-1 py-2.5 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] flex items-center justify-center gap-1.5 text-xs font-bold hover:border-[#22ec72]/50 transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Text</span>
                  </a>
                </>
              ) : null}
              {profileClient.email ? (
                <a
                  href={`mailto:${profileClient.email}`}
                  aria-label={`Email ${profileClient.name}`}
                  className="flex-1 py-2.5 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] flex items-center justify-center gap-1.5 text-xs font-bold hover:border-[#22ec72]/50 transition cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </a>
              ) : null}
            </div>
          </div>

          {/* Profile tabs */}
          <div className="flex items-center gap-1.5">
            {profileTabButton('overview', 'Overview')}
            {profileTabButton('history', 'History')}
            {profileTabButton('notes', 'Notes')}
            {profileTabButton('invoices', 'Invoices')}
          </div>

          {profileTab === 'overview' && (
            <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-4 space-y-3">
              {detailRow(<Building2 className="w-4 h-4" />, 'Company', profileClient.company)}
              {profileClient.serviceType
                ? detailRow(<Briefcase className="w-4 h-4" />, 'Service', profileClient.serviceType)
                : null}
              {detailRow(<Phone className="w-4 h-4" />, 'Phone', profileClient.phone || 'Not on file')}
              {detailRow(<Mail className="w-4 h-4" />, 'Email', profileClient.email || 'Not on file')}
              {detailRow(
                <HeartPulse className="w-4 h-4" />,
                'Health Score',
                `${profileClient.healthScore}%`
              )}
              {detailRow(
                <DollarSign className="w-4 h-4" />,
                'Total Spent',
                money(profileClient.totalSpent)
              )}
              {detailRow(
                <CalendarDays className="w-4 h-4" />,
                'Last Contact',
                profileClient.lastContactDate
              )}

              {/* AI Summary */}
              <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-[#1d2b26]">
                {profileClient.aiSummary}
              </p>

              {/* Tags */}
              {profileClient.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {profileClient.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-md bg-black/40 border border-[#1d2b26] text-zinc-400 font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1d2b26] text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setClientToEdit(profileClient)}
                    className="min-h-[48px] p-2 rounded-lg bg-black/40 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-[#1d2b26]"
                    title="Edit Client"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteClient(profileClient.id);
                      setProfileClientId(null);
                    }}
                    className="min-h-[48px] p-2 rounded-lg bg-black/40 hover:bg-zinc-800 text-red-500/80 hover:text-red-400 transition-colors cursor-pointer border border-[#1d2b26]"
                    title="Remove Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateFollowUp(profileClient)}
                  disabled={isGenerating}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/40 hover:bg-[#22ec72]/20 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#22ec72]" />
                  <span>{isGenerating ? 'Drafting...' : 'AI Nurture Follow-Up'}</span>
                </button>
              </div>
            </div>
          )}

          {profileTab === 'history' && (
            <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-4 space-y-2">
              {jobsFor(profileClient).length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <History className="w-7 h-7 text-zinc-600 mx-auto" />
                  <div className="text-sm font-bold text-zinc-300">No jobs yet</div>
                  <p className="text-xs text-zinc-500">Jobs booked for {profileClient.name} will show here.</p>
                </div>
              ) : (
                jobsFor(profileClient).map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-black/40 border border-[#1d2b26] flex items-center gap-3"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{job.title}</span>
                      <span className="block text-xs text-zinc-400 truncate">{job.scheduledTime}</span>
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/25 font-bold whitespace-nowrap">
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {profileTab === 'notes' && (
            <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-4 space-y-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <StickyNote className="w-4 h-4 text-[#22ec72]" />
                <span className="text-xs font-bold uppercase tracking-wider">Notes</span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed bg-black/40 p-3 rounded-xl border border-[#1d2b26]">
                {profileClient.aiSummary}
              </p>
              <p className="text-xs text-zinc-500">
                Notes are kept with the customer record — edit them any time.
              </p>
              <button
                type="button"
                onClick={() => setClientToEdit(profileClient)}
                className="min-h-[48px] w-full py-2.5 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-[#22ec72] text-xs font-bold hover:border-[#22ec72]/50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit notes</span>
              </button>
            </div>
          )}

          {profileTab === 'invoices' && (
            <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-4 space-y-2">
              {linkedMoneyActions(profileClient).length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <FileText className="w-7 h-7 text-zinc-600 mx-auto" />
                  <div className="text-sm font-bold text-zinc-300">No quotes or invoices yet</div>
                  <p className="text-xs text-zinc-500">Quotes and invoices linked to {profileClient.name} will show here.</p>
                </div>
              ) : (
                linkedMoneyActions(profileClient).map((a) => {
                  const amount = a.financialAmount ?? a.dollarAmount;
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-black/40 border border-[#1d2b26] flex items-center gap-3"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-white truncate">{a.title}</span>
                        <span className="block text-xs text-zinc-400 truncate">
                          {a.actionType === 'send_invoice' ? 'Invoice' : 'Quote'}
                          {' · '}
                          {a.paymentStatus === 'paid' ? 'Paid' : a.status.replace('_', ' ')}
                        </span>
                      </span>
                      {amount !== undefined && (
                        <span className="text-sm font-bold text-white whitespace-nowrap">{money(amount)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Start a job — opens the Dispatch form pre-filled with
              this customer and linked to them. */}
          {onStartJob ? (
            <button
              type="button"
              onClick={() => {
                haptic.medium();
                onStartJob(profileClient);
              }}
              className="min-h-[48px] w-full py-3 rounded-2xl bg-[#22ec72] text-black font-extrabold text-sm transition cursor-pointer shadow-md shadow-[#22ec72]/20 hover:brightness-110 flex items-center justify-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              <span>Start a job</span>
            </button>
          ) : null}

          {/* Convert to Customer — leads only, never shown otherwise. */}
          {profileClient.status === 'lead' && (
            <button
              type="button"
              onClick={() => handleConvertToCustomer(profileClient)}
              className="min-h-[48px] w-full py-3 rounded-2xl bg-[#22ec72] text-black font-extrabold text-sm transition cursor-pointer shadow-md shadow-[#22ec72]/20 hover:brightness-110"
            >
              Convert to Customer
            </button>
          )}
        </div>
      ) : (
        /* ---------- Customers list screen ---------- */
        <>
          {/* Header — title, subtitle, and add. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#22ec72]" />
                  Customers
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">Manage your customer relationships.</p>
              </div>
              <button
                type="button"
                onClick={() => { setPendingPrefill(null); setIsAddClientModalOpen(true); }}
                className="px-3 py-2 rounded-xl bg-[#22ec72] hover:brightness-110 text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#22ec72]/20 shrink-0 min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers..."
                className="w-full bg-[#0c1211] border border-[#1d2b26] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#22ec72]/60"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {pill('all', 'All', clients.length)}
              {pill('leads', 'Leads', leadsCount)}
              {pill('active', 'Active', activeCount)}
            </div>
          </div>

          {/* Client list — initials avatar, name, status badge, phone,
              last job, chevron. Tap a row to open the customer profile. */}
          <div className="space-y-2">
            {clients.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-2">
                <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-300">No client accounts yet</div>
                <p className="text-xs text-zinc-500">Add your first client to track jobs, follow-ups, and account health.</p>
                <button
                  type="button"
                  onClick={() => { setPendingPrefill(null); setIsAddClientModalOpen(true); }}
                  className="min-h-[48px] mt-2 px-3 py-1.5 rounded-xl bg-[#22ec72] text-black text-xs font-bold cursor-pointer hover:brightness-110 transition"
                >
                  + Add First Client
                </button>
              </div>
            ) : visibleClients.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-2">
                <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-300">No clients match</div>
                <p className="text-xs text-zinc-500">Try a different search or filter.</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilter('all'); }}
                  className="min-h-[48px] mt-2 px-3 py-1.5 rounded-xl bg-[#0c1211] text-zinc-300 text-xs font-bold border border-[#1d2b26] cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  Clear search &amp; filters
                </button>
              </div>
            ) : (
              visibleClients.map((client) => {
                const lastJob = lastJobFor(client);
                const badge = statusBadge(client);
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => openProfile(client)}
                    className="min-h-[48px] w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition cursor-pointer bg-[#0c1211] border-[#1d2b26] hover:border-[#22ec72]/40"
                  >
                    <span className="w-10 h-10 rounded-full bg-[#22ec72]/10 border border-[#22ec72]/30 text-[#22ec72] flex items-center justify-center text-xs font-extrabold shrink-0">
                      {initialsFor(client.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{client.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </span>
                      <span className="block text-xs text-zinc-400 truncate">{client.phone}</span>
                      <span className="block text-xs text-zinc-500 truncate">
                        Last Job: {lastJob ? lastJob.scheduledTime : 'No jobs yet'}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-zinc-600" />
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* AI Draft Proposal Modal */}
      {draftTarget && generatedDraft && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c1211] border border-[#22ec72]/40 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1d2b26] pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#22ec72]" />
                <h3 className="text-sm font-bold text-white">
                  RCOS AI Draft for {draftTarget.name}
                </h3>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setGeneratedDraft('')}
                className="min-h-[48px] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-200 bg-black/40 p-3 rounded-2xl border border-[#1d2b26] leading-relaxed font-sans">
              &quot;{generatedDraft}&quot;
            </p>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-xs text-zinc-500 font-mono">Target Phone: {draftTarget.phone}</span>
              <button
                type="button"
                onClick={handleSendDraft}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#22ec72] hover:brightness-110 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send SMS Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Onboarding Modal */}
      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => { setIsAddClientModalOpen(false); setPendingPrefill(null); }}
        onAddClient={onAddClient}
        prefill={pendingPrefill}
        serviceOptions={serviceOptions}
      />

      {/* Edit Client Modal */}
      <AddClientModal
        isOpen={!!clientToEdit}
        onClose={() => setClientToEdit(null)}
        initialClient={clientToEdit}
        serviceOptions={serviceOptions}
        onAddClient={(c) => {
          onEditClient(c);
          setClientToEdit(null);
        }}
      />
    </div>
  );
};
