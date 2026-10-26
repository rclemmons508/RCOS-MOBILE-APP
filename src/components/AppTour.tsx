import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Bot,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Contact,
  DollarSign,
  Gauge,
  Inbox,
  Mail,
  MessagesSquare,
  Phone,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { TabType } from '../types';
import { haptic } from '../utils/haptics';

/**
 * App Guide — the in-app walkthrough for new users.
 *
 * Two views in one overlay:
 * - Tour view: one short step per major area of the app, in plain
 *   language. Each step moves the app behind the overlay to the screen
 *   it describes, so the user sees the real thing as they read about it.
 * - Guide menu: the reference view. It lists every section; tapping one
 *   jumps straight to that step, and "Replay the full tour" starts
 *   from the beginning.
 *
 * The tour never blocks the app: every step has a visible Skip, and
 * closing (skip or finish) is the caller's job to record — see
 * onClose. Reopening from Settings always works regardless of the
 * completion flag.
 */

export interface TourStep {
  id: string;
  title: string;
  /** Screen this step describes; the app navigates here when shown. */
  tab: TabType;
  /** One-line summary, used in the guide menu. */
  blurb: string;
  /** What the screen is for, in plain language. */
  body: string;
  /** Where to tap to get there on your own. */
  tapHint: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to RCOS',
    tab: 'dashboard',
    blurb: 'Your whole business, in one app.',
    body: 'RCOS is your whole business in one app. It answers calls, books jobs, sends quotes and invoices, and keeps your team in touch. This short tour shows you where everything lives — it only takes a minute.',
    tapHint: 'Tap Next to start the tour.',
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    tab: 'dashboard',
    blurb: 'Home: what needs attention today.',
    body: 'This is home. The Morning Briefing tells you what needs attention today, and the search box finds any job, client, quote, or invoice. The buttons under the briefing handle the next job in one tap.',
    tapHint: 'Tap Dash at the bottom of the screen.',
  },
  {
    id: 'jobs',
    title: 'Jobs',
    tab: 'jobs',
    blurb: 'Every job, booked to done.',
    body: 'Every job lives here. See what is booked, what is in progress, and what is done. You can add a job, change one, or turn a finished job into an invoice.',
    tapHint: 'Tap Jobs / $ at the bottom, then Jobs.',
  },
  {
    id: 'money',
    title: 'Quotes, jobs, invoices',
    tab: 'approvals',
    blurb: 'The money loop, with nothing lost between steps.',
    body: 'A quote your customer approves becomes a job with one tap. Finish the job and turn it into an invoice, then mark it paid when the money lands. Nothing gets lost between steps.',
    tapHint: 'In Jobs / $, tap Approvals for quotes waiting on you.',
  },
  {
    id: 'customers',
    title: 'Customers',
    tab: 'clients',
    blurb: 'Everyone you do business with.',
    body: 'Everyone you do business with lives here. Add a customer, look one up, and see their jobs and history in one place.',
    tapHint: 'In Jobs / $, tap Clients.',
  },
  {
    id: 'requests',
    title: 'Customer requests',
    tab: 'requests',
    blurb: 'Booking and demo requests, ready to answer.',
    body: 'Requests from your booking page and demo form land here. Open one to see what the customer asked for, then reply from the same place.',
    tapHint: 'Tap Messages at the bottom, then Requests.',
  },
  {
    id: 'inbox',
    title: 'Messages — one inbox',
    tab: 'inbox',
    blurb: 'Everything that needs you, in one place.',
    body: 'Everything that needs you is in one place: things that need you now, messages from your AI team, customers, your team, email, and alerts. The number on Messages tells you when something is waiting.',
    tapHint: 'Tap Messages at the bottom.',
  },
  {
    id: 'ai-team',
    title: 'Your AI team',
    tab: 'team',
    blurb: 'AI employees for sales, support, billing, and more.',
    body: 'These are your AI employees — Sales, Support, Billing, and more. Tap one to talk to them, or use the floating assistant button to chat in writing. They work from what you teach them in Settings.',
    tapHint: 'Tap AI Team at the bottom.',
  },
  {
    id: 'phone',
    title: 'Phone system',
    tab: 'phone',
    blurb: 'Calls, answered your way.',
    body: 'This is where calls come in. You choose whether the AI answers or you take calls yourself, and the AI can pass a caller to Sales, Support, Billing, Dispatch, or Emergency.',
    tapHint: 'Tap Messages at the bottom, then Phone.',
  },
  {
    id: 'team-chat',
    title: 'Team Chat',
    tab: 'team-chat',
    blurb: 'Chat with your real team, live.',
    body: 'Chat with your real team here — everyone on your business can talk, share updates, and stay in sync. New messages show up live, and unread messages are counted on Messages.',
    tapHint: 'Tap Messages at the bottom, then Team Chat.',
  },
  {
    id: 'gmail',
    title: 'Email',
    tab: 'gmail',
    blurb: 'Gmail inside the app, private to you.',
    body: 'Connect Gmail once and read and send email right inside the app. Your email is yours alone — nobody else on your business ever sees it.',
    tapHint: 'Tap Messages at the bottom, then Email.',
  },
  {
    id: 'settings',
    title: 'Settings',
    tab: 'settings',
    blurb: 'Mission control — and this guide, any time.',
    body: 'This is mission control. Update your profile and company details, teach your team how your business works, and turn automations on or off. And if you ever get lost, come back here and open the App Guide to replay this tour.',
    tapHint: 'Tap More at the bottom, then Settings.',
  },
];

const STEP_ICONS: Record<string, any> = {
  welcome: Sparkles,
  dashboard: Gauge,
  jobs: Briefcase,
  money: DollarSign,
  customers: Contact,
  requests: Inbox,
  inbox: MessagesSquare,
  'ai-team': Bot,
  phone: Phone,
  'team-chat': Users,
  gmail: Mail,
  settings: Settings,
};

export type TourMode = 'tour' | 'menu';

interface AppTourProps {
  open: boolean;
  /** Step to start on (menu jumps set this). */
  initialStep?: number;
  /** 'tour' for the first-run walkthrough, 'menu' for the reference list. */
  initialMode?: TourMode;
  onNavigate: (tab: TabType) => void;
  /** Called on skip, finish, or close. `finished` is true only when the
   *  user reaches the last step and taps Done. The caller records the
   *  completion flag so the tour does not auto-open again. */
  onClose: (finished: boolean) => void;
}

export const AppTour: React.FC<AppTourProps> = ({
  open,
  initialStep = 0,
  initialMode = 'tour',
  onNavigate,
  onClose,
}) => {
  const [mode, setMode] = useState<TourMode>(initialMode);
  const [stepIndex, setStepIndex] = useState(initialStep);

  // Reset to the caller's starting point every time the tour opens, so a
  // guide-menu jump never leaks into the next auto-run (and vice versa).
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setStepIndex(Math.min(Math.max(initialStep, 0), TOUR_STEPS.length - 1));
    }
  }, [open, initialMode, initialStep]);

  // Show the real screen behind each step, so the user learns the app by
  // seeing it — not by reading about a screen they cannot see.
  useEffect(() => {
    if (open && mode === 'tour') {
      onNavigate(TOUR_STEPS[stepIndex].tab);
    }
    // Only re-navigate when the step or view changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, stepIndex]);

  if (!open) return null;

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const StepIcon = STEP_ICONS[step.id] || BookOpen;

  const goToStep = (index: number) => {
    haptic.light();
    setStepIndex(index);
    setMode('tour');
  };

  const close = (finished: boolean) => {
    haptic.light();
    onClose(finished);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl">
        {mode === 'menu' ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-lime-400" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-white leading-tight">App Guide</h2>
                  <p className="text-xs text-zinc-400">Pick a section to jump to it, or replay the whole tour.</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close guide"
                onClick={() => close(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => goToStep(0)}
              className="w-full px-4 py-3 rounded-2xl bg-lime-500 text-black text-sm font-extrabold hover:bg-lime-400 transition cursor-pointer"
            >
              Replay the full tour
            </button>

            <div className="space-y-1.5">
              {TOUR_STEPS.map((s, i) => {
                const Icon = STEP_ICONS[s.id] || BookOpen;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToStep(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-lime-500/40 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-lime-400" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{s.title}</span>
                      <span className="block text-xs text-zinc-400 truncate">{s.blurb}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500 ml-auto shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Step {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={() => close(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-bold transition cursor-pointer shrink-0"
              >
                Skip tour
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center shrink-0">
                <StepIcon className="w-6 h-6 text-lime-400" />
              </span>
              <h2 className="text-xl font-extrabold text-white leading-tight">{step.title}</h2>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">{step.body}</p>

            <div className="px-3 py-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <p className="text-xs text-zinc-400">
                <span className="font-bold text-lime-400">Where to tap: </span>
                {step.tapHint}
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1">
              {TOUR_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  onClick={() => goToStep(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === stepIndex ? 'w-6 bg-lime-400' : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setStepIndex((i) => Math.max(i - 1, 0));
                }}
                disabled={isFirst}
                className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-zinc-900 text-white border border-zinc-800 text-sm font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-default"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-lime-500 text-black text-sm font-extrabold hover:bg-lime-400 transition cursor-pointer"
                >
                  Done — take me to the Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-2xl bg-lime-500 text-black text-sm font-extrabold hover:bg-lime-400 transition cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
