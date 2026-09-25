import React, { useState } from 'react';
import { Client } from '../../types';
import { UserPlus, Building2, Phone, Mail, CheckCircle2, X } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (client: Client) => void;
  initialClient?: Client | null;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onAddClient,
  initialClient,
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (initialClient && isOpen) {
      setName(initialClient.name);
      setCompany(initialClient.company);
      setEmail(initialClient.email);
      setPhone(initialClient.phone);
      setNotes(initialClient.aiSummary);
    } else if (isOpen) {
      setName('');
      setCompany('');
      setEmail('');
      setPhone('');
      setNotes('');
    }
  }, [initialClient, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: Client = {
      id: initialClient ? initialClient.id : `client-${Date.now()}`,
      name,
      company,
      email,
      phone,
      status: initialClient ? initialClient.status : 'active',
      healthScore: initialClient ? initialClient.healthScore : 100,
      lastContactDate: initialClient ? initialClient.lastContactDate : 'Just now',
      totalSpent: initialClient ? initialClient.totalSpent : 0,
      activeJobsCount: initialClient ? initialClient.activeJobsCount : 0,
      tags: initialClient ? initialClient.tags : ['New Onboarding'],
      aiSummary: notes || (initialClient ? initialClient.aiSummary : 'New client onboarded via manual entry.'),
    };
    onAddClient(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">{initialClient ? 'Edit Client Account' : 'Onboard New Client'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto flex-1">
          <form id="add-client-form" onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 pl-1">Primary Contact Name *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserPlus className="w-4 h-4 text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors placeholder:text-zinc-600"
                  placeholder="e.g. Sarah Jenkins"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 pl-1">Company / Organization *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="w-4 h-4 text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors placeholder:text-zinc-600"
                  placeholder="e.g. Apex Tower Facilities"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 pl-1">Phone Number *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-zinc-500" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors placeholder:text-zinc-600"
                    placeholder="(555) 000-0000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 pl-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-zinc-500" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors placeholder:text-zinc-600"
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 pl-1">Initial Onboarding Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors resize-none placeholder:text-zinc-600 font-sans"
                placeholder="Add service tier, requirements, or SLA notes..."
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-client-form"
            className="px-4 py-2 rounded-xl bg-lime-500 text-black font-bold text-xs hover:bg-lime-400 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-lime-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{initialClient ? 'Save Changes' : 'Complete Onboarding'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
