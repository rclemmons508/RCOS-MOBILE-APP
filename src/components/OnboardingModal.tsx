import React, { useState, useRef, useEffect } from 'react';
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
  Wrench,
  Bot,
  Sliders,
  CheckCircle2,
  Upload,
  FileText,
  FileUp,
  X,
  Search,
  RefreshCw,
  Plus,
  HelpCircle,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import { BusinessAccount } from '../types';
import { INDUSTRY_PRESETS } from '../data/presets';
import { RCLogo } from './RCLogo';
import { useAuth } from '../context/AuthContext';
import { haptic } from '../utils/haptics';
import { apiFetch } from '../lib/api';
import { firestoreService } from '../services/firestoreService';

interface OnboardingModalProps {
  initialBusiness?: BusinessAccount | null;
  onComplete: (business: BusinessAccount) => void;
  onCancel?: () => void;
}

interface UploadedFileRecord {
  name: string;
  size: number;
  type: string;
  text: string;
  base64?: string;
}

// Sample business files for instant 1-tap testing
const SAMPLE_BUSINESS_FILES = [
  {
    name: 'Apex_Flow_Plumbing_Invoice.txt',
    title: 'Plumbing & Drain Services Invoice',
    trade: 'Plumbing',
    content: `Apex Flow Plumbing & Sewer Solutions LLC
License #PLMB-94021 | 24/7 Emergency Dispatch
1840 Riverfront Way, Suite 400
Phone: (555) 749-3820 | dispatch@apexflowplumbing.com

SERVICES & WORK TICKET DETAILS:
- Emergency slab leak electronic location & thermal imaging
- Copper water line pinhole excision & PEX ProPress coupling repair
- Hydro-jetting 4-inch main sewer line to city tap (cleared heavy root intrusion)
- High-efficiency 50-gallon Rheem hybrid heat pump water heater installation
- Static water pressure testing: Calibrated PRV to 65 PSI

TERMS & POLICIES:
Standard diagnostic rate: $149 (waived with approved repair).
Emergency after-hours dispatch available 24/7.
All joint couplings backed by 5-year workmanship warranty.`
  },
  {
    name: 'VoltMaster_Electrical_Quote.txt',
    title: 'Electrical Contracting & EV Charger Quote',
    trade: 'Electrical',
    content: `VoltMaster Commercial & Residential Electric
Licensed Master Electricians | EC-48201
450 Innovation Parkway, Industrial Park
dispatch@voltmasterelectric.com | (555) 832-1940

PROJECT SCOPE & RATE PROPOSAL:
1. 200A Square D Main Electrical Panel Upgrade with whole-home surge protector
2. Dedicated 60A Level 2 Tesla Universal EV Wall Connector install in 2-car garage
3. Conduit run: 45ft 1-inch EMT with 6/3 THHN wire from basement utility room
4. Kitchen GFCI code compliance audit & AFCI dual-function breaker retrofitting
5. Whole-home smart Lutron Caséta lighting automation setup

SAFETY COMPLIANCE:
All installations strictly adhere to NEC 2023 code standards.
Municipal inspection scheduled upon rough-in clearance.
Warranty: Lifetime warranty on panel bus and 2-year warranty on digital equipment.`
  },
  {
    name: 'Nexus_Cloud_IT_MSP_Agreement.txt',
    title: 'Managed IT Services (MSP) SOW',
    trade: 'IT Services',
    content: `Nexus Systems & Cloud Technologies MSP
Managed Service Provider & Cybersecurity Operations
700 Silicon Ave, Suite 1200
support@nexuscloudit.com | 24/7 NOC: (555) 902-4411

MANAGED IT SERVICES & CLIENT PROFILE:
- 24/7 Remote Helpdesk & Tier-2 Systems Support for 35 corporate workstations
- Microsoft 365 Enterprise migration, Intune MDM security policy deployment
- Zero-Trust cybersecurity perimeter audit, endpoint EDR, and SentinelOne setup
- Automated immutable cloud backup disaster recovery testing with 15-min RTO
- Fortinet SD-WAN firewall gateway deployment & secure VPN mesh for remote staff

CLIENT SLA:
Priority 1 Outage: 15-minute response time.
Automated patch management executed on Tuesday off-peak windows.`
  },
  {
    name: 'Solarix_CleanEnergy_Proposal.txt',
    title: 'Solar PV & Battery Storage Proposal',
    trade: 'Solar Energy',
    content: `Solarix Clean Energy & Power Storage Solutions
NABCEP Certified PV Contractors | Lic #SOL-77402
900 Sunburst Boulevard
projects@solarixenergy.com | (555) 612-8800

TURNKEY RESIDENTIAL SOLAR SPECIFICATION:
- 10.4 kW DC Rooftop Solar Array (26x REC 400W Alpha Pure Black Panels)
- Enphase IQ8+ Microinverters with rapid shutdown safety compliance
- Tesla Powerwall 3 Integrated Battery Storage (13.5 kWh usable capacity)
- Smart electrical gateway backup load management subpanel
- Turnkey utility net-metering interconnection filing and PTO management
- Production guarantee: 14,800 kWh estimated annual generation`
  },
  {
    name: 'IronPulse_Gym_Membership_Menu.txt',
    title: 'Fitness Studio & Personal Training Menu',
    trade: 'Fitness & Gym',
    content: `Iron & Pulse Athletic Performance Club
Functional Fitness, Strength & Conditioning Studio
1200 Metro Athletic Way
membership@ironpulseclub.com | (555) 433-2100

CLUB SERVICES & AMENITIES:
- 1-on-1 Certified Strength & Conditioning Coach Personal Training
- Functional Movement Screen (FMS) and InBody 570 biometric body composition analysis
- Unlimited HIIT, Olympic Weightlifting, and Recovery Yoga group classes
- Custom macro nutrition coaching and athletic supplement regimens
- Cold plunge tub, infrared dry sauna, and physical therapy recovery zone
- Open gym access 5:00 AM - 11:00 PM with RFID digital mobile keycard access`
  },
  {
    name: 'PawsWhiskers_PetGrooming_Menu.txt',
    title: 'Mobile Pet Care & Veterinary Spa Menu',
    trade: 'Pet Care',
    content: `Paws & Whiskers Luxury Mobile Grooming & Pet Wellness
Certified AKC Canine Stylists & Pet First Aid Techs
service@pawswhiskersspa.com | (555) 234-9000

SERVICE PACKAGES & TREATMENT MENU:
- Head-to-Tail Luxury Hydro-Massage Bath with Organic Oatmeal Conditioning
- Precision Breed-Standard Scissor Styling & Sanitary Trim
- Ultrasonic Teeth Brushing, Fresh Breath Spray, and Diamond Dremel Nail Grind
- Hypoallergenic De-shedding Furminator Treatment & Ear Canal Cleansing
- Mobile van arrives climate-controlled with warm purified water
- Veterinary wellness screening report card provided after every visit`
  }
];

// Categorized preset groups for the selector modal
const PRESET_CATEGORIES = [
  { id: 'all', label: 'All Industries (32)' },
  { id: 'trades', label: 'Trades & Field Services' },
  { id: 'tech', label: 'Tech & Professional' },
  { id: 'health', label: 'Health & Wellness' },
  { id: 'property', label: 'Property & Logistics' },
  { id: 'commerce', label: 'Hospitality & Commerce' }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialBusiness,
  onComplete,
  onCancel,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow State: 'input' -> 'detecting' -> 'review'
  const [step, setStep] = useState<'input' | 'detecting' | 'review'>('input');
  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<UploadedFileRecord | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Manual Inputs
  const [businessName, setBusinessName] = useState(initialBusiness?.name || '');
  const [businessDescription, setBusinessDescription] = useState('');

  // AI Detecting Animation Progression State
  const [detectingStageIndex, setDetectingStageIndex] = useState(0);

  // AI Detected & Deciphered Specifications
  const [detectedIndustryId, setDetectedIndustryId] = useState<string>('plumbing');
  const [detectedIndustryName, setDetectedIndustryName] = useState<string>('Plumbing & Pipe Restoration');
  const [confidenceScore, setConfidenceScore] = useState<number>(0.96);
  const [agentReasoning, setAgentReasoning] = useState<string>(
    'AI detected extensive plumbing, pipe restoration, and emergency drain terminology from your company profile.'
  );
  const [keyInsights, setKeyInsights] = useState<string[]>([
    'Identified 24/7 emergency dispatch service requirement',
    'Detected field technician workflow with safety pressure limits',
    'Optimized for rapid quote generation and instant voice answering'
  ]);
  const [detectedServices, setDetectedServices] = useState<string[]>([
    'Emergency Leak Repair',
    'Water Heater Replacement',
    'Drain Hydro-Jetting',
    'Sewer Camera Inspection'
  ]);
  const [brandTone, setBrandTone] = useState<string>('Urgent, certified, dependable, and transparent');
  const [dollarThreshold, setDollarThreshold] = useState<number>(1250);
  const [technicianRoleName, setTechnicianRoleName] = useState<string>('Journeyman Plumber');

  // New service tag input for review step
  const [newServiceTag, setNewServiceTag] = useState('');

  // Preset Picker Dialog State
  const [isChangingPreset, setIsChangingPreset] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Active AI Employees configured for this trade
  const [activeEmployees, setActiveEmployees] = useState<Record<string, boolean>>({
    executive_assistant: true,   // Operations & Safety Chief
    customer_service: true,      // 24/7 Voice AI Phone Receptionist
    operations: true,            // Smart Job Dispatcher & Routing
    sales: true,                 // Estimator & Proposal Drafter
    technician: true,            // Trade Specialist with safety checklists
    finance: true                // Invoicing & Ledger Auditor
  });

  // Dynamic detecting animation steps
  const detectingStages = [
    { title: 'Reading & Parsing Business Information', desc: 'Analyzing uploaded files, service scope, and business terminology...' },
    { title: 'Deciphering Operational Profile', desc: 'Extracting company identity, technician workflows, and client touchpoints...' },
    { title: 'Matching Across 32 Industry Presets', desc: 'Cross-referencing trades, compliance codes, and best operational fits...' },
    { title: 'Calibrating Autonomous Workforce', desc: 'Configuring safety thresholds, reception scripts, and dispatch rules...' }
  ];

  // Quick 1-tap trade chips for manual entry
  const quickTradeChips = [
    { label: 'Plumbing & Drains', query: 'Commercial & residential plumbing, emergency water leak isolation, water heater replacement, drain hydrojetting' },
    { label: 'Electrical & Power', query: 'Master electrician, 200A panel upgrades, EV charger installation, circuit rewiring, and smart home lighting' },
    { label: 'HVAC Mechanical', query: 'Commercial & residential HVAC repair, AC seasonal tune-up, heat pump install, and heating calls' },
    { label: 'IT Services & MSP', query: 'Managed service provider (MSP), 24/7 IT helpdesk, cybersecurity audits, cloud migrations, and network backup' },
    { label: 'Solar & Battery', query: 'Residential rooftop solar PV installation, Tesla Powerwall battery storage, and net-metering interconnection' },
    { label: 'Fitness & Gym', query: 'Personal training studio, functional fitness, strength coaching, InBody scans, and group classes' },
    { label: 'Pet Care & Grooming', query: 'Mobile pet grooming, veterinary wellness checks, pet spa baths, canine behavior training, and daycare' },
    { label: 'Event Production', query: 'Full-service event coordination, wedding planning, audio/visual staging, and banquet catering' },
    { label: 'Roofing & Gutters', query: 'Roof leak inspections, shingle repair, gutter guards, storm damage, and reroof estimates' },
    { label: 'Cleaning & Maid', query: 'Residential and commercial cleaning, deep cleaning, turnover turnovers, and office sanitation' },
    { label: 'Mobile Auto Mechanic', query: 'Mobile auto mechanic, brake repairs, oil changes, engine diagnostics, and fleet maintenance' },
    { label: 'Marketing Agency', query: 'Digital marketing, paid social ad campaigns, conversion website builds, brand identity, and SEO' }
  ];

  // Rotate detecting steps
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'detecting') {
      setDetectingStageIndex(0);
      interval = setInterval(() => {
        setDetectingStageIndex(prev => (prev < detectingStages.length - 1 ? prev + 1 : prev));
      }, 700);
    }
    return () => clearInterval(interval);
  }, [step]);

  // Handle file drop & reading
  const processUploadedFile = (file: File) => {
    const isText = file.type.startsWith('text/') || 
                   file.name.endsWith('.txt') || 
                   file.name.endsWith('.md') || 
                   file.name.endsWith('.json') || 
                   file.name.endsWith('.csv');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();

    if (isText) {
      reader.onload = (e) => {
        const textContent = (e.target?.result as string) || '';
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          text: textContent
        });
        setError(null);
      };
      reader.readAsText(file);
    } else if (isPdf || isImage) {
      // For PDF or image, read as Data URL base64 for multimodal AI deciphering
      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        const base64Data = dataUrl.split(',')[1] || '';
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          text: `[Binary document payload: ${file.name}]`,
          base64: base64Data
        });
        setError(null);
      };
      reader.readAsDataURL(file);
    } else {
      // Fallback read as text
      reader.onload = (e) => {
        const textContent = (e.target?.result as string) || '';
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          text: textContent
        });
        setError(null);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      haptic.light();
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      haptic.selection();
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSampleFile = (sample: typeof SAMPLE_BUSINESS_FILES[0]) => {
    haptic.selection();
    setUploadedFile({
      name: sample.name,
      size: sample.content.length,
      type: 'text/plain',
      text: sample.content
    });
    setError(null);
  };

  // Local preset keyword matcher (ultra-fast zero-latency offline fallback)
  const matchPresetLocally = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('water heater') || lower.includes('leak') || lower.includes('drain')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'plumbing') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('electric') || lower.includes('panel') || lower.includes('breaker') || lower.includes('ev charger') || lower.includes('wiring')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'electrical') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('msp') || lower.includes('managed it') || lower.includes('cloud') || lower.includes('helpdesk') || lower.includes('cyber')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'it_services') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('solar') || lower.includes('powerwall') || lower.includes('photovoltaic') || lower.includes('inverter')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'solar_cleanenergy') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') || lower.includes('personal train')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'fitness_gyms') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('pet') || lower.includes('dog') || lower.includes('groom') || lower.includes('vet') || lower.includes('canine')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'pet_care') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('event') || lower.includes('wedding') || lower.includes('catering') || lower.includes('banquet') || lower.includes('av ')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'event_production') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('dental') || lower.includes('dentist') || lower.includes('hygiene') || lower.includes('teeth')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'dental_practices') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('hvac') || lower.includes('ac ') || lower.includes('air conditioning') || lower.includes('furnace') || lower.includes('heating')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'hvac') || INDUSTRY_PRESETS[5];
    }
    if (lower.includes('roof') || lower.includes('gutter') || lower.includes('shingle')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'roofing') || INDUSTRY_PRESETS[6];
    }
    if (lower.includes('clean') || lower.includes('maid') || lower.includes('sanitat') || lower.includes('janitor')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'cleaning') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('paint') || lower.includes('stain') || lower.includes('drywall')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'painting') || INDUSTRY_PRESETS[3];
    }
    if (lower.includes('lawn') || lower.includes('mow') || lower.includes('landscap') || lower.includes('tree')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'landscaping') || INDUSTRY_PRESETS[2];
    }
    if (lower.includes('auto') || lower.includes('mechanic') || lower.includes('brake') || lower.includes('car ')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'auto_services') || INDUSTRY_PRESETS[8];
    }
    if (lower.includes('marketing') || lower.includes('ad ') || lower.includes('campaign') || lower.includes('seo')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'marketing_creative') || INDUSTRY_PRESETS[0];
    }
    if (lower.includes('construct') || lower.includes('contractor') || lower.includes('framing')) {
      return INDUSTRY_PRESETS.find(p => p.id === 'construction') || INDUSTRY_PRESETS[7];
    }
    return INDUSTRY_PRESETS.find(p => p.id === 'general_small_business') || INDUSTRY_PRESETS[11];
  };

  // Run AI Onboarding Agent Analysis (from either file or manual inputs)
  const handleStartAnalysis = async () => {
    let rawContent = '';
    let fileName = '';
    let fileType = '';
    let fileBase64 = '';

    if (inputMode === 'upload') {
      if (!uploadedFile) {
        setError('Please upload a business file or tap one of the sample business files below.');
        return;
      }
      rawContent = uploadedFile.text;
      fileName = uploadedFile.name;
      fileType = uploadedFile.type;
      fileBase64 = uploadedFile.base64 || '';
    } else {
      if (!businessName.trim() && !businessDescription.trim()) {
        setError('Please enter your business name or describe your services.');
        return;
      }
      rawContent = `Business Name: ${businessName}\nServices & Description: ${businessDescription}`;
      fileName = 'manual_business_profile.txt';
      fileType = 'text/plain';
    }

    setError(null);
    setLoading(true);
    setStep('detecting');
    await haptic.medium();

    try {
      // Send document payload to AI Onboarding Agent endpoint
      const result = await apiFetch<any>('/api/business/analyze-document', {
        method: 'POST',
        body: JSON.stringify({
          fileText: rawContent,
          fileName,
          fileType,
          fileBase64: fileBase64 || undefined
        })
      });

      if (result && result.industryId) {
        const matched = INDUSTRY_PRESETS.find(p => p.id === result.industryId) || matchPresetLocally(rawContent);
        
        setDetectedIndustryId(matched.id);
        setDetectedIndustryName(matched.name);
        setConfidenceScore(result.confidence || 0.96);
        setAgentReasoning(result.reasoning || `Deciphered from business profile: ${matched.description}`);
        
        if (result.businessName && !businessName.trim()) {
          setBusinessName(result.businessName);
        } else if (!businessName.trim()) {
          setBusinessName(result.businessName || `${matched.name.split('&')[0].trim()} Solutions`);
        }

        if (Array.isArray(result.extractedServices) && result.extractedServices.length > 0) {
          setDetectedServices(result.extractedServices);
        } else {
          setDetectedServices(matched.defaultServices);
        }

        if (Array.isArray(result.keyInsights) && result.keyInsights.length > 0) {
          setKeyInsights(result.keyInsights);
        }

        setBrandTone(result.recommendedTone || matched.recommendedTone);
        setTechnicianRoleName(result.technicianRoleName || matched.technicianRoleName || 'Field Specialist');
        setDollarThreshold(typeof result.dollarThreshold === 'number' ? result.dollarThreshold : 1250);
      } else {
        // Local fallback
        const local = matchPresetLocally(rawContent);
        setDetectedIndustryId(local.id);
        setDetectedIndustryName(local.name);
        setConfidenceScore(0.92);
        setAgentReasoning(`Matched from operational text: ${local.description}`);
        setDetectedServices(local.defaultServices);
        setBrandTone(local.recommendedTone);
        setTechnicianRoleName(local.technicianRoleName || 'Field Specialist');
      }
    } catch (err) {
      console.warn('AI Onboarding Agent fallback:', err);
      const local = matchPresetLocally(rawContent);
      setDetectedIndustryId(local.id);
      setDetectedIndustryName(local.name);
      setConfidenceScore(0.90);
      setAgentReasoning(`Matched core operational traits: ${local.description}`);
      setDetectedServices(local.defaultServices);
      setBrandTone(local.recommendedTone);
      setTechnicianRoleName(local.technicianRoleName || 'Field Specialist');
    } finally {
      // Simulate smooth step progression completion
      setTimeout(async () => {
        setLoading(false);
        setStep('review');
        await haptic.success();
      }, 1000);
    }
  };

  // User manually switches preset if desired
  const handleSelectDifferentPreset = (preset: typeof INDUSTRY_PRESETS[0]) => {
    haptic.selection();
    setDetectedIndustryId(preset.id);
    setDetectedIndustryName(preset.name);
    setDetectedServices(preset.defaultServices);
    setBrandTone(preset.recommendedTone);
    setTechnicianRoleName(preset.technicianRoleName || 'Field Specialist');
    setAgentReasoning(`Manually verified & selected by user: Configured for ${preset.name}.`);
    setConfidenceScore(1.0);
    setIsChangingPreset(false);
  };

  const handleAddService = () => {
    if (newServiceTag.trim()) {
      haptic.light();
      setDetectedServices(prev => [...prev, newServiceTag.trim()]);
      setNewServiceTag('');
    }
  };

  const handleRemoveService = (indexToRemove: number) => {
    haptic.light();
    setDetectedServices(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleEmployee = (employeeKey: string) => {
    haptic.selection();
    setActiveEmployees(prev => ({
      ...prev,
      [employeeKey]: !prev[employeeKey]
    }));
  };

  // Final User Approval & Launch Workspace
  const handleApproveAndLaunch = async () => {
    setLoading(true);
    await haptic.success();

    const finalName = businessName.trim() || `${detectedIndustryName.split('&')[0].trim()} Solutions`;

    const businessPayload: BusinessAccount = {
      id: initialBusiness?.id || `biz_${Date.now()}`,
      name: finalName,
      industry: detectedIndustryId,
      size: 'Solo Operator / Small Team (1-5)',
      services: detectedServices,
      pricingApproach: 'Flat-rate standard ratecard & hourly dispatch',
      brandTone,
      painPoints: ['Emergency dispatch delays', 'Off-hours voice phone triage', 'Estimating turnaround'],
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

      // Synchronize with server backend and Firestore
      await apiFetch('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(businessPayload)
      }).catch(() => null);

      await firestoreService.saveBusiness(businessPayload).catch(() => null);

      onComplete(businessPayload);
    } catch (e) {
      console.warn('Onboarding completion sync notice:', e);
      onComplete(businessPayload);
    } finally {
      setLoading(false);
    }
  };

  // Filter presets for the preset selection dialog
  const filteredPresets = INDUSTRY_PRESETS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
                          p.description.toLowerCase().includes(presetSearch.toLowerCase()) ||
                          p.defaultServices.some(s => s.toLowerCase().includes(presetSearch.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'trades') {
      return ['plumbing', 'electrical', 'hvac', 'roofing', 'painting', 'landscaping', 'handyman', 'pressure_washing', 'construction'].includes(p.id);
    }
    if (selectedCategory === 'tech') {
      return ['it_services', 'marketing_creative', 'professional_services', 'legal_accounting', 'nonprofits'].includes(p.id);
    }
    if (selectedCategory === 'health') {
      return ['dental_practices', 'healthcare', 'fitness_gyms', 'pet_care', 'salons_spas'].includes(p.id);
    }
    if (selectedCategory === 'property') {
      return ['moving_storage', 'property_operations', 'real_estate', 'hospitality_rentals', 'solar_cleanenergy', 'security_locksmith'].includes(p.id);
    }
    if (selectedCategory === 'commerce') {
      return ['restaurants', 'retail_ecommerce', 'event_production', 'education_tutoring', 'auto_services'].includes(p.id);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <RCLogo variant="compact" />
            <div>
              <h1 className="text-xs font-bold text-white tracking-tight uppercase flex items-center gap-1.5">
                <span>RCOS Intelligent Onboarding</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-400 font-mono">32 PRESETS</span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono">AI Business Intake & Preset Calibrator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 font-bold">
              {step === 'input' ? 'Step 1: Intake' : step === 'detecting' ? 'Analyzing...' : 'Step 2: User Approval'}
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
                title="Close setup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: INTAKE (FILE UPLOAD OR MANUAL INPUT) */}
        {step === 'input' && (
          <div className="space-y-4 text-left">
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                How would you like to set up your business?
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Upload a company document to let the AI agent automatically decipher your trade, or enter your business information manually.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  setInputMode('upload');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  inputMode === 'upload'
                    ? 'bg-lime-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload Business File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  setInputMode('manual');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  inputMode === 'manual'
                    ? 'bg-lime-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Enter Manually</span>
              </button>
            </div>

            {/* TAB A: FILE UPLOAD OPTION */}
            {inputMode === 'upload' && (
              <div className="space-y-3.5">
                {/* Drag & Drop Upload Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    isDragging
                      ? 'border-lime-400 bg-lime-500/10'
                      : uploadedFile
                      ? 'border-lime-500/50 bg-zinc-900/80'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/70'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.txt,.doc,.docx,.json,.csv,.md,.png,.jpg,.jpeg"
                    className="hidden"
                  />

                  {uploadedFile ? (
                    <div className="w-full flex items-center justify-between gap-3 p-1">
                      <div className="flex items-center gap-3 min-w-0 text-left">
                        <div className="w-10 h-10 rounded-xl bg-lime-500/20 text-lime-400 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{uploadedFile.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {(uploadedFile.size / 1024).toFixed(1)} KB • Ready for AI Onboarding Agent
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                        }}
                        className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono shrink-0"
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 text-lime-400 flex items-center justify-center mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-white">
                        Drop your business file here, or <span className="text-lime-400 underline">browse</span>
                      </h3>
                      <p className="text-[10px] text-zinc-400 mt-1 max-w-xs font-mono">
                        Accepts invoices, proposals, service rate cards, price lists, or company overviews (.PDF, .TXT, .DOCX, .CSV)
                      </p>
                    </>
                  )}
                </div>

                {/* Instant Sample Business File Test Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                      Or tap a sample document to test the AI Agent:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {SAMPLE_BUSINESS_FILES.map((sample) => {
                      const isSelected = uploadedFile?.name === sample.name;
                      return (
                        <button
                          key={sample.name}
                          type="button"
                          onClick={() => handleLoadSampleFile(sample)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-lime-500/20 border-lime-500/60 text-lime-300 font-bold'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="text-[11px] font-bold truncate flex items-center gap-1">
                            <FileText className="w-3 h-3 shrink-0 text-lime-400" />
                            <span className="truncate">{sample.trade}</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 truncate mt-0.5">{sample.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB B: MANUAL BUSINESS PROFILE */}
            {inputMode === 'manual' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Business / Company Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex Mechanical & Electrical Solutions"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    What does your business do? (Services & Operations)
                  </label>
                  <textarea
                    rows={3}
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="Describe your primary services, customer calls, dispatch needs, or operational scope..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 resize-none"
                  />
                </div>

                {/* 1-Tap Trade Inspiration Chips */}
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                    Quick-fill by trade:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {quickTradeChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          if (!businessName) setBusinessName(`${chip.label.split('&')[0].trim()} Pros`);
                          setBusinessDescription(chip.query);
                        }}
                        className={`text-[10px] px-2.5 py-1.2 rounded-xl border transition-all cursor-pointer ${
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
            )}

            {/* Action CTA */}
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={loading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 fill-black" />
              <span>
                {inputMode === 'upload' 
                  ? 'Analyze Business File with AI Agent' 
                  : 'Analyze Business Information & Match Preset'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1.5: DETECTING / ANALYZING ANIMATION */}
        {step === 'detecting' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-lime-500/20 border border-lime-500/40 text-lime-400 flex items-center justify-center animate-pulse shadow-xl shadow-lime-500/10">
                <Bot className="w-8 h-8" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 border border-lime-500/40 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-sm font-extrabold text-white">
                {detectingStages[detectingStageIndex].title}
              </h3>
              <p className="text-xs text-zinc-400">
                {detectingStages[detectingStageIndex].desc}
              </p>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-lime-500 transition-all duration-500"
                  style={{ width: `${((detectingStageIndex + 1) / detectingStages.length) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>Intake</span>
                <span>Decipher</span>
                <span>Preset Match</span>
                <span>Approval</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: USER APPROVAL & REVIEW SCREEN */}
        {step === 'review' && (
          <div className="space-y-4 text-left">
            
            {/* MANDATORY USER APPROVAL NOTICE BANNER */}
            <div className="p-3 rounded-2xl bg-lime-500/10 border border-lime-500/30 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-left">
                <div className="text-xs font-extrabold text-white flex items-center gap-2">
                  <span>AI Agent Recommendation Awaiting Your Approval</span>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-300 font-bold">
                    {(confidenceScore * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  The AI Onboarding Agent analyzed your inputs and selected the preset below. You have full control to approve it or switch to any other preset before proceeding.
                </p>
              </div>
            </div>

            {/* DECIPHERED PRESET CARD WITH REASONING */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20">
                    Recommended Industry Preset
                  </span>
                  <h3 className="text-base font-extrabold text-white mt-1">
                    {detectedIndustryName}
                  </h3>
                </div>
                
                {/* Change Preset Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setIsChangingPreset(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[10.5px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-lime-400" />
                  <span>Change Preset</span>
                </button>
              </div>

              {/* Agent Reasoning Box */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800/80 text-[11px] text-zinc-300 space-y-1">
                <div className="flex items-center gap-1.5 text-lime-400 font-bold text-[10px] font-mono uppercase tracking-wider">
                  <Bot className="w-3 h-3" />
                  <span>Agent Reasoning & Clues:</span>
                </div>
                <p className="leading-relaxed">
                  {agentReasoning}
                </p>
              </div>

              {/* Key Insights (if available) */}
              {keyInsights.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Key Operational Insights:</span>
                  <div className="space-y-1">
                    {keyInsights.slice(0, 3).map((insight, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10.5px] text-zinc-300 font-mono">
                        <Check className="w-3 h-3 text-lime-400 shrink-0" />
                        <span className="truncate">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* EDITABLE BUSINESS SETTINGS */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter business name"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono mb-1">
                    Front-Line Role Title
                  </label>
                  <input
                    type="text"
                    value={technicianRoleName}
                    onChange={(e) => setTechnicianRoleName(e.target.value)}
                    placeholder="e.g. Journeyman Plumber"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Services Tags */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono mb-1.5">
                  Standard Services ({detectedServices.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {detectedServices.map((service, idx) => (
                    <span 
                      key={idx} 
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/80 flex items-center gap-1.5"
                    >
                      <span>{service}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(idx)}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newServiceTag}
                    onChange={(e) => setNewServiceTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddService())}
                    placeholder="Add custom service (press Enter)..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Safety Dollar Limit Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                    Autonomous Dollar Approval Limit:
                  </label>
                  <span className="text-xs font-bold text-lime-400 font-mono">${dollarThreshold}</span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="5000"
                  step="50"
                  value={dollarThreshold}
                  onChange={(e) => setDollarThreshold(Number(e.target.value))}
                  className="w-full accent-lime-400 cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block font-mono">
                  Expenses & quotes above ${dollarThreshold} require explicit human operator approval.
                </span>
              </div>
            </div>

            {/* AI WORKFORCE TOGGLE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-lime-400" />
                  <span>Preset Autonomous AI Team</span>
                </h4>
                <span className="text-[10px] text-zinc-400 font-mono">Toggle assistants</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'customer_service', label: '24/7 Voice Receptionist', icon: Phone, color: 'text-blue-400' },
                  { key: 'operations', label: 'Smart Job Dispatcher', icon: Briefcase, color: 'text-amber-400' },
                  { key: 'sales', label: 'Trade Estimator & Quotes', icon: Sparkles, color: 'text-emerald-400' },
                  { key: 'technician', label: technicianRoleName, icon: Wrench, color: 'text-orange-400' },
                  { key: 'finance', label: 'Invoicing & Ledger Auditor', icon: Sliders, color: 'text-purple-400' },
                  { key: 'executive_assistant', label: 'Operations & Safety Chief', icon: ShieldCheck, color: 'text-lime-400' }
                ].map((emp) => {
                  const isEnabled = !!activeEmployees[emp.key];
                  const Icon = emp.icon;
                  return (
                    <div
                      key={emp.key}
                      onClick={() => toggleEmployee(emp.key)}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isEnabled
                          ? 'bg-zinc-900 border-lime-500/40 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${emp.color}`} />
                        <span className="text-[11px] font-bold truncate">{emp.label}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 ${
                        isEnabled ? 'bg-lime-500 border-lime-400 text-black' : 'border-zinc-700'
                      }`}>
                        {isEnabled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MANDATORY USER APPROVAL ACTION BUTTONS */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleApproveAndLaunch}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Preset & Launch {businessName || 'Workspace'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-zinc-400 hover:text-white transition font-mono text-[11px] cursor-pointer"
                >
                  ← Back to Upload / Input
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangingPreset(true)}
                  className="text-lime-400 hover:underline transition font-mono text-[11px] cursor-pointer flex items-center gap-1"
                >
                  <span>Select different preset ({INDUSTRY_PRESETS.length} available)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL 32-PRESET SELECTOR MODAL / DIALOG */}
        {isChangingPreset && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-700 rounded-3xl p-5 shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col">
              
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Select Business Industry Preset</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Choose from 32 tailored operational configurations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingPreset(false)}
                  className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    placeholder="Search trade, service, or industry keyword..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {PRESET_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer border ${
                        selectedCategory === cat.id
                          ? 'bg-lime-500/20 text-lime-400 border-lime-500/40 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredPresets.map((preset) => {
                  const isCurrent = detectedIndustryId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectDifferentPreset(preset)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-lime-500/10 border-lime-500/50 text-white'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-extrabold text-white flex items-center gap-2">
                          <span>{preset.name}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-lime-500 text-black font-extrabold">
                              CURRENT
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {preset.technicianRoleName || 'Specialist'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mb-2">
                        {preset.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preset.defaultServices.slice(0, 3).map((s, idx) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsChangingPreset(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
