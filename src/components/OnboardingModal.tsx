import React, { useState } from 'react';
import { 
  Building2, 
  Sparkles, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  Loader2,
  AlertCircle,
  Phone,
  Briefcase,
  Users,
  CheckCircle2,
  Wrench,
  Bot,
  Zap,
  Sliders
} from 'lucide-react';
import { BusinessAccount, AutonomyMode, StarterDraft } from '../types';
import { INDUSTRY_PRESETS } from '../data/presets';
import { RCLogo } from './RCLogo';
import { useAuth } from '../context/AuthContext';
import { haptic } from '../utils/haptics';

interface OnboardingModalProps {
  initialBusiness?: BusinessAccount | null;
  onComplete: (business: BusinessAccount) => void;
  onCancel?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialBusiness,
  onComplete,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'input' | 'detecting' | 'review'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Business Basic Inputs
  const [businessName, setBusinessName] = useState(initialBusiness?.name || '');
  const [businessDescription, setBusinessDescription] = useState('');
  
  // Detected Setup Details
  const [detectedIndustryId, setDetectedIndustryId] = useState<string>('hvac');
  const [detectedIndustryName, setDetectedIndustryName] = useState<string>('HVAC & Mechanical Services');
  const [detectedServices, setDetectedServices] = useState<string[]>([
    'AC Diagnostic & Repair',
    'Seasonal System Tune-Up',
    'Emergency Service Call',
    'Equipment Replacement & Installation'
  ]);
  const [brandTone, setBrandTone] = useState<string>('Direct, authoritative, and safety-focused');
  const [dollarThreshold, setDollarThreshold] = useState<number>(1250);
  const [technicianRoleName, setTechnicianRoleName] = useState<string>('HVAC Certified Specialist');

  // AI Employees to Enable for this specific industry
  const [activeEmployees, setActiveEmployees] = useState<Record<string, boolean>>({
    executive_assistant: true,   // Operations & Safety Chief
    customer_service: true,      // 24/7 Voice AI Phone Receptionist
    operations: true,            // Smart Job Dispatcher & Routing
    sales: true,                 // Estimator & Proposal Drafter
    technician: true,            // Trade Specialist with safety checklists
    finance: true                // Invoicing & Ledger Auditor
  });

  // Fast inspiration chips for quick mobile tap
  const quickTradeChips = [
    { label: 'HVAC & Heating', query: 'Commercial & residential HVAC repair, AC maintenance, emergency heating calls' },
    { label: 'Electrical', query: 'Commercial and residential electrician, breaker panel upgrades, wiring, 24/7 emergency service' },
    { label: 'Plumbing', query: 'Plumbing contractor, leak repairs, water heater install, drain cleaning and emergency service' },
    { label: 'Cleaning & Maid', query: 'Residential and commercial cleaning, deep cleaning, move-out turnovers, office sanitation' },
    { label: 'Landscaping', query: 'Lawn care, commercial landscaping, seasonal cleanup, tree trimming, and irrigation' },
    { label: 'Auto & Mobile Mechanic', query: 'Mobile auto mechanic, brake repair, oil changes, engine diagnostics, fleet maintenance' },
    { label: 'Roofing & Gutters', query: 'Roof leak repairs, shingle replacement, storm damage inspection, gutter cleaning' },
    { label: 'Handyman & Repairs', query: 'General home repairs, carpentry, drywall, fixture mounting, and maintenance calls' }
  ];

  const handleSelectQuickChip = (chip: { label: string; query: string }) => {
    haptic.selection();
    if (!businessName) {
      setBusinessName(`${chip.label.split('&')[0].trim()} Pros`);
    }
    setBusinessDescription(chip.query);
  };

  // Local Intelligent Keyword Preset Matcher (Zero latency, reliable fallback)
  const matchPresetLocally = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('hvac') || lower.includes('ac ') || lower.includes('air conditioning') || lower.includes('heating') || lower.includes('furnace') || lower.includes('chiller')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'hvac') || INDUSTRY_PRESETS[5];
    }
    if (lower.includes('clean') || lower.includes('maid') || lower.includes('janitor') || lower.includes('sanitat')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'cleaning') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('lawn') || lower.includes('mow') || lower.includes('landscap') || lower.includes('tree') || lower.includes('yard')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'landscaping') || INDUSTRY_PRESETS[2];
    }
    if (lower.includes('auto') || lower.includes('mechanic') || lower.includes('car ') || lower.includes('brake') || lower.includes('oil change')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'auto_services') || INDUSTRY_PRESETS[8];
    }
    if (lower.includes('roof') || lower.includes('gutter') || lower.includes('shingle')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'roofing') || INDUSTRY_PRESETS[6];
    }
    if (lower.includes('paint') || lower.includes('stain') || lower.includes('drywall')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'painting') || INDUSTRY_PRESETS[3];
    }
    if (lower.includes('pressure') || lower.includes('power wash') || lower.includes('soft wash')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'pressure_washing') || INDUSTRY_PRESETS[4];
    }
    if (lower.includes('electric') || lower.includes('wire') || lower.includes('panel') || lower.includes('breaker') || lower.includes('construct') || lower.includes('contractor')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'construction') || INDUSTRY_PRESETS[7];
    }
    if (lower.includes('repair') || lower.includes('handyman') || lower.includes('fix')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'handyman') || INDUSTRY_PRESETS[1];
    }
    return INDUSTRY_PRESETS.find(p => p.id === 'general_small_business') || INDUSTRY_PRESETS[11];
  };

  const handleStartAnalysis = async () => {
    if (!businessName.trim() && !businessDescription.trim()) {
      setError('Please enter your business name or describe what your business does.');
      return;
    }
    setError(null);
    setLoading(true);
    setStep('detecting');
    await haptic.medium();

    const descToAnalyze = businessDescription.trim() || businessName.trim();
    let detectedPreset = matchPresetLocally(descToAnalyze);

    // Also call server AI industry detection for enhanced reasoning
    try {
      const res = await fetch('/api/business/temp/detect-industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descToAnalyze })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.industryId) {
          const matched = INDUSTRY_PRESETS.find(p => p.id === data.industryId);
          if (matched) {
            detectedPreset = matched;
          }
        }
      }
    } catch {
      // Fallback already assigned
    }

    // Apply detected configuration
    setDetectedIndustryId(detectedPreset.id);
    setDetectedIndustryName(detectedPreset.name);
    setDetectedServices(detectedPreset.defaultServices);
    setBrandTone(detectedPreset.recommendedTone);
    setTechnicianRoleName(detectedPreset.technicianRoleName || 'Field Technician');
    setDollarThreshold(
      detectedPreset.id === 'hvac' || detectedPreset.id === 'construction' || detectedPreset.id === 'roofing' 
        ? 1500 
        : detectedPreset.id === 'auto_services' 
        ? 800 
        : 500
    );

    setLoading(false);
    setStep('review');
    await haptic.success();
  };

  const toggleEmployee = (employeeKey: string) => {
    haptic.selection();
    setActiveEmployees(prev => ({
      ...prev,
      [employeeKey]: !prev[employeeKey]
    }));
  };

  const handleLaunchWorkspace = async () => {
    setLoading(true);
    await haptic.success();

    const businessPayload: BusinessAccount = {
      id: initialBusiness?.id || `biz_${Date.now()}`,
      name: businessName.trim() || `${detectedIndustryName.split('&')[0].trim()} Company`,
      industry: detectedIndustryId,
      size: 'Solo Operator (1-5)',
      services: detectedServices,
      pricingApproach: 'Flat-rate & Standard Ratecard',
      brandTone,
      painPoints: ['Emergency dispatch delays', 'Off-hours voice answering'],
      autonomyMode: 'autonomous',
      dollarThreshold,
      activeEmployees,
      onboardingCompleted: true,
      starterDrafts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('rcos_onboarding_completed', 'true');
      localStorage.setItem('rcos_configured_business', JSON.stringify(businessPayload));

      // Attempt saving to server database
      await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessPayload)
      }).catch(() => null);

      onComplete(businessPayload);
    } catch (e) {
      console.warn('Onboarding completion error:', e);
      onComplete(businessPayload);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <RCLogo variant="compact" />
            <div>
              <h1 className="text-xs font-bold text-white tracking-tight uppercase">RCOS Quick Setup</h1>
              <p className="text-[10px] text-zinc-400 font-mono">Automated Industry Setup</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 font-bold">
            {step === 'input' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: BUSINESS & TRADE INPUT */}
        {step === 'input' && (
          <div className="space-y-4 text-left">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                What kind of work does your business do?
              </h2>
              <p className="text-xs text-zinc-400">
                RCOS will analyze your input, detect your trade, and preset your AI assistants automatically.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Mechanical Solutions"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Services & Trade Description
                </label>
                <textarea
                  rows={3}
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  placeholder="Describe your primary services, typical jobs, and customer calls..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 resize-none"
                />
              </div>

              {/* Quick 1-Tap Trade Chips */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                  Or tap your trade for instant setup:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickTradeChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleSelectQuickChip(chip)}
                      className={`text-[10.5px] px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        businessDescription === chip.query
                          ? 'bg-lime-500/20 text-lime-300 border-lime-500/50 font-bold'
                          : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <span>Analyze & Preset My System</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1.5: DETECTING ANIMATION */}
        {step === 'detecting' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-lime-500/20 border border-lime-500/40 text-lime-400 flex items-center justify-center animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Analyzing Your Trade Requirements</h3>
              <p className="text-xs text-zinc-400 max-w-xs">
                Configuring industry safety thresholds, dispatch routines, and tailoring your AI team...
              </p>
            </div>
            <Loader2 className="w-5 h-5 text-lime-400 animate-spin" />
          </div>
        )}

        {/* STEP 2: REVIEW DETECTED INDUSTRY & ENABLE AI EMPLOYEES */}
        {step === 'review' && (
          <div className="space-y-4 text-left">
            {/* Detected Industry Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-lime-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20">
                  Target Industry Detected
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Limit: ${dollarThreshold}
                </span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {detectedIndustryName}
                </h3>
                <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-1">
                  Preset Technician: <span className="text-lime-300 font-medium">{technicianRoleName}</span>
                </p>
              </div>

              {/* Sample standard services */}
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 block mb-1">Configured Standard Services:</span>
                <div className="flex flex-wrap gap-1">
                  {detectedServices.slice(0, 3).map((s, idx) => (
                    <span key={idx} className="text-[9.5px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Employees Toggle Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-lime-400" />
                  <span>Enable AI Helpers for {detectedIndustryName}</span>
                </h4>
                <span className="text-[10px] text-zinc-400 font-mono">Tap to enable/disable</span>
              </div>

              <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                {/* 1. Voice Receptionist */}
                <div 
                  onClick={() => toggleEmployee('customer_service')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.customer_service 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.customer_service ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">24/7 Voice AI Receptionist</div>
                      <div className="text-[10px] text-zinc-400 truncate">Answers customer calls & logs urgent work tickets</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.customer_service ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.customer_service && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* 2. Smart Dispatcher */}
                <div 
                  onClick={() => toggleEmployee('operations')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.operations 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.operations ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">Job Dispatch & Routing Specialist</div>
                      <div className="text-[10px] text-zinc-400 truncate">Assigns field technicians & optimizes travel</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.operations ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.operations && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* 3. Estimator & Quotes */}
                <div 
                  onClick={() => toggleEmployee('sales')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.sales 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.sales ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">Trade Estimator & Proposal Drafter</div>
                      <div className="text-[10px] text-zinc-400 truncate">Prepares quotes within ${dollarThreshold} safety limits</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.sales ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.sales && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* 4. Lead Field Technician */}
                <div 
                  onClick={() => toggleEmployee('technician')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.technician 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.technician ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <Wrench className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{technicianRoleName}</div>
                      <div className="text-[10px] text-zinc-400 truncate">Adheres to trade checklists & safety procedures</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.technician ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.technician && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* 5. Billing & Invoicing Specialist */}
                <div 
                  onClick={() => toggleEmployee('finance')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.finance 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.finance ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <Sliders className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">Invoicing & Billing Auditor</div>
                      <div className="text-[10px] text-zinc-400 truncate">Compiles job tickets into itemized client receipts</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.finance ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.finance && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* 6. Operations & Safety Chief */}
                <div 
                  onClick={() => toggleEmployee('executive_assistant')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                    activeEmployees.executive_assistant 
                      ? 'bg-zinc-900 border-lime-500/40 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeEmployees.executive_assistant ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">Operations & Safety Chief</div>
                      <div className="text-[10px] text-zinc-400 truncate">Enforces approval rules on high-dollar actions</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                    activeEmployees.executive_assistant ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                  }`}>
                    {activeEmployees.executive_assistant && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <button
              type="button"
              onClick={handleLaunchWorkspace}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <span>Launch Workspace for {businessName || 'My Business'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
