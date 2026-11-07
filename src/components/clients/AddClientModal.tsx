import React, { useRef, useState } from 'react';
import { Client } from '../../types';
import { apiFetch } from '../../lib/api';
import { UserPlus, Building2, Phone, Mail, CheckCircle2, X, Upload, FileText, Loader2, Sparkles } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (client: Client) => void;
  initialClient?: Client | null;
}

// Response contract for POST /api/business/analyze-document with mode: 'client'.
// Only fields actually stated in the file/text come back — anything missing
// stays empty and is reported as missing, never invented.
interface AnalyzeClientResponse {
  source: 'llm' | 'fallback';
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  found?: string[];
}

interface StagedClientFile {
  name: string;
  type: string;
  text: string;
  base64: string;
}

const CLIENT_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const CLIENT_PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

// Last-resort local read for pasted/uploaded TEXT when the server check
// itself fails (offline, timeout). Same honesty rule: only what the text
// actually contains — email and phone by pattern, nothing guessed.
function extractClientDetailsLocally(text: string): { phone?: string; email?: string } {
  const email = text.match(CLIENT_EMAIL_RE)?.[0]?.trim();
  const phoneHit = text.match(CLIENT_PHONE_RE);
  let phone: string | undefined;
  if (phoneHit) {
    const idx = text.indexOf(phoneHit[0]);
    const before = idx > 0 ? text[idx - 1] : '';
    const after = idx + phoneHit[0].length < text.length ? text[idx + phoneHit[0].length] : '';
    if (!/\d/.test(before) && !/\d/.test(after)) {
      phone = phoneHit[0].trim().replace(/[.,;]+$/, '') || undefined;
    }
  }
  return { phone, email };
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

  // ---- Fill from a file or pasted text ----
  const [fillMode, setFillMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [stagedFile, setStagedFile] = useState<StagedClientFile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fillNote, setFillNote] = useState<{ kind: 'ok' | 'partial' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (isOpen) {
      setFillMode('upload');
      setPastedText('');
      setStagedFile(null);
      setFillNote(null);
      setAnalyzing(false);
    }
  }, [initialClient, isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setFillNote(null);
    const lowerName = file.name.toLowerCase();
    const isText =
      file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv');
    const reader = new FileReader();
    reader.onerror = () => {
      setStagedFile(null);
      setFillNote({
        kind: 'error',
        text: `Couldn't read "${file.name}". Try again, or paste the details instead.`,
      });
    };
    if (isText) {
      reader.onload = (e) => {
        setStagedFile({
          name: file.name,
          type: file.type || 'text/plain',
          text: (e.target?.result as string) || '',
          base64: '',
        });
      };
      reader.readAsText(file);
    } else {
      // Binary file (PDF, Word, image): send the real bytes as base64 and
      // let the server parse them. Never read them as text (raw ZIP bytes).
      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        setStagedFile({
          name: file.name,
          type:
            file.type ||
            (lowerName.endsWith('.pdf')
              ? 'application/pdf'
              : lowerName.endsWith('.docx') || lowerName.endsWith('.doc')
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'image/jpeg'),
          text: '',
          base64: dataUrl.split(',')[1] || '',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Fill only fields that are still empty — anything already typed stays.
  // Reports exactly what was filled and what is still needed.
  const applyExtracted = (
    ex: { companyName?: string; contactName?: string; phone?: string; email?: string; notes?: string },
    sourceNote: string
  ) => {
    const filled: string[] = [];
    const stillMissing: string[] = [];
    const consider = (
      label: string,
      value: string | undefined,
      current: string,
      setter: (v: string) => void
    ) => {
      if (value && !current.trim()) {
        setter(value);
        filled.push(label);
      } else if (!current.trim()) {
        stillMissing.push(label);
      }
    };
    consider('Company', ex.companyName, company, setCompany);
    consider('Contact name', ex.contactName, name, setName);
    consider('Phone', ex.phone, phone, setPhone);
    consider('Email', ex.email, email, setEmail);
    consider('Notes', ex.notes, notes, setNotes);
    if (filled.length === 0) {
      setFillNote({
        kind: 'partial',
        text: `${sourceNote}Nothing in there I could use — ${stillMissing.length > 0 ? stillMissing.join(', ') : 'the details'} still needed. Type them in below.`,
      });
      return;
    }
    setFillNote({
      kind: stillMissing.length > 0 ? 'partial' : 'ok',
      text: `${sourceNote}Filled in: ${filled.join(', ')}. ${
        stillMissing.length > 0
          ? `Still needed: ${stillMissing.join(', ')} — add them below.`
          : 'Check the details below before saving.'
      }`,
    });
  };

  const handleAutoFill = async () => {
    const isPaste = fillMode === 'paste';
    const text = isPaste ? pastedText : stagedFile?.text || '';
    const fileName = isPaste ? 'pasted_client_info.txt' : stagedFile?.name || '';
    const fileType = isPaste ? 'text/plain' : stagedFile?.type || 'text/plain';
    const fileBase64 = isPaste ? '' : stagedFile?.base64 || '';
    if (isPaste && !pastedText.trim()) {
      setFillNote({ kind: 'error', text: 'Paste the client details first, then tap Fill in details.' });
      return;
    }
    if (!isPaste && !stagedFile) {
      setFillNote({ kind: 'error', text: 'Choose a client file first, then tap Fill in details.' });
      return;
    }
    setAnalyzing(true);
    setFillNote(null);
    try {
      // Same AI analysis the business onboarding uses, in client mode:
      // POST /api/business/analyze-document { ..., mode: 'client' }.
      // 60s, not the 15s apiFetch default: slow answers take up to ~27s.
      const result = await apiFetch<AnalyzeClientResponse>('/api/business/analyze-document', {
        method: 'POST',
        timeoutMs: 60000,
        body: JSON.stringify({
          fileText: text,
          fileName,
          fileType,
          fileBase64: fileBase64 || undefined,
          mode: 'client',
        }),
      });
      const sourceNote =
        result?.source === 'llm'
          ? ''
          : 'Offline read — the AI was unavailable, so I filled what the file states directly. ';
      applyExtracted(
        {
          companyName: result?.companyName,
          contactName: result?.contactName,
          phone: result?.phone,
          email: result?.email,
          notes: result?.notes,
        },
        sourceNote
      );
    } catch {
      // Server check failed outright — last resort: read phone/email
      // straight from the text we already have (paste, or a text file).
      // Binary files have no readable text here, so there is nothing
      // local to fall back to.
      const local = text ? extractClientDetailsLocally(text) : {};
      if (local.phone || local.email) {
        applyExtracted(local, "The AI check didn't reach the server — filled what I could find directly. ");
      } else {
        setFillNote({
          kind: 'error',
          text: "Couldn't read that right now. Check your connection and try again, or type the details in below.",
        });
      }
    } finally {
      setAnalyzing(false);
    }
  };

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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">{initialClient ? 'Edit Client Account' : 'Onboard New Client'}</h3>
          </div>
          <button aria-label="Close"
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
            {/* Fill from a file or pasted text */}
            <div className="rounded-2xl border border-lime-500/20 bg-lime-500/5 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-bold text-lime-300">Fill from a file or pasted text</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Upload a client file or paste their details — the app fills in the form below. Check everything before saving.
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFillMode('upload')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${fillMode === 'upload' ? 'bg-lime-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                >
                  Upload a file
                </button>
                <button
                  type="button"
                  onClick={() => setFillMode('paste')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${fillMode === 'paste' ? 'bg-lime-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                >
                  Paste text
                </button>
              </div>
              {fillMode === 'upload' ? (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.text,.csv,.pdf,.doc,.docx,image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleFileSelect(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:border-lime-500/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-zinc-500" />
                    {stagedFile ? 'Choose a different file' : 'Choose a client file (.txt, .pdf, .docx, image)'}
                  </button>
                  {stagedFile && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{stagedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setStagedFile(null)}
                        className="text-zinc-500 hover:text-white shrink-0 cursor-pointer"
                        aria-label="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors resize-none placeholder:text-zinc-600 font-sans"
                  placeholder="Paste the client's business info — company, contact, phone, email, anything else..."
                />
              )}
              <button
                type="button"
                onClick={handleAutoFill}
                disabled={analyzing || (fillMode === 'paste' ? !pastedText.trim() : !stagedFile)}
                className="w-full px-3 py-2 rounded-xl bg-lime-500 text-black font-bold text-xs hover:bg-lime-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reading…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Fill in details
                  </>
                )}
              </button>
              {fillNote && (
                <p
                  className={`text-[11px] leading-relaxed ${
                    fillNote.kind === 'error'
                      ? 'text-red-400'
                      : fillNote.kind === 'partial'
                        ? 'text-amber-300'
                        : 'text-lime-300'
                  }`}
                >
                  {fillNote.text}
                </p>
              )}
            </div>

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
