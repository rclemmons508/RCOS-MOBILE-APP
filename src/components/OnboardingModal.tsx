import React, { useState } from 'react';
import { 
  Building2, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  Layers, 
  Loader2,
  AlertCircle,
  Clock,
  Briefcase,
  HelpCircle,
  FileCheck2,
  MessageSquare
} from 'lucide-react';
import { BusinessAccount, AutonomyMode, StarterDraft } from '../types';
import { INDUSTRY_PRESETS } from '../data/presets';
import { RcLogo } from './RcLogo';
import { useAuth } from '../context/AuthContext';

interface OnboardingModalProps {
  initialBusiness?: BusinessAccount | null;
  onComplete: (business: BusinessAccount) => void;
  onCancel?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialBusiness,
  onComplete,
  onCancel
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [businessName, setBusinessName] = useState(initialBusiness?.name || '');
  const [businessDesc, setBusinessDesc] = useState('');
  const [teamSize, setTeamSize] = useState(initialBusiness?.size || 'Solo Operator (1)');
  const [selectedIndustry, setSelectedIndustry] = useState(initialBusiness?.industry || 'cleaning');
  const [detectedReason, setDetectedReason] = useState<string>('');
  const [services, setServices] = useState<string[]>(
    initialBusiness?.services || ['Standard Service', 'Deep Service Package', 'Maintenance Inspection']
  );
  const [newServiceInput, setNewServiceInput] = useState('');
  const [pricingApproach, setPricingApproach] = useState(
    initialBusiness?.pricingApproach || 'Flat-rate standard pricing'
  );
  const [brandTone, setBrandTone] = useState(
    initialBusiness?.brandTone || 'Warm, dependable, and highly professional'
  );
  const [painPoints, setPainPoints] = useState<string[]>(
    initialBusiness?.painPoints || ['Writing quotes and estimates by hand', 'Chasing late or unpaid invoices']
  );
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(
    initialBusiness?.autonomyMode || 'autonomous'
  );
  const [dollarThreshold, setDollarThreshold] = useState<number>(
    initialBusiness?.dollarThreshold || 250
  );
  const [createdBizId, setCreatedBizId] = useState<string | null>(initialBusiness?.id || null);
  const [starterDrafts, setStarterDrafts] = useState<StarterDraft[]>([]);

  const painPointOptions = [
    'Writing quotes and estimates by hand',
    'Chasing late or unpaid invoices',
    'Scheduling appointments & crew dispatch',
    'Replying to customer questions late',
    'Managing job checklists & safety protocols',
    'Drafting follow-ups & review requests'
  ];

  // Live AI Industry Inference
  const handleDetectIndustry = async () => {
    if (!businessDesc.trim()) {
      setStep(4);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/business/temp/detect-industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: businessDesc })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.industryId) {
          setSelectedIndustry(data.industryId);
          setDetectedReason(data.reason || '');
          if (Array.isArray(data.suggestedServices) && data.suggestedServices.length) {
            setServices(data.suggestedServices);
          }
        }
      }
    } catch (e) {
      console.error('Detection error:', e);
    } finally {
      setLoading(false);
      setStep(4);
    }
  };

  const applyPreset = (presetId: string) => {
    setSelectedIndustry(presetId);
    const preset = INDUSTRY_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setServices(preset.defaultServices);
      setBrandTone(preset.recommendedTone);
    }
  };

  // Generate live starter drafts
  const handleGenerateStarters = async () => {
    setLoading(true);
    setError(null);
    try {
      const newBizPayload = {
        name: businessName.trim() || 'My Business',
        ownerId: user?.uid || undefined,
        industry: selectedIndustry,
        size: teamSize,
        services,
        pricingApproach,
        brandTone,
        painPoints,
        autonomyMode,
        dollarThreshold,
        onboardingCompleted: false
      };

      const url = createdBizId ? `/api/business/${createdBizId}` : '/api/businesses';
      const method = createdBizId ? 'PUT' : 'POST';
      const bizRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBizPayload)
      });
      const savedBiz = await bizRes.json();
      setCreatedBizId(savedBiz.id);

      const starterRes = await fetch(`/api/business/${savedBiz.id}/generate-starter-templates`, {
        method: 'POST'
      });
      const starterData = await starterRes.json();
      setStarterDrafts(starterData.drafts || []);
      setStep(6);
    } catch (err: any) {
      console.error(err);
      setError('Could not generate starter drafts. Proceeding to next step.');
      setStep(6);
    } finally {
      setLoading(false);
    }
  };

  // Finalize setup
  const handleFinish = async () => {
    setLoading(true);
    try {
      const finalPayload = {
        name: businessName.trim() || 'My Business',
        ownerId: user?.uid || undefined,
        industry: selectedIndustry,
        size: teamSize,
        services,
        pricingApproach,
        brandTone,
        painPoints,
        autonomyMode,
        dollarThreshold,
        onboardingCompleted: true
      };

      const url = createdBizId ? `/api/business/${createdBizId}` : '/api/businesses';
      const method = createdBizId ? 'PUT' : 'POST';
      const bizRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      });
      const saved = await bizRes.json();
      onComplete(saved);
    } catch (e) {
      console.error(e);
      setError('Failed to finalize setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0e1118] border border-[#222a3d] rounded-3xl p-6 md:p-8 shadow-2xl relative my-6">
        
        {/* Progress header */}
        <div className="flex items-center justify-between border-b border-[#1f2638] pb-4 mb-5">
          <RcLogo size="sm" />
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-6 bg-[#00ff66]'
                    : s < step
                    ? 'w-3 bg-[#00ff66]/40'
                    : 'w-2 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conversational Assistant Header: Morgan Vance */}
        <div className="flex items-start gap-3 p-3.5 mb-5 rounded-2xl bg-[#121622] border border-[#1f2739]">
          <div className="w-9 h-9 rounded-xl bg-[#1a2233] border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] font-bold text-xs shrink-0 mt-0.5">
            MV
          </div>
          <div className="space-y-0.5 text-left">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span>Morgan Vance</span>
              <span className="text-[10px] text-[#00ff66] font-mono font-normal">Executive Assistant</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {step === 1 && "Hello! I'm Morgan, your Executive Assistant. I oversee operational safety and coordinate your 12 AI employees. Let's get your business running."}
              {step === 2 && "Let's record the vital details of your operation so the AI team can tailor its calculations and communications."}
              {step === 3 && "Tell me about what you do in your own words, and I'll match our specialized industry preset for you."}
              {step === 4 && "Here is the operational preset we matched. Review the standard services and tone for your team."}
              {step === 5 && "Now let's configure your autonomy boundaries. You're always protected by our non-negotiable money movement lock."}
              {step === 6 && "I've drafted two operational templates tailored specifically for your business. They are marked as drafts awaiting your review."}
              {step === 7 && "Here are the three primary areas where you and your AI team will interact."}
              {step === 8 && "Your operational system is commissioned! Ready to enter your live command dashboard."}
            </p>
          </div>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="space-y-6 text-left">
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20 uppercase tracking-wider">
                Step 1 • Welcome
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Meet your unified team of 12 AI Employees.
              </h2>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                RCOS does not just chat about work. It executes operational tasks — preparing quotes, scheduling visits, auditing job safety checklists, and drafting invoices for real small business owners.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#141822] border border-[#21293a] space-y-1">
                <div className="text-[#00ff66] font-semibold text-xs">⚡ Real Operational Work</div>
                <div className="text-[11px] text-slate-400">Give a plain-English instruction to produce actual quotes, schedules, and invoices.</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141822] border border-[#21293a] space-y-1">
                <div className="text-[#00ff66] font-semibold text-xs">🛡️ Safe Autonomy Defaults</div>
                <div className="text-[11px] text-slate-400">Routine work runs on its own; money movement and price commitments always require your approval.</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-lg shadow-[#00ff66]/20"
              >
                <span>Begin Intake</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: BUSINESS INTAKE */}
        {step === 2 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 2 • Business Intake</span>
              <h3 className="text-xl font-bold text-white">Business Details</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Cleaning Services, Peak HVAC, Reliable Handyman"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Team Size</label>
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00ff66]"
                  >
                    <option value="Solo Operator (1)">Solo Operator (Just me)</option>
                    <option value="2-5 People">Small Crew (2-5 people)</option>
                    <option value="6-15 People">Mid-size Team (6-15 people)</option>
                    <option value="15+ People">Established (15+ people)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Pricing Model</label>
                  <select
                    value={pricingApproach}
                    onChange={(e) => setPricingApproach(e.target.value)}
                    className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00ff66]"
                  >
                    <option value="Flat-rate standard pricing">Flat-rate standard pricing</option>
                    <option value="Hourly rate with minimums">Hourly rate with minimums</option>
                    <option value="Square-footage / size-based pricing">Size / Square-footage based</option>
                    <option value="Custom quotes per project">Custom quotes per project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  What manual tasks currently take up too much time or stress?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {painPointOptions.map((opt, i) => {
                    const active = painPoints.includes(opt);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (active) setPainPoints(painPoints.filter(p => p !== opt));
                          else setPainPoints([...painPoints, opt]);
                        }}
                        className={`text-left p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition cursor-pointer ${
                          active
                            ? 'bg-[#00ff66]/10 border-[#00ff66]/50 text-white'
                            : 'bg-[#141822] border-[#22293b] text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                          active ? 'bg-[#00ff66] text-[#090b0e] font-bold' : 'border border-slate-600'
                        }`}>
                          {active && <Check className="w-3 h-3" />}
                        </div>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!businessName.trim()}
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <span>Next: Describe Services</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: INDUSTRY DETECTION */}
        {step === 3 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 3 • AI Industry Detection</span>
              <h3 className="text-xl font-bold text-white">Describe your services</h3>
              <p className="text-xs text-slate-400">Describe what your business does in plain words. Live Gemini will detect the ideal industry preset and safety rules.</p>
            </div>

            <div>
              <textarea
                rows={3}
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                placeholder="e.g. We provide residential and commercial cleaning, deep sanitation, and move-out cleaning using eco-friendly supplies..."
                className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
              />
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDetectIndustry}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#090b0e]" />
                    <span>Analyzing Services...</span>
                  </>
                ) : (
                  <>
                    <span>Detect Industry & Load Presets</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PRESET LOADING */}
        {step === 4 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 4 • Preset Loading</span>
              <h3 className="text-xl font-bold text-white">Confirm Preset & Services</h3>
              {detectedReason && (
                <p className="text-xs text-[#00ff66] font-medium mt-1">AI Match: {detectedReason}</p>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Industry Preset</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => applyPreset(e.target.value)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00ff66]"
                >
                  {INDUSTRY_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Offered Services</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {services.map((svc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-[#1a2130] text-slate-200 border border-[#2a344d]"
                    >
                      {svc}
                      <button
                        type="button"
                        onClick={() => setServices(services.filter((_, i) => i !== idx))}
                        className="hover:text-rose-400 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newServiceInput}
                    onChange={(e) => setNewServiceInput(e.target.value)}
                    placeholder="Add custom service (e.g. Move-in Deep Clean)"
                    className="flex-1 bg-[#131722] border border-[#252f44] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newServiceInput.trim()) {
                        setServices([...services, newServiceInput.trim()]);
                        setNewServiceInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1e2738] hover:bg-[#28344c] text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Set Autonomy</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: AUTONOMY SETUP */}
        {step === 5 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 5 • Autonomy & Safeguards</span>
              <h3 className="text-xl font-bold text-white">How much autonomy should your AI team have?</h3>
              <p className="text-xs text-slate-400">One simple toggle. Non-negotiable safety rules ensure money movement always requires your explicit approval.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setAutonomyMode('autonomous')}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                  autonomyMode === 'autonomous'
                    ? 'bg-[#00ff66]/10 border-[#00ff66] shadow-md shadow-[#00ff66]/10'
                    : 'bg-[#141822] border-[#22293a] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-xs">Autonomous Mode</div>
                  {autonomyMode === 'autonomous' && <div className="h-2 w-2 rounded-full bg-[#00ff66]" />}
                </div>
                <div className="text-[11px] text-slate-300">"Let my AI team handle routine work on its own."</div>
                <div className="text-[10px] text-slate-400">Routine drafts and reminders run automatically. Pauses for quotes, commitments, and money movement.</div>
              </div>

              <div
                onClick={() => setAutonomyMode('supervised')}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                  autonomyMode === 'supervised'
                    ? 'bg-[#00ff66]/10 border-[#00ff66] shadow-md shadow-[#00ff66]/10'
                    : 'bg-[#141822] border-[#22293a] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-xs">Supervised Mode</div>
                  {autonomyMode === 'supervised' && <div className="h-2 w-2 rounded-full bg-[#00ff66]" />}
                </div>
                <div className="text-[11px] text-slate-300">"Ask me before anything happens."</div>
                <div className="text-[10px] text-slate-400">Drafts everything into your Approval Queue before any message, quote, or schedule is dispatched.</div>
              </div>
            </div>

            {/* Safety Dollar Threshold */}
            <div className="p-3.5 rounded-xl bg-[#131722] border border-[#21293a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Always ask me before anything over:
                </span>
                <span className="text-xs font-mono text-[#00ff66] font-bold">${dollarThreshold}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500">$50</span>
                <input
                  type="range"
                  min={50}
                  max={2500}
                  step={50}
                  value={dollarThreshold}
                  onChange={(e) => setDollarThreshold(Number(e.target.value))}
                  className="flex-1 accent-[#00ff66]"
                />
                <span className="text-[10px] text-slate-500">$2,500</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerateStarters}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-[#00ff66]/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#090b0e]" />
                    <span>Calling AI Employees...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Real Starter Drafts</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: STARTER CONTENT GENERATION */}
        {step === 6 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 6 • Live Starter Content</span>
              <h3 className="text-xl font-bold text-white">Starter Drafts Ready for Review</h3>
              <p className="text-xs text-slate-400">
                Generated via live Gemini call for {businessName}. These are strictly marked as drafts awaiting approval — not fake history.
              </p>
            </div>

            <div className="space-y-2.5">
              {starterDrafts.map((draft, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[#131722] border border-[#21293a] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{draft.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Draft • Awaiting Owner Approval
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono line-clamp-3 bg-[#0a0c11] p-2.5 rounded-lg border border-[#1b2233]">
                    {draft.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(7)}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Take Quick Guided Tour</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: GUIDED TOUR */}
        {step === 7 && (
          <div className="space-y-4 text-left">
            <div>
              <span className="text-[10px] font-mono text-[#00ff66] uppercase tracking-wider">Step 7 • Guided Tour</span>
              <h3 className="text-xl font-bold text-white">3 Simple Concepts</h3>
              <p className="text-xs text-slate-400">RCOS keeps operations transparent, reliable, and completely under your control.</p>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-[#131722] border border-[#21293a] flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">The Command Bar</div>
                  <div className="text-[11px] text-slate-400">Type any plain-English operational instruction. Your AI routing engine immediately selects the correct employee and begins work.</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#131722] border border-[#21293a] flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">The Approval Queue</div>
                  <div className="text-[11px] text-slate-400">Anytime an action involves money movement, pricing commitments, or public communication, it holds here for your Approve / Edit / Reject.</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#131722] border border-[#21293a] flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Live Activity View & Audit Export</div>
                  <div className="text-[11px] text-slate-400">Shows simple friendly progress lines by default with an optional deep trace toggle for auditing, plus one-click CSV/report download.</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(8)}
                className="px-6 py-2.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Unlock System</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: UNLOCK DASHBOARD */}
        {step === 8 && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#00ff66]/15 border border-[#00ff66]/40 flex items-center justify-center text-[#00ff66] glow-rc">
              <Check className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {businessName} is Live on RCOS
              </h3>
              <p className="text-slate-300 text-xs max-w-sm mx-auto">
                All 12 AI employees are operational, your industry preset is loaded, and your intake pipeline is ready.
              </p>
            </div>

            <div className="pt-3 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="px-8 py-3.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-xl shadow-[#00ff66]/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#090b0e]" />
                    <span>Unlocking Operations System...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Live Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
