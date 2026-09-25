import React, { useState } from 'react';
import { 
  ShieldCheck, 
  DollarSign, 
  Sliders, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  AlertCircle,
  Lock,
  Building,
  Sparkles
} from 'lucide-react';
import { BusinessAccount, AutonomyMode } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

interface SettingsViewProps {
  business: BusinessAccount;
  onSave: (updated: BusinessAccount) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ business, onSave }) => {
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(business.autonomyMode);
  const [dollarThreshold, setDollarThreshold] = useState<number>(business.dollarThreshold);
  const [brandTone, setBrandTone] = useState(business.brandTone);
  const [pricingApproach, setPricingApproach] = useState(business.pricingApproach);
  const [activeEmployees, setActiveEmployees] = useState<Record<string, boolean>>(business.activeEmployees);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveSettings = async () => {
    const updated: BusinessAccount = {
      ...business,
      autonomyMode,
      dollarThreshold,
      brandTone,
      pricingApproach,
      activeEmployees
    };

    try {
      const res = await fetch(`/api/business/${business.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const saved = await res.json();
        onSave(saved);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f2637] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Autonomy & Safety Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how your AI team operates. Simple and safe by default.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          className="px-5 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-[#00ff66]/20 self-start sm:self-center"
        >
          {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? 'Settings Saved' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Global Autonomy Toggle */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Primary Autonomy Mode
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setAutonomyMode('autonomous')}
            className={`p-5 rounded-2xl border transition cursor-pointer space-y-2 ${
              autonomyMode === 'autonomous'
                ? 'bg-[#00ff66]/10 border-[#00ff66] shadow-lg shadow-[#00ff66]/10'
                : 'bg-[#0e1118] border-[#222a3a] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-white text-sm">Autonomous Mode</div>
              {autonomyMode === 'autonomous' && (
                <div className="h-2 w-2 rounded-full bg-[#00ff66]" />
              )}
            </div>
            <div className="text-xs text-slate-300">
              "Let my AI team handle routine work on its own."
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Routine messages and internal drafts execute automatically. Asks for approval on quotes, customer commitments, and money movement.
            </div>
          </div>

          <div
            onClick={() => setAutonomyMode('supervised')}
            className={`p-5 rounded-2xl border transition cursor-pointer space-y-2 ${
              autonomyMode === 'supervised'
                ? 'bg-[#00ff66]/10 border-[#00ff66] shadow-lg shadow-[#00ff66]/10'
                : 'bg-[#0e1118] border-[#222a3a] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-white text-sm">Supervised Mode</div>
              {autonomyMode === 'supervised' && (
                <div className="h-2 w-2 rounded-full bg-[#00ff66]" />
              )}
            </div>
            <div className="text-xs text-slate-300">
              "Ask me before anything happens."
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Drafts everything first and routes all quotes, outbound messages, and changes to your Approval Queue.
            </div>
          </div>
        </div>
      </div>

      {/* Dollar Safety Threshold */}
      <div className="p-5 rounded-2xl bg-[#0e1118] border border-[#21293a] space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#00ff66]" />
              <span>Safety Dollar Threshold</span>
            </h4>
            <p className="text-xs text-slate-400">
              "Always ask me before anything over this amount."
            </p>
          </div>
          <span className="text-base font-mono text-[#00ff66] font-bold">
            ${dollarThreshold}
          </span>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs text-slate-500 font-mono">$50</span>
          <input
            type="range"
            min={50}
            max={2500}
            step={50}
            value={dollarThreshold}
            onChange={(e) => setDollarThreshold(Number(e.target.value))}
            className="flex-1 accent-[#00ff66]"
          />
          <span className="text-xs text-slate-500 font-mono">$2,500</span>
        </div>
      </div>

      {/* Non-Negotiable Risk Rules Transparency Banner */}
      <div className="p-4 rounded-2xl bg-[#121622] border border-[#1f2738] space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <ShieldCheck className="w-4 h-4 text-[#00ff66]" />
          <span>Built-in Safety Safeguards</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
            <span>Internal drafts & summaries: Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
            <span>Routine outbound reminders: Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Quotes & Price commitments: Requires Approval</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Invoices & Money movement: Mandatory Approval Lock</span>
          </div>
        </div>
      </div>

      {/* Connected Cloud Systems & Google Services */}
      <div className="p-5 rounded-2xl bg-[#0e1118] border border-[#21293a] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00ff66]" />
            <span>Connected Systems & Google Services</span>
          </h4>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
            Systems Operational
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#131722] border border-[#202738] space-y-1">
            <div className="text-slate-200 font-semibold flex items-center gap-1.5">
              <span>Google Services Mobile (Android)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
            </div>
            <div className="text-[11px] font-mono text-slate-400">Package: com.rcsolutions.rcosmobile</div>
            <div className="text-[10px] font-mono text-slate-500">Project: rcos-mobile (627752468605)</div>
            <div className="text-[10px] text-emerald-400 font-medium">Config: /google-services.json loaded</div>
          </div>

          <div className="p-3 rounded-xl bg-[#131722] border border-[#202738] space-y-1">
            <div className="text-slate-200 font-semibold flex items-center gap-1.5">
              <span>Cloud Firestore Database</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
            </div>
            <div className="text-[11px] font-mono text-slate-400 truncate">ai-studio-rcosremoteoperat-c0c46f2b-8d0f-43b8-978d-70fb08614967</div>
            <div className="text-[10px] font-mono text-slate-500">Project: gen-lang-client-0370229208</div>
            <div className="text-[10px] text-emerald-400 font-medium">Rules: Deployed & Secured</div>
          </div>
        </div>
      </div>

      {/* ADVANCED SECTION (Tucked away as required) */}
      <div className="border border-[#1f2638] rounded-2xl overflow-hidden bg-[#0a0c11]">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#111520] transition cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Advanced Controls & Fine-Tuning</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-[#1f2638] space-y-5 text-xs text-slate-300">
            {/* Tone and Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1">Brand Communication Tone</label>
                <input
                  type="text"
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00ff66]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Pricing Approach</label>
                <input
                  type="text"
                  value={pricingApproach}
                  onChange={(e) => setPricingApproach(e.target.value)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00ff66]"
                />
              </div>
            </div>

            {/* Individual Employee Toggles */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-semibold">Active AI Employees</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_EMPLOYEES.map((emp) => {
                  const on = activeEmployees[emp.id] !== false;
                  return (
                    <div
                      key={emp.id}
                      className="p-2.5 rounded-xl bg-[#121622] border border-[#1f2738] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-white">{emp.name}</div>
                        <div className="text-[10px] text-slate-400">{emp.roleTitle}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          setActiveEmployees({ ...activeEmployees, [emp.id]: e.target.checked });
                        }}
                        className="accent-[#00ff66]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
