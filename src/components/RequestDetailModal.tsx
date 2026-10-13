import React from 'react';
import {
  X,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  Inbox,
  Tag,
  CalendarDays,
  User,
  ChevronRight,
} from 'lucide-react';
import { CustomerRequest } from '../types';
import { haptic } from '../utils/haptics';

interface RequestDetailModalProps {
  request: CustomerRequest | null;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function slaBadge(req: CustomerRequest): { label: string; className: string } {
  const urgent = req.urgency === 'urgent' || req.urgency === 'emergency';
  const limitMs = urgent ? 8 * 3600 * 1000 : 24 * 3600 * 1000;
  const elapsed = Date.now() - new Date(req.createdAt).getTime();
  const breached = elapsed > limitMs;
  if (breached)
    return { label: 'Overdue', className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' };
  if (urgent)
    return { label: 'Same-day', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
  return { label: '24h', className: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({ request, onClose }) => {
  if (!request) return null;

  const sla = slaBadge(request);
  const phone = (request.customerPhone || '').trim();
  const email = (request.customerEmail || '').trim();
  const hasContact = phone.length > 0 || email.length > 0;

  const tap = () => haptic.light();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-zinc-800">
          <Inbox className="w-5 h-5 text-lime-400" />
          <div className="text-base font-extrabold text-white">Request details</div>
          <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${sla.className}`}>
            {sla.label}
          </span>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-2 rounded-xl bg-zinc-900 text-zinc-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-500" />
              <span className="text-lg font-extrabold text-white">{request.customerName || 'Unknown'}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Received {timeAgo(request.createdAt)}</span>
              {request.stage && <span>· {request.stage}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Contact</div>
            {!hasContact && (
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                No contact info was left with this request.
              </div>
            )}
            {phone.length > 0 && (
              <a
                href={`tel:${encodeURIComponent(phone)}`}
                onClick={tap}
                className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 active:border-lime-500/50"
              >
                <span className="p-2 rounded-xl bg-lime-500/10 text-lime-400">
                  <Phone className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Phone</span>
                  <span className="block text-sm font-bold text-white truncate">{phone}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto shrink-0" />
              </a>
            )}
            {email.length > 0 && (
              <a
                href={`mailto:${encodeURIComponent(email)}`}
                onClick={tap}
                className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 active:border-lime-500/50"
              >
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Mail className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email</span>
                  <span className="block text-sm font-bold text-white truncate">{email}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto shrink-0" />
              </a>
            )}
          </div>

          {request.description && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">What they asked for</div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                {request.description}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {request.serviceType && (
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  <Tag className="w-3 h-3" /> Type
                </div>
                <div className="mt-1 text-xs font-bold text-white">{request.serviceType}</div>
              </div>
            )}
            {(request.preferredDateTime || request.preferredTime) && (
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  <CalendarDays className="w-3 h-3" /> Preferred time
                </div>
                <div className="mt-1 text-xs font-bold text-white">{request.preferredDateTime || request.preferredTime}</div>
              </div>
            )}
          </div>

          {hasContact && (
            <div className="flex gap-2 pb-1">
              {phone.length > 0 && (
                <a
                  href={`tel:${encodeURIComponent(phone)}`}
                  onClick={tap}
                  className="flex-1 py-2.5 rounded-xl bg-lime-500 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
              {phone.length > 0 && (
                <a
                  href={`sms:${encodeURIComponent(phone)}`}
                  onClick={tap}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Text
                </a>
              )}
              {email.length > 0 && (
                <a
                  href={`mailto:${encodeURIComponent(email)}`}
                  onClick={tap}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
