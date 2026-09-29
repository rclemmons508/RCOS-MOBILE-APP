import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  Search, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Sparkles, 
  BookOpen, 
  Terminal, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Users, 
  Briefcase, 
  FileCode,
  ArrowRight
} from 'lucide-react';

interface DocItem {
  id: string;
  category: 'Core' | 'AutomationEngine' | 'Employees' | 'IndustryPresets' | 'ClientFacing' | 'Onboarding' | 'SystemAssets';
  title: string;
  filename: string;
  summary: string;
  tags: string[];
  content: string;
}

export const RcosSystemDocsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('core-routing');
  const [copied, setCopied] = useState(false);

  const categories = [
    'All',
    'Core',
    'AutomationEngine',
    'Employees',
    'IndustryPresets',
    'ClientFacing',
    'Onboarding',
    'SystemAssets'
  ];

  const DOCS_DATABASE: DocItem[] = [
    {
      id: 'core-system-manual',
      category: 'Core',
      title: 'RCOS Master System Manual',
      filename: 'Master_System_Manual.pdf',
      summary: 'Architectural overview of RC Solutions Remote Operations Operating System, detailing neural orchestration, offline cache, and dual-layer security.',
      tags: ['Manual', 'Architecture', 'Overview', 'Core'],
      content: `# RC Solutions - RCOS Master System Manual
Version: 4.0.0-PRO | Author: RC Solutions Engineering Team
Slogan: "AUTOMATE. OPTIMIZE. GROW."

## 1. System Overview
RCOS (Remote Operations Operating System) is a complete full-stack enterprise platform designed to run local and commercial service businesses autonomously. Built with a 16-worker AI workforce, automated field job dispatching, 24/7 inbound voice AI handling, client CRM nurture, and Human-In-The-Loop (HITL) safety ceilings.

## 2. Core Pillars
1. Master Routing Engine: Categorizes every input into high/medium/low risk workflows.
2. Voice AI Phone Agent: Handles 24/7 calls, parses intent, and creates work orders.
3. Smart Dispatch Router: Allocates technicians by geographic distance and skill matching.
4. Client Nurture CRM: Calculates account health (0-100%) and triggers automated follow-ups.
5. HITL Guardrail Engine: Any financial commitment over threshold requires owner sign-off.`
    },
    {
      id: 'core-routing',
      category: 'Core',
      title: 'Master Routing Engine',
      filename: 'Master_Routing_Engine.pdf',
      summary: 'Intent classification matrix and sub-agent delegation logic mapping user/client inputs to appropriate AI workforce workers.',
      tags: ['Routing', 'Engine', 'Delegation', 'Logic'],
      content: `# RCOS Master Routing Engine
Classification & Delegation Algorithm

## Sub-Agent Delegation Matrix:
1. Inbound Call / Voice / Spoken Inquiry -> Voice AI Receptionist (Ava Sterling)
2. Estimate / Line-item Quote / Pricing -> Sales & Estimator (Jordan Hayes)
3. Crew Scheduling / Dispatch / Route -> Operations Dispatcher (Marcus Brody)
4. Multi-Stage Complex Projects -> Project Manager (Elena Rostova)
5. Invoicing / Payment / Deposit -> Finance Director (Arthur Sterling)
6. Complaint / Reminder / Check-in -> Customer Care Specialist (Chloe Rivera)
7. Onboarding / Policies / Staff -> HR & Compliance Lead (Maya Lin)
8. Technical / Infrastructure / API -> Systems Engineer (Alex Rivera)
9. Weekly Metrics / Bottlenecks -> Business Analyst (David Ortiz)
10. High-Stakes / Multi-Dept -> Executive Assistant (Morgan Vance)`
    },
    {
      id: 'core-trigger-map',
      category: 'Core',
      title: 'Master Trigger Map',
      filename: 'Master_Trigger_Map.pdf',
      summary: 'Comprehensive event trigger catalog linking system events, webhooks, voice calls, and client actions to automated workflows.',
      tags: ['Triggers', 'Webhooks', 'Events', 'Workflows'],
      content: `# RCOS Master Trigger Map
Event-Driven Automation Specs

## Trigger Catalog:
• TRIGGER_CALL_INBOUND: Activates Voice AI pipeline; synthesizes greeting; logs real-time transcript.
• TRIGGER_REQUEST_SUBMITTED: Ingests portal form; runs qualification; routes to Sales/Ops.
• TRIGGER_QUOTE_APPROVED: Moves job to Execution stage; creates crew calendar event.
• TRIGGER_THRESHOLD_EXCEEDED: Pauses autonomous execution; generates approval queue ticket.
• TRIGGER_PAYMENT_DUE: Sends polite automated reminder SMS; updates CRM health score.
• TRIGGER_SLA_BREACH_WARNING: Escalates priority to Critical; alerts Executive Assistant.`
    },
    {
      id: 'core-workflow-arch',
      category: 'Core',
      title: 'Master Workflow Architecture',
      filename: 'Master_Workflow_Architecture.pdf',
      summary: 'End-to-end 6-stage operational pipeline: Intake -> Qualification -> Routing -> Execution -> Follow-Up -> Completion.',
      tags: ['Workflows', 'Pipeline', 'Stages', 'Execution'],
      content: `# RCOS Master Workflow Architecture
The 6-Stage Operations Pipeline

1. INTAKE: Raw customer inquiry captured via voice phone, web portal, or text.
2. QUALIFICATION: Service matching, address validation, urgency tiering (Routine vs Emergency).
3. ROUTING: AI worker assignment and Job Pack checklist selection.
4. EXECUTION: 4-stage job sequence: Pre-Check -> Execute -> Cleanup -> Client Confirmation.
5. FOLLOW-UP: Automated SMS check-in, review request generation, and CRM health score boost.
6. COMPLETION: Invoice generation, payment receipt, and audit trace archival.`
    },
    {
      id: 'core-behavior-engine',
      category: 'Core',
      title: 'Core Behavior Engine & Safety Boundaries',
      filename: 'Core_Behavior_Engine_ _RCOS _System.pdf',
      summary: 'Autonomous vs Supervised modes, dollar thresholds ($100-$10,000+), risk categories, and anti-hallucination guardrails.',
      tags: ['Safety', 'Guardrails', 'Autonomy', 'Behavior'],
      content: `# RCOS Core Behavior Engine & Safety Boundaries
Risk Categories & Autonomy Ceilings

## Autonomy Modes:
• AUTONOMOUS: Routine drafts, scheduling, and standard tasks execute without manual intervention.
• SUPERVISED: Any high-risk or external action is queued in the Approval Queue for owner sign-off.

## Financial Risk Categories:
1. internal_draft: Always autonomous.
2. routine_outbound: Autonomous if under threshold.
3. commitment_outbound: Requires review if scope changes.
4. money_movement: STRICTLY requires owner sign-off if >= threshold.
5. system_settings: Requires administrator authorization.`
    },
    {
      id: 'installer-master',
      category: 'AutomationEngine',
      title: 'One-Click Master Installer PRO',
      filename: 'One Click_Master_Installer.pdf',
      summary: 'Production deployment script that bootstraps all 16 AI Agents, Firestore collections, trigger maps, and verified industry presets.',
      tags: ['Installer', 'Deployment', 'Script', 'Bootstrap'],
      content: `# RCOS One-Click Master Installer PRO
Automated Deployment Sequence

#!/usr/bin/env bash
# RC Solutions Master System Installer
echo "[RCOS] Starting One-Click Master System Provisioning..."
# 1. Environment & Node.js verification
# 2. Cloud Firestore Schema & Security Rules Deployment
# 3. Provisioning 16 AI Workers & Multi-Agent Network
# 4. Linking Master Trigger Map & Routing Engine
# 5. Initializing Preset Auto Loader ULTRA
# 6. Arming HITL 72% Confidence Intercept Ceiling
# 7. Activating Telemetry Audit Stream (SHA-256)
echo "[RCOS] 100% OPERATIONAL. System Seal Granted."`
    },
    {
      id: 'autoloader-ultra',
      category: 'AutomationEngine',
      title: 'Preset Auto Loader ULTRA & PRO',
      filename: 'Preset_Auto Loader_ULTRA.pdf',
      summary: 'Single-click dynamic loader switching between all 13+ industry presets, configuring services, workforce, and Job Packs.',
      tags: ['AutoLoader', 'Presets', 'Industries', 'ULTRA'],
      content: `# RCOS Preset Auto Loader ULTRA
Dynamic Industry Configuration

Supported Industry Presets:
1. Auto Services & Mobile Mechanics
2. Cleaning & Maid Services
3. Construction & Specialty Trades
4. General Small Business
5. Handyman & Home Repair
6. HVAC Services
7. Landscaping & Lawn Care
8. Painting & Staining
9. Pressure Washing & Soft Washing
10. Professional & Scientific Services
11. Real Estate & Property Management
12. Roofing & Gutters
13. Technical Services Add-On

Execution Hook:
autoLoader.loadPreset(presetId) -> Reconfigures activeEmployees, defaultServices, brandTone, and injects 4-stage Job Packs.`
    },
    {
      id: 'diagnostics-engine',
      category: 'AutomationEngine',
      title: 'RCOS Diagnostics Engine',
      filename: 'RCOS_Diagnostics_Engine.pdf',
      summary: 'Automated telemetry, cloud database verification, model health, and sub-agent integrity tests with 1-click self-repair.',
      tags: ['Diagnostics', 'Self-Repair', 'Health', 'Testing'],
      content: `# RCOS Diagnostics Engine
Automated Verification & Self-Healing

Tests Performed:
• AI Model Latency: Pings Google GenAI SDK (target: < 25ms).
• Cloud Firestore DB: Verifies database ID 'ai-studio-rcosremoteoperat' & collection schemas.
• 16-Agent Roster: Checks communication profiles and prompt readiness.
• HITL Guardrail: Verifies 72% confidence ceiling intercept trigger.
• Offline Sync: Validates local storage and cloud drift reconciliation.`
    },
    {
      id: 'employee-role-matrix',
      category: 'Employees',
      title: 'Employee Role Matrix & Roster',
      filename: 'Employee_Role_Matrix.pdf',
      summary: 'Comprehensive roster of all 16 AI employees, detailing departments, core jobs, escalation paths, and system prompts.',
      tags: ['Employees', 'Roles', 'Matrix', 'Workforce'],
      content: `# RCOS Employee Role Matrix (16 Agents)

1. Alex Rivera: Systems Engineer (Engineering) - System infrastructure & IPC
2. Morgan Vance: Executive Assistant (Executive) - Operations Chief & Guardian
3. Julian Vance: CEO Assistant (Executive) - Strategic Dispatch & Briefings
4. Cipher Reed: Automation Specialist (Technology) - Workflow & Webhook logic
5. Elena Rostova: Project Manager (Management) - Field & Crew Supervision
6. Arthur Sterling: Finance Director (Finance) - Billing, Invoices & Margin Audit
7. Maya Lin: HR & Compliance (Human Resources) - Onboarding & Policies
8. Marcus Brody: Operations Dispatcher (Operations) - Logistics & Scheduling
9. Jordan Hayes: Sales & Estimator (Sales) - Discovery, Quotes & Proposals
10. Chloe Rivera: Customer Care (Support) - Inquiries, Reviews & Reminders
11. Jack Kowalski: Lead Field Specialist (Field) - Job Pack Checklist execution
12. Sienna Blake: Marketing Specialist (Marketing) - Local Campaigns & Promos
13. Tessa Vance: Operations Admin (Admin) - Complete Records & Filing
14. David Ortiz: Business Analyst (Analytics) - KPI Summaries & Insights
15. Ava Sterling: AI Receptionist (Voice) - 24/7 Phone IVR & Call Intake
16. Oliver Chase: Email Assistant (Admin) - Inbox Zero & Email Triage`
    },
    {
      id: 'employee-comm-profiles',
      category: 'Employees',
      title: 'Employee Communication Profiles',
      filename: 'Employee_Communication_Profiles.pdf',
      summary: 'Tone, vocabulary, response format, and conversational style guidelines for every role on the team.',
      tags: ['Communication', 'Tone', 'Voice', 'Persona'],
      content: `# Employee Communication Profiles

• Executive Assistant (Morgan): Concise, authoritative, protective of owner time.
• Finance Director (Arthur): Exact, analytical, security-first, numerical.
• Sales & Estimator (Jordan): Enthusiastic, persuasive, transparent line items.
• Customer Care (Chloe): Warm, reassuring, attentive, patient.
• AI Receptionist (Ava): Clear, articulate, emergency-aware, prompt.
• Project Manager (Elena): Structured, milestone-driven, clear timelines.`
    },
    {
      id: 'prompt-library',
      category: 'SystemAssets',
      title: 'RCOS Prompt Library',
      filename: 'RCOS_Prompt_Library.pdf',
      summary: 'Curated library of high-performance system instructions, quotation prompts, follow-up templates, and dispatch scripts.',
      tags: ['Prompts', 'Library', 'Templates', 'Scripts'],
      content: `# RCOS Pre-Engineered Prompt Library

### 1. Emergency Dispatch Prompt:
"Analyze caller input for urgent hazard indicators. If power loss, active water leak, or safety breach is detected, trigger priority CRITICAL and dispatch nearest certified technician within 45-minute SLA."

### 2. High-Converting Quote Proposal:
"Generate itemized quotation for [Service] for client [Name]. Include scope of work, labor breakdown, materials, required deposit percentage (20%), and 30-day price lock guarantee."

### 3. Review Generation Follow-Up SMS:
"Hi [Name], thank you for choosing [Business Name]! Our technician [Tech Name] completed [Service] today. Would you take 30 seconds to share your experience? [Review Link]"`
    },
    {
      id: 'marketing-sales-scripts',
      category: 'SystemAssets',
      title: 'Marketing & Sales Scripts',
      filename: 'Marketing_Scripts',
      summary: 'Cold outreach sequences, quote follow-ups, objection handling, and customer review campaigns tailored for small businesses.',
      tags: ['Sales', 'Marketing', 'Scripts', 'Closing'],
      content: `# RCOS Marketing & Sales Scripts

### Script A: 24-Hour Estimate Follow-Up
"Hi [Name], Jordan from [Business Name] here. Just checking in to see if you had any questions on the [Service] estimate we sent over yesterday. We have a crew slot open this Thursday if you'd like us to lock that in for you!"

### Script B: Seasonal Preventative Tune-Up Promo
"Special Announcement from [Business Name]: Protect your property before peak season! Book your [Service] this week and receive our full 21-point safety inspection at zero additional cost."`
    },
    {
      id: 'client-onboarding-packet',
      category: 'ClientFacing',
      title: 'Client Onboarding Packet & Welcome Sequence',
      filename: 'Copy of Client_Onboarding_Packet.pdf',
      summary: 'Standardized client welcome sequence, communications agreement, service level agreements (SLA), and payment expectations.',
      tags: ['Client', 'Onboarding', 'Welcome', 'SLA'],
      content: `# Client Onboarding Packet & Welcome Sequence

## Welcome to RC Solutions
We look forward to powering your operational infrastructure!

### What You Can Expect:
1. Automated Confirmation: You will receive real-time SMS updates whenever a job is booked or dispatched.
2. Clear Upfront Pricing: All quotes specify exact labor, materials, and terms before work commences.
3. 24/7 Voice AI Support: Our inbound phone assistant answers immediately, anytime day or night.
4. Guaranteed Workmanship: Every service is completed according to strict standardized Job Pack checklists.`
    },
    {
      id: 'internal-launch-manual',
      category: 'Onboarding',
      title: 'RCOS Internal Launch Manual',
      filename: 'Internal_Launch_Manual',
      summary: 'Operational guide for commissioning RCOS inside a new company within 24 hours with zero downtime.',
      tags: ['Launch', 'Onboarding', 'Guide', 'Internal'],
      content: `# RCOS Internal Launch Manual
24-Hour Deployment & Commissioning

Step 1: Run One-Click Master Installer.
Step 2: Load Industry Preset via Preset Auto Loader ULTRA.
Step 3: Connect Google Services & Firestore database.
Step 4: Set Owner Dollar Threshold ($250 to $2,500).
Step 5: Publish Customer Request Portal link.
Step 6: Test Inbound Phone Simulation and verify auto-dispatch.`
    }
  ];

  const filteredDocs = DOCS_DATABASE.filter(doc => {
    const matchesCat = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const activeDoc = DOCS_DATABASE.find(d => d.id === selectedDocId) || DOCS_DATABASE[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeDoc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.filename.replace('.pdf', '.md');
    a.click();
  };

  return (
    <div className="space-y-4 pb-12 max-w-full overflow-x-hidden text-zinc-100">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                RCOS System Architecture & Docs
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                100+ Core Files
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Interactive explorer for all Core, Automation, Employee, Preset, and Client documentation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-black border border-zinc-800 text-zinc-300 font-mono flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-lime-400" />
            <span>Full Markdown Specs</span>
          </span>
        </div>
      </div>

      {/* Search & Category Filter Ribbon */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search RCOS manuals, routing engines, prompts, scripts, or employee profiles..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split View: Left Document List, Right Full Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Documents List */}
        <div className="lg:col-span-5 space-y-2 max-h-[620px] overflow-y-auto pr-1 no-scrollbar">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === activeDoc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer text-left space-y-1.5 ${
                  isSelected
                    ? 'bg-zinc-900 border-purple-500/50 shadow-md shadow-purple-500/10'
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-400' : 'text-zinc-500'}`} />
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-black text-zinc-400 font-mono shrink-0">
                    {doc.category}
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {doc.summary}
                </p>

                <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-500 font-mono">
                  <span className="truncate">{doc.filename}</span>
                  <span className="text-purple-400 font-semibold flex items-center gap-0.5">
                    View <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Full Markdown Spec Viewer */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800/90 flex flex-col h-[620px] shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{activeDoc.title}</h3>
                <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 font-mono">
                  {activeDoc.category}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono truncate block mt-0.5">{activeDoc.filename}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Copy Markdown"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                title="Download Document"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Document Content View */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 my-2 rounded-2xl bg-black border border-zinc-900 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap no-scrollbar">
            {activeDoc.content}
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-900 text-[10px] shrink-0 font-mono">
            <span className="text-zinc-500">TAGS:</span>
            {activeDoc.tags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
