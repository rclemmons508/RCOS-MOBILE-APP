import React, { useEffect, useState } from 'react';
import { Ear, PhoneIncoming, UserPlus } from 'lucide-react';
import { sidebarCard } from '../ui/cards';
import { formatCallerNumber, liveCallDuration, type LiveCall } from '../../lib/liveCalls';
import { ListenInConsole } from './ListenInConsole';

interface LiveCallsCardProps {
  calls: LiveCall[];
  businessId: string;
  /** Add the caller as a customer — opens the Add Client form
      pre-filled with the caller's number. Live calls carry no name or
      summary, so those stay blank for the user to fill in. */
  onAddCallerAsClient?: (call: LiveCall) => void;
}

/**
 * Live receptionist calls, on the Calls screen. The server tracks them
 * from the LiveKit webhook (a SIP caller in a room); this card only ever
 * shows real calls — when there are none, it says so plainly instead of
 * inventing one.
 */
export const LiveCallsCard: React.FC<LiveCallsCardProps> = ({ calls, businessId, onAddCallerAsClient }) => {
  const [listeningTo, setListeningTo] = useState<LiveCall | null>(null);
  // Tick the durations once a second while a call is live.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (calls.length === 0) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [calls.length]);

  // If the call being listened to ends, close the console instead of
  // sitting on a dead room.
  useEffect(() => {
    if (listeningTo && !calls.some((c) => c.roomName === listeningTo.roomName)) {
      setListeningTo(null);
    }
  }, [calls, listeningTo]);

  return (
    <>
      <div className={`p-3.5 ${sidebarCard}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5 shrink-0">
            {calls.length > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22ec72] opacity-60" />
            )}
            <span
              className={`relative inline-flex rounded-full w-2.5 h-2.5 ${
                calls.length > 0 ? 'bg-[#22ec72]' : 'bg-zinc-500'
              }`}
            />
          </span>
          <span className="text-sm font-extrabold text-white">Live calls</span>
          {calls.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30">
              LIVE · {calls.length}
            </span>
          )}
        </div>

        {calls.length === 0 ? (
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            No live calls right now — when the receptionist answers, the call shows here.
          </p>
        ) : (
          <div className="space-y-2 mt-3">
            {calls.map((call) => (
              <div
                key={call.roomName}
                className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30 shrink-0">
                    <PhoneIncoming className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {formatCallerNumber(call.callerNumber)}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono truncate">
                      {call.status === 'answered'
                        ? 'Receptionist is on the call'
                        : 'Ringing — waiting for the receptionist'}
                      {' • '}
                      {liveCallDuration(call.startedAt, nowMs)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onAddCallerAsClient && (
                    <button
                      type="button"
                      onClick={() => onAddCallerAsClient(call)}
                      className="min-h-[48px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-[#22ec72]" />
                      <span>Add customer</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setListeningTo(call)}
                    className="min-h-[48px] px-3 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Ear className="w-4 h-4" />
                    <span>Listen in</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {listeningTo && (
        <ListenInConsole
          call={listeningTo}
          businessId={businessId}
          onClose={() => setListeningTo(null)}
        />
      )}
    </>
  );
};
