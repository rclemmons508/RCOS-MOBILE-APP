import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  AlertCircle,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles
} from 'lucide-react';
import { BusinessAccount, CustomerRequest } from '../types';
import { RCLogo } from './RCLogo';

interface PublicRequestPortalProps {
  business: BusinessAccount;
  onRequestSubmitted: (request: CustomerRequest) => void;
}

export const PublicRequestPortal: React.FC<PublicRequestPortalProps> = ({
  business,
  onRequestSubmitted
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [preferredContact, setPreferredContact] = useState<'phone' | 'email' | 'text'>('phone');
  const [serviceLocation, setServiceLocation] = useState('');
  const [serviceType, setServiceType] = useState(business.services[0] || 'Standard Service');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'soon' | 'urgent' | 'emergency'>('routine');
  const [preferredDateTime, setPreferredDateTime] = useState('');
  const [flexibility, setFlexibility] = useState('Within 1-2 days is fine');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [consent, setConsent] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<CustomerRequest | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/business/${business.id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          preferredContact,
          serviceLocation,
          serviceType,
          description,
          urgency,
          preferredDateTime: preferredDateTime || 'Next Available',
          flexibility,
          specialInstructions
        })
      });

      if (!res.ok) {
        throw new Error('Failed to submit request');
      }

      const savedRequest = await res.json();
      setSubmittedRequest(savedRequest);
      onRequestSubmitted(savedRequest);
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const portalUrl = `${window.location.origin}/#request-${business.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header and Share Link Banner */}
      <div className="p-4 md:p-5 rounded-2xl bg-[#0e1118] border border-[#1f2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Customer Intake Portal</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
              Live Link
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Share this link on your website, Google profile, or SMS. Inquiries immediately enter your RCOS Intake pipeline.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="px-3.5 py-2 rounded-xl bg-[#141822] hover:bg-[#1f273b] text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-[#273248] transition cursor-pointer self-start sm:self-center shrink-0"
        >
          {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Portal Link'}</span>
        </button>
      </div>

      {submittedRequest ? (
        <div className="p-8 rounded-3xl bg-[#0e1118] border border-[#21293a] text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] mx-auto glow-rc-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">Request Received Successfully!</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Thank you, {submittedRequest.customerName}. Your request has been logged into {business.name}'s system and routed to our team.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#21293a] text-left text-xs max-w-md mx-auto space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Service:</span>
              <span className="font-semibold text-white">{submittedRequest.serviceType}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Urgency:</span>
              <span className="capitalize font-mono text-[#00ff66]">{submittedRequest.urgency}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Pipeline Stage:</span>
              <span className="font-mono text-sky-400">{submittedRequest.stage}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSubmittedRequest(null);
                setCustomerName('');
                setDescription('');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#171d2b] hover:bg-[#20273a] text-white text-xs font-semibold cursor-pointer border border-[#29354d]"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      ) : (
        /* Public Customer Form */
        <div className="p-6 md:p-8 rounded-3xl bg-[#0e1118] border border-[#21293a] shadow-2xl space-y-6">
          <div className="border-b border-[#1f2638] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Request Service from {business.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Please provide details so we can quote or schedule your service quickly.</p>
            </div>
            <RCLogo size="sm" showText={false} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left text-xs">
            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Maria Rodriguez"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Preferred Contact Method</label>
                <select
                  value={preferredContact}
                  onChange={(e) => setPreferredContact(e.target.value as any)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00ff66]"
                >
                  <option value="phone">Phone Call</option>
                  <option value="text">Text / SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            {/* Service & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00ff66]"
                >
                  {business.services.map((svc, i) => (
                    <option key={i} value={svc}>{svc}</option>
                  ))}
                  <option value="Other / Custom Request">Other / Custom Request</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Service Location / Address</label>
                <input
                  type="text"
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  placeholder="Street address or neighborhood"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-medium text-slate-300 mb-1">Describe What You Need *</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us what you would like done, approximate square footage or scope, and any special issues..."
                className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
              />
            </div>

            {/* Urgency & Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00ff66]"
                >
                  <option value="routine">Routine (Next available)</option>
                  <option value="soon">Soon (This week)</option>
                  <option value="urgent">Urgent (Within 24-48 hrs)</option>
                  <option value="emergency">Emergency (Immediate)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Preferred Time Window</label>
                <input
                  type="text"
                  value={preferredDateTime}
                  onChange={(e) => setPreferredDateTime(e.target.value)}
                  placeholder="e.g. Tuesday mornings or After 3 PM"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Schedule Flexibility</label>
                <input
                  type="text"
                  value={flexibility}
                  onChange={(e) => setFlexibility(e.target.value)}
                  placeholder="e.g. Flexible +/- 2 days"
                  className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block font-medium text-slate-300 mb-1">Special Instructions (Access, Pets, Parking)</label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Gate code is #1234, friendly dog in yard, park in driveway"
                className="w-full bg-[#131722] border border-[#252f44] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff66]"
              />
            </div>

            {/* Consent */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="rounded accent-[#00ff66]"
              />
              <label htmlFor="consent" className="text-[11px] text-slate-400">
                I agree to be contacted by {business.name} regarding this service request.
              </label>
            </div>

            {/* Submit */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting || !consent}
                className="w-full py-3.5 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#00ff66]/20 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#090b0e]" />
                    <span>Transmitting to RCOS Intake Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Service Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
