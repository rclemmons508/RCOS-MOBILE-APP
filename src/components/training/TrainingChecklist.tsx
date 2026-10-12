import React, { useState, useEffect } from 'react';
import { GraduationCap, CheckCircle2, Circle } from 'lucide-react';

interface TrainingDay {
  day: number;
  title: string;
  tasks: string[];
}

const TRAINING_PLAN: TrainingDay[] = [
  {
    day: 1,
    title: 'Meet your AI team',
    tasks: [
      'Open the AI Team tab and review each assistant',
      'Set the tone for each assistant (Professional / Friendly / Direct)',
      'Turn on the assistants you want active',
    ],
  },
  {
    day: 2,
    title: 'Tune the receptionist',
    tasks: [
      'Make a test call to the AI receptionist',
      'Check that it greets callers the way you want',
      'Try a safety scenario (e.g. "I smell gas") and confirm it escalates',
    ],
  },
  {
    day: 3,
    title: 'Review your first requests',
    tasks: [
      'Check the Dashboard for customer requests',
      'Approve or edit your first AI-drafted quote',
      'Confirm SLA badges make sense for your business',
    ],
  },
  {
    day: 4,
    title: 'Set up automations',
    tasks: [
      'Open Settings → Automation Rules',
      'Turn on the welcome message and missed-call follow-up',
      'Review the Recently Fired log',
    ],
  },
  {
    day: 5,
    title: 'Run a health check',
    tasks: [
      'Open Settings → Diagnostics and run a system scan',
      'Fix anything marked FAIL (red)',
      'Note anything marked WARN (amber) for later',
    ],
  },
  {
    day: 6,
    title: 'Share your booking link',
    tasks: [
      'Tap Share Booking Link on the Dashboard',
      'Send it to a friend and have them test-book',
      'Confirm the test request appears in your Dashboard',
    ],
  },
  {
    day: 7,
    title: 'Go live',
    tasks: [
      'Review the full week: requests, calls, automations',
      'Turn on review-request automation',
      'You are live — the system runs itself from here',
    ],
  },
];

const STORAGE_KEY = 'rcos-training-progress';

/**
 * 7-day training checklist — per the RCOS onboarding funnel spec.
 * Progress persists in localStorage.
 */
export const TrainingChecklist: React.FC = () => {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  }, [done]);

  const toggle = (day: number, taskIdx: number) => {
    const key = `${day}-${taskIdx}`;
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalTasks = TRAINING_PLAN.reduce((n, d) => n + d.tasks.length, 0);
  const doneCount = Object.values(done).filter(Boolean).length;
  const pct = Math.round((doneCount / totalTasks) * 100);

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-lime-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">7-Day Training</h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">{pct}%</span>
      </div>

      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-lime-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {TRAINING_PLAN.map((d) => (
          <div key={d.day} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="text-xs font-bold text-white mb-1.5">
              <span className="text-lime-400 font-mono mr-1.5">Day {d.day}</span>
              {d.title}
            </div>
            <div className="space-y-1">
              {d.tasks.map((task, i) => {
                const key = `${d.day}-${i}`;
                const checked = !!done[key];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(d.day, i)}
                    className="w-full flex items-start gap-2 text-left group cursor-pointer"
                  >
                    {checked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-[11px] ${checked ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}
                    >
                      {task}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
