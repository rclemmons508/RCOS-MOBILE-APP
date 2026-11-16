import React, { useEffect, useRef, useState } from 'react';
import { Client, Job } from '../../types';
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
  ChevronRight
} from 'lucide-react';
import { AddClientModal } from '../clients/AddClientModal';
import { apiFetch } from '../../lib/api';

interface ClientsTabProps {
  clients: Client[];
  onAddClient: (newClient: Client) => void;
  onEditClient: (updatedClient: Client) => void;
  onDeleteClient: (id: string) => void;
  /** Jobs, for the "Last Job" line on each row. Optional — the list
      works without it, showing "No jobs yet" instead. */
  jobs?: Job[];
  /** Quick-action signal: when App bumps this number, the add-client
      form opens. Lets the bottom bar's + button open the real form
      instead of just navigating to the tab. */
  openAddSignal?: number;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({ 
  clients, 
  onAddClient, 
  onEditClient, 
  onDeleteClient,
  jobs = [],
  openAddSignal = 0
}) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  // Quick-action signal from the bottom bar's + button: a new value
  // opens the add-client form. The ref stops a re-render from reopening
  // it after the user closes it.
  const lastAddSignalRef = useRef(0);
  useEffect(() => {
    if (openAddSignal && openAddSignal !== lastAddSignalRef.current) {
      lastAddSignalRef.current = openAddSignal;
      setIsAddClientModalOpen(true);
    }
  }, [openAddSignal]);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const handleGenerateFollowUp = async (client: Client) => {
    setSelectedClient(client);
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
    if (!selectedClient) return;
    setSentNotice(`Automated SMS dispatched to ${selectedClient.name} (${selectedClient.phone}).`);
    setGeneratedDraft('');
    setTimeout(() => setSentNotice(null), 3000);
  };

  // Design 1 list: initials avatar, name, phone, and the most recent job
  // for that client. Jobs are matched by company, contact name, or phone —
  // the app stores the client name on a job as free text, so all three
  // are checked. The app keeps jobs newest-first (new jobs are added to
  // the front of the list), so the first match is the latest job.
  const initialsFor = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?';

  const lastJobFor = (client: Client) =>
    jobs.find(
      (job) =>
        (client.company && job.clientName === client.company) ||
        job.clientName === client.name ||
        (client.phone && job.clientPhone === client.phone)
    );

  const activeCount = clients.filter((c) => c.status !== 'inactive').length;
  const inactiveCount = clients.length - activeCount;

  const visibleClients = clients.filter((client) => {
    if (filter === 'active' && client.status === 'inactive') return false;
    if (filter === 'inactive' && client.status !== 'inactive') return false;
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

  // The detail card below the list follows the selected client; if that
  // client was deleted, nothing is shown instead of a stale card.
  const detailClient = selectedClient ? clients.find((c) => c.id === selectedClient.id) || null : null;

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast */}
      {sentNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Send className="w-3.5 h-3.5" />
          <span>{sentNotice}</span>
        </div>
      )}

      {/* Header — title, search, and add. The old "RCOS Client Nurture
          CRM" banner and TOTAL PIPELINE $ are gone (Design 1). */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold text-white">Clients</h2>
          <button
            type="button"
            onClick={() => setIsAddClientModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-lime-500/20 shrink-0"
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
            placeholder="Search name, company, or phone"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-lime-500/60"
          />
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'all', label: 'All', count: clients.length },
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'inactive', label: 'Inactive', count: inactiveCount },
          ] as const).map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilter(pill.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                filter === pill.key
                  ? 'bg-lime-500 text-black border-lime-500'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>
      </div>

      {/* Client list — Design 1 rows: initials avatar, name, phone,
          last job, chevron. Tap a row to see the full detail below. */}
      <div className="space-y-2">
        {clients.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">No client accounts yet</div>
            <p className="text-xs text-zinc-500">Add your first client to track jobs, follow-ups, and account health.</p>
            <button
              type="button"
              onClick={() => setIsAddClientModalOpen(true)}
              className="mt-2 px-3 py-1.5 rounded-xl bg-lime-500 text-black text-xs font-bold cursor-pointer hover:bg-lime-400 transition-colors"
            >
              + Add First Client
            </button>
          </div>
        ) : visibleClients.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">No clients match</div>
            <p className="text-xs text-zinc-500">Try a different search or filter.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilter('all'); }}
              className="mt-2 px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-bold border border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors"
            >
              Clear search & filters
            </button>
          </div>
        ) : (
          visibleClients.map((client) => {
            const isSelected = detailClient?.id === client.id;
            const lastJob = lastJobFor(client);
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClient(client)}
                className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 border-lime-500/60 shadow-lg shadow-lime-500/10'
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <span className="w-10 h-10 rounded-full bg-lime-500/10 border border-lime-500/30 text-lime-400 flex items-center justify-center text-xs font-extrabold shrink-0">
                  {initialsFor(client.name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{client.name}</span>
                  <span className="block text-xs text-zinc-400 truncate">{client.phone}</span>
                  <span className="block text-[11px] text-zinc-500 truncate">
                    Last Job: {lastJob ? lastJob.scheduledTime : 'No jobs yet'}
                  </span>
                </span>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-lime-400' : 'text-zinc-600'}`} />
              </button>
            );
          })
        )}
      </div>

      {/* Selected client detail — the full card from before, shown once
          below the list instead of once per client. */}
      {detailClient && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 shadow-md">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{detailClient.name}</h3>
                {detailClient.status === 'vip' && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase font-mono shrink-0">
                    VIP Account
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{detailClient.company}</span>
              </div>
            </div>

            {/* Health Score Gauge */}
            <div className="flex flex-col items-end shrink-0">
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-lime-400">
                <HeartPulse className="w-3.5 h-3.5 text-lime-400" />
                <span>{detailClient.healthScore}% Health</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Contacted {detailClient.lastContactDate}</span>
            </div>
          </div>

          {/* AI Summary */}
          <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 font-sans">
            {detailClient.aiSummary}
          </p>

          {/* Tags Ribbon */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {detailClient.tags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Card Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setClientToEdit(detailClient)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-800"
                title="Edit Client"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteClient(detailClient.id)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-red-500/80 hover:text-red-400 transition-colors cursor-pointer border border-zinc-800"
                title="Remove Account"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleGenerateFollowUp(detailClient)}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-lime-500/10 text-lime-300 border border-lime-500/40 hover:bg-lime-500/20 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-lime-400" />
              <span>{isGenerating ? 'Drafting...' : 'AI Nurture Follow-Up'}</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Draft Proposal Modal */}
      {selectedClient && generatedDraft && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-lime-500/40 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-lime-400" />
                <h3 className="text-sm font-bold text-white">
                  RCOS AI Draft for {selectedClient.name}
                </h3>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setGeneratedDraft('')}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-200 bg-zinc-900 p-3 rounded-2xl border border-zinc-800 leading-relaxed font-sans">
              "{generatedDraft}"
            </p>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[10px] text-zinc-500 font-mono">Target Phone: {selectedClient.phone}</span>
              <button
                type="button"
                onClick={handleSendDraft}
                className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
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
        onClose={() => setIsAddClientModalOpen(false)}
        onAddClient={onAddClient}
      />

      {/* Edit Client Modal */}
      <AddClientModal
        isOpen={!!clientToEdit}
        onClose={() => setClientToEdit(null)}
        initialClient={clientToEdit}
        onAddClient={(c) => {
          onEditClient(c);
          setClientToEdit(null);
        }}
      />
    </div>
  );
};
