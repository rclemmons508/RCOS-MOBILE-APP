import React, { useEffect, useState } from 'react';
import { asStringList } from '../utils/safeRender';

interface PublicBusiness {
  id: string;
  name: string;
  industry: string;
  services: string[];
  brandTone: string;
}

/** Customer-facing booking page, served at #/book/:businessId. No login needed. */
export const PublicBookingPage: React.FC = () => {
  const businessId = window.location.hash.replace('#/book/', '').split('?')[0].split('/')[0];
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent'>('routine');
  const [preferredTime, setPreferredTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setLoadError('This booking link looks incomplete.');
      setLoading(false);
      return;
    }
    fetch(`/api/public/business/${encodeURIComponent(businessId)}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((b: PublicBusiness) => {
        setBusiness(b);
        setService(b.services?.[0] || 'General Service');
        setLoading(false);
      })
      .catch(() => {
        setLoadError('We could not find this business. Please check the link and try again.');
        setLoading(false);
      });
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setSubmitError('Please add your name and a short description of what you need.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/business/${encodeURIComponent(businessId)}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          serviceType: service,
          description: description.trim(),
          urgency,
          preferredDateTime: preferredTime.trim() || 'Flexible / Next Available',
        }),
      });
      if (!res.ok) throw new Error('send failed');
      setDone(true);
    } catch {
      setSubmitError('Something went wrong sending your request. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500';

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <p className="text-sm text-zinc-400">Loading booking form…</p>
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-bold">Booking unavailable</h1>
          <p className="text-sm text-zinc-400">{loadError || 'Unknown error.'}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-lime-500/15 border border-lime-500/40 flex items-center justify-center">
            <svg className="w-7 h-7 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold">Request received!</h1>
          <p className="text-sm text-zinc-400">
            Thanks, {name.trim().split(' ')[0]}. {business.name} will get back to you
            {urgency === 'urgent' ? ' the same day' : ' within 24 hours'}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-5 py-8 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-lime-400 font-bold">{business.industry}</p>
          <h1 className="text-2xl font-extrabold">{business.name}</h1>
          <p className="text-sm text-zinc-400">Request service online — no account needed.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={inputCls} />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Service needed</label>
            {business.services.length > 0 ? (
              <select value={service} onChange={(e) => setService(e.target.value)} className={inputCls}>
                {asStringList(business.services).map((sv) => (
                  <option key={sv} value={sv}>{sv}</option>
                ))}
              </select>
            ) : (
              <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Service needed" className={inputCls} />
            )}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you need *"
            rows={4}
            className={`${inputCls} font-sans`}
          />

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">How urgent?</label>
            <div className="grid grid-cols-2 gap-2">
              {(['routine', 'urgent'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`p-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
                    urgency === u
                      ? u === 'urgent'
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-lime-500/10 border-lime-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {u === 'routine' ? 'Standard (24h)' : 'Urgent (same-day)'}
                </button>
              ))}
            </div>
          </div>

          <input
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            placeholder="Preferred day/time (optional)"
            className={inputCls}
          />

          {submitError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-extrabold text-sm transition cursor-pointer"
          >
            {submitting ? 'Sending…' : 'Request Service'}
          </button>
          <p className="text-[11px] text-zinc-500 text-center">
            Powered by {business.name} · We typically respond within 24 hours.
          </p>
        </form>
      </div>
    </div>
  );
};
