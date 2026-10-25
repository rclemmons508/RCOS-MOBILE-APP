import React, { useState, useEffect } from 'react';
import { Inbox, ChevronRight, Share2, Link2 } from 'lucide-react';
import { CustomerRequest } from '../../types';
import { RequestDetailModal } from '../RequestDetailModal';
import { haptic } from '../../utils/haptics';
import { buildPublicBookingLink } from '../../config/api';

interface RequestsViewProps {
  customerRequests?: CustomerRequest[];
  businessId?: string;
  businessName?: string;
  /** One Inbox deep-link: open this request's detail when the screen mounts. */
  initialRequestId?: string | null;
}

/**
 * Customer Requests screen for the Messages hub. Mirrors the request-list
 * rendering in DashboardTab (same SLA chips, same detail modal with its
 * Call / Text / Email actions) — but shows the full list instead of the
 * dashboard's first 5. No new data fetching: everything comes via props.
 */
export const RequestsView: React.FC<RequestsViewProps> = ({
  customerRequests = [],
  businessId = '',
  businessName = 'My Business',
  initialRequestId = null,
}) => {
  const slaFor = (req: CustomerRequest) => {
    const urgent = req.urgency === 'urgent' || req.urgency === 'emergency';
    const limitMs = urgent ? 8 * 3600 * 1000 : 24 * 3600 * 1000; // same-day vs 24h
    const elapsed = Date.now() - new Date(req.createdAt).getTime();
    return { urgent, breached: elapsed > limitMs, leftMs: Math.max(0, limitMs - elapsed) };
  };
  const timeLeft = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m left`;
    if (h < 24) return `${h}h left`;
    return `${Math.floor(h / 24)}d left`;
  };
  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  // One Inbox deep-link: opening a request row lands here with its detail open.
  // Mount-scoped on purpose — the screen unmounts when you leave the tab, so
  // returning later shows the plain list again, exactly as before.
  useEffect(() => {
    if (!initialRequestId) return;
    const found = customerRequests.find((r) => r.id === initialRequestId);
    if (found) setSelectedRequest(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bookingLink = buildPublicBookingLink(businessId);
  const shareBookingLink = async () => {
    if (!bookingLink) return;
    haptic.light();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${businessName} — Request Service`,
          text: 'Request service online:',
          url: bookingLink,
        });
      } else {
        await navigator.clipboard.writeText(bookingLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <div className="space-y-2 px-3.5 sm:px-4 pt-2 pb-8">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
          <Inbox className="w-3.5 h-3.5 text-lime-400" />
          <span>Customer Requests</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono">{customerRequests.length} open</span>
          {bookingLink && (
            <button
              type="button"
              onClick={shareBookingLink}
              className="text-[11px] font-bold text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {linkCopied ? <Link2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{linkCopied ? 'Copied!' : 'Share booking link'}</span>
            </button>
          )}
        </div>
      </div>
      {customerRequests.length === 0 ? (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2">
          <p className="text-xs text-zinc-400">No requests yet.</p>
          {bookingLink && (
            <button
              type="button"
              onClick={shareBookingLink}
              className="px-3.5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-extrabold transition cursor-pointer"
            >
              {linkCopied ? 'Link copied!' : 'Share your booking link'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {customerRequests.map((req) => {
            const sla = slaFor(req);
            return (
              <div
                key={req.id}
                onClick={() => {
                  haptic.light();
                  setSelectedRequest(req);
                }}
                className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 cursor-pointer hover:border-lime-500/40 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{req.customerName}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      sla.breached
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        : sla.urgent
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}>
                      {sla.breached ? 'Overdue' : sla.urgent ? `Same-day · ${timeLeft(sla.leftMs)}` : `24h · ${timeLeft(sla.leftMs)}`}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {req.serviceType || 'General Service'} — {req.description}
                </p>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {timeAgo(req.createdAt)} · {req.stage || 'Intake'}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </div>
  );
};
