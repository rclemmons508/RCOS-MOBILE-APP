import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  CheckSquare, 
  ShieldCheck, 
  Wrench, 
  AlertTriangle, 
  HelpCircle, 
  Plus, 
  Sparkles, 
  Loader2, 
  Layers,
  ChevronRight
} from 'lucide-react';
import { BusinessAccount, JobPack } from '../types';

interface JobPacksViewProps {
  business: BusinessAccount;
}

export const JobPacksView: React.FC<JobPacksViewProps> = ({ business }) => {
  const [jobPacks, setJobPacks] = useState<JobPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch job packs for business industry
  useEffect(() => {
    const fetchPacks = async () => {
      try {
        const res = await fetch(`/api/business/${business.id}/job-packs`);
        if (res.ok) {
          const data = await res.json();
          setJobPacks(data);
          if (data.length > 0 && !selectedPackId) {
            setSelectedPackId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch job packs:', err);
      }
    };
    fetchPacks();
  }, [business.id, business.industry]);

  const selectedPack = jobPacks.find(j => j.id === selectedPackId) || jobPacks[0];

  const handleGenerateJobPack = async () => {
    if (!newServiceName.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/${business.id}/job-packs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: newServiceName.trim() })
      });

      if (!res.ok) {
        throw new Error('Failed to generate job pack');
      }

      const createdPack = await res.json();
      setJobPacks(prev => [createdPack, ...prev]);
      setSelectedPackId(createdPack.id);
      setNewServiceName('');
      setShowCreateModal(false);
    } catch (err: any) {
      console.error(err);
      setError('Could not generate Job Pack. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f2637] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Operational Job Packs</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
              {jobPacks.length} Standards Loaded
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Standard Operating Procedures (SOPs), 4-stage workflow sequences, tool manifests, and safety protocols for each service.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#00ff66]/20 self-start sm:self-center"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Generate Job Pack</span>
        </button>
      </div>

      {/* Main Grid: Left selector, Right active pack content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left List */}
        <div className="lg:col-span-4 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {jobPacks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0e1118] border border-[#21293a] text-center text-xs text-slate-400">
              No Job Packs loaded yet. Click "AI Generate Job Pack" above to create one.
            </div>
          ) : (
            jobPacks.map((pack) => {
              const isSelected = pack.id === selectedPackId;
              return (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer text-left space-y-1.5 ${
                    isSelected
                      ? 'bg-[#131722] border-[#00ff66]/50 shadow-lg shadow-[#00ff66]/10'
                      : 'bg-[#0d1017] border-[#1f2638] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{pack.serviceType}</h4>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#00ff66]' : 'text-slate-600'}`} />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {pack.checklist.length} checklist items • {pack.requiredTools.length} required tools
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Details Panel */}
        <div className="lg:col-span-8 bg-[#0e1118] border border-[#21293a] rounded-3xl p-6 shadow-2xl space-y-6">
          {selectedPack ? (
            <>
              <div className="flex items-center justify-between border-b border-[#1f2638] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#00ff66]" />
                    <span>{selectedPack.serviceType} Standard</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Industry: {selectedPack.industry}</p>
                </div>
              </div>

              {/* 4-Stage Workflow Sequence */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span>Standard Workflow Sequence (4-Stage Execution)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#121622] border border-[#202738] space-y-1.5">
                    <div className="text-xs font-bold text-sky-400">1. Pre-Check</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {selectedPack.workflowSequence?.preCheck?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-sky-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#121622] border border-[#202738] space-y-1.5">
                    <div className="text-xs font-bold text-[#00ff66]">2. Execute</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {selectedPack.workflowSequence?.execute?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#00ff66]">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#121622] border border-[#202738] space-y-1.5">
                    <div className="text-xs font-bold text-amber-400">3. Clean-Up</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {selectedPack.workflowSequence?.cleanUp?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#121622] border border-[#202738] space-y-1.5">
                    <div className="text-xs font-bold text-purple-400">4. Client Confirmation</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {selectedPack.workflowSequence?.clientConfirmation?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-purple-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Master Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span>Standard Quality Checklist</span>
                </h4>
                <div className="p-4 rounded-xl bg-[#121622] border border-[#202738] space-y-2">
                  {selectedPack.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <div className="w-4 h-4 rounded border border-[#00ff66]/40 flex items-center justify-center text-[10px] text-[#00ff66] shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools & Safety Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Required Tools */}
                <div className="p-4 rounded-xl bg-[#121622] border border-[#202738] space-y-2">
                  <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-orange-400" />
                    <span>Required Equipment & Supplies</span>
                  </h5>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {selectedPack.requiredTools.map((t, idx) => (
                      <li key={idx}>• {t}</li>
                    ))}
                  </ul>
                </div>

                {/* Safety Notes */}
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                  <h5 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                    <span>Safety Protocols & Hazards</span>
                  </h5>
                  <ul className="text-xs text-rose-200/80 space-y-1">
                    {selectedPack.safetyNotes.map((s, idx) => (
                      <li key={idx}>• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a Job Pack from the left to view details.
            </div>
          )}
        </div>

      </div>

      {/* AI Generate Job Pack Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e1118] border border-[#242c3e] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00ff66]" />
                <span>AI Job Pack Generator</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter any service name in {business.name}'s scope. Live Gemini will draft a standardized 4-stage workflow sequence, checklist, tools, and safety notes.
            </p>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Service Name</label>
              <input
                type="text"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="e.g. Move-in Sanitation, Tankless Water Heater Flush, Attic Mold Cleanse"
                className="w-full bg-[#131722] border border-[#263044] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#00ff66]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newServiceName.trim() || isGenerating}
                onClick={handleGenerateJobPack}
                className="px-5 py-2 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#090b0e]" />
                    <span>Drafting Standard...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Standard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
