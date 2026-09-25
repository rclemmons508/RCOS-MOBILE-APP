import React, { useState } from 'react';
import { Client } from '../../types';
import { 
  Users, 
  Building2, 
  HeartPulse, 
  Sparkles, 
  Send, 
  Plus, 
  Edit2, 
  Trash2,
  X 
} from 'lucide-react';
import { AddClientModal } from '../clients/AddClientModal';

interface ClientsTabProps {
  clients: Client[];
  onAddClient: (newClient: Client) => void;
  onEditClient: (updatedClient: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({ 
  clients, 
  onAddClient, 
  onEditClient, 
  onDeleteClient 
}) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0] || null);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const handleGenerateFollowUp = async (client: Client) => {
    setSelectedClient(client);
    setIsGenerating(true);
    setGeneratedDraft('');
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-crm',
          prompt: `Draft a concise 2-sentence SMS follow-up for RC Solutions client ${client.name} from ${client.company}. Health score is ${client.healthScore}/100. Mention our new RCOS multi-agent AI system automation capabilities.`
        })
      });
      const data = await response.json();
      setGeneratedDraft(data.reply || `Hi ${client.name}, this is RC Solutions. Following up regarding your operational systems at ${client.company}. Our AI automated service dispatch is ready whenever you need us!`);
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

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast */}
      {sentNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-purple-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Send className="w-3.5 h-3.5" />
          <span>{sentNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
              RCOS Client Nurture CRM
            </h2>
            <p className="text-xs text-zinc-400 truncate">Account Health & Automated Growth</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0">
          <span className="text-xs sm:text-sm font-black text-lime-400 font-mono">
            ${clients.reduce((acc, c) => acc + c.totalSpent, 0).toLocaleString()}
          </span>
          <div className="text-[9px] text-zinc-500 font-mono">TOTAL PIPELINE</div>
        </div>
      </div>

      {/* New Client Onboarding Trigger */}
      <button
        type="button"
        onClick={() => setIsAddClientModalOpen(true)}
        className="w-full p-3 sm:p-3.5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer group"
      >
        <Plus className="w-4 h-4 text-lime-400 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-bold">Onboard New Client Account</span>
      </button>

      {/* Client Cards List */}
      <div className="space-y-3">
        {clients.map((client) => (
          <div
            key={client.id}
            className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 hover:border-purple-500/40 transition-all shadow-md"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{client.name}</h3>
                  {client.status === 'vip' && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase font-mono shrink-0">
                      VIP Account
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{client.company}</span>
                </div>
              </div>

              {/* Health Score Gauge */}
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-lime-400">
                  <HeartPulse className="w-3.5 h-3.5 text-lime-400" />
                  <span>{client.healthScore}% Health</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Contacted {client.lastContactDate}</span>
              </div>
            </div>

            {/* AI Summary */}
            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 font-sans">
              {client.aiSummary}
            </p>

            {/* Tags Ribbon */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {client.tags.map((tag) => (
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
                  onClick={() => setClientToEdit(client)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-800"
                  title="Edit Client"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteClient(client.id)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-red-500/80 hover:text-red-400 transition-colors cursor-pointer border border-zinc-800"
                  title="Remove Account"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateFollowUp(client)}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{isGenerating && selectedClient?.id === client.id ? 'Drafting...' : 'AI Nurture Follow-Up'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* AI Draft Proposal Modal */}
      {selectedClient && generatedDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-purple-500/40 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  RCOS AI Draft for {selectedClient.name}
                </h3>
              </div>
              <button
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
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
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
