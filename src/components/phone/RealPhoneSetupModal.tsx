import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Phone,
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  Radio,
  ExternalLink,
  RefreshCw,
  Send,
  MessageSquare
} from 'lucide-react';

interface RealPhoneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  onTriggerNotification?: (title: string, message: string) => void;
}

// The exact text the test button sends. Short, and Vonage appends its own
// "[FREE SMS DEMO, TEST MESSAGE]" tag on trial accounts.
const TEST_MESSAGE = 'Test from RCOS Mobile: your Vonage SMS is working.';

type TabId = 'status' | 'test_text' | 'instructions';

export const RealPhoneSetupModal: React.FC<RealPhoneSetupModalProps> = ({
  isOpen,
  onClose,
  businessId,
  onTriggerNotification
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('status');

  // Live server provider check (GET /api/firebase-config -> telephonyProvider).
  const [provider, setProvider] = useState<string | null>(null);
  const [providerChecked, setProviderChecked] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);

  // Test-text state.
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const [testTextResult, setTestTextResult] = useState<{ ok: boolean; message: string } | null>(null);

  const checkProvider = async () => {
    setIsCheckingProvider(true);
    try {
      const data = await apiFetch<{ telephonyProvider?: string }>('/api/firebase-config');
      setProvider((data?.telephonyProvider || '').toLowerCase() || null);
    } catch {
      setProvider(null);
    } finally {
      setProviderChecked(true);
      setIsCheckingProvider(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setProviderChecked(false);
      checkProvider();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendTestText = async () => {
    if (!businessId) {
      setTestTextResult({
        ok: false,
        message: 'Your business is not loaded — close this and reopen the app, then try again.'
      });
      return;
    }
    const to = testPhoneNumber.trim();
    if (!to) {
      setTestTextResult({ ok: false, message: 'Enter the phone number to text.' });
      return;
    }
    setIsSendingText(true);
    setTestTextResult(null);
    try {
      const result = await apiFetch<{ configured?: boolean; sent?: boolean; duplicate?: boolean; error?: string }>(
        `/api/business/${encodeURIComponent(businessId)}/sms/send`,
        {
          method: 'POST',
          body: JSON.stringify({ to, text: TEST_MESSAGE, dedupeKey: `modal-test-${Date.now()}` })
        }
      );
      if (result?.sent) {
        setTestTextResult({
          ok: true,
          message: result.duplicate
            ? 'Already sent — Vonage skipped the duplicate.'
            : `Sent to ${to}. Check your phone — Vonage adds [FREE SMS DEMO, TEST MESSAGE] to every trial text.`
        });
        if (onTriggerNotification) {
          onTriggerNotification('Test Text Sent', `Vonage test text sent to ${to}.`);
        }
      } else {
        setTestTextResult({
          ok: false,
          message: result?.error || 'The text did not send. Check the Setup Guide, then try again.'
        });
      }
    } catch (err: any) {
      setTestTextResult({ ok: false, message: err?.message || 'Could not reach the server.' });
    } finally {
      setIsSendingText(false);
    }
  };

  const vonageLive = provider === 'vonage';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-lime-500/10 text-lime-400 border border-lime-500/30">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Phone Setup
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-900 text-lime-400 border border-zinc-800">
                  Vonage SMS • LiveKit Voice
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Texting runs on Vonage. Voice calls run inside the app. No carrier phone line connected.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800/80 text-xs font-bold font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'status'
                ? 'bg-lime-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>How It Works</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test_text')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'test_text'
                ? 'bg-lime-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Send Test Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'bg-lime-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
          </button>
        </div>

        {/* Tab 1: How it works + live provider status */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-black border border-lime-500/30 space-y-2.5">
              <div className="text-xs font-bold text-white">How your phone system works</div>
              <div className="space-y-2 text-[11px] text-zinc-400 leading-relaxed font-sans">
                <p>
                  <strong className="text-zinc-100">Texting — Vonage (trial).</strong>{' '}
                  Follow-up texts and test texts send through Vonage. Vonage adds{' '}
                  <strong className="text-zinc-200">[FREE SMS DEMO, TEST MESSAGE]</strong> to every trial text.
                </p>
                <p>
                  <strong className="text-zinc-100">Voice — LiveKit in-app calling.</strong>{' '}
                  The AI receptionist and push-to-talk happen inside the app over the internet.
                </p>
                <p>
                  <strong className="text-zinc-100">No PSTN carrier.</strong>{' '}
                  No carrier phone line is connected, so the app cannot receive or dial regular phone calls.
                  Twilio is not connected.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Server provider check</span>
                <button
                  type="button"
                  onClick={checkProvider}
                  disabled={isCheckingProvider}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingProvider ? 'animate-spin' : ''}`} />
                  <span>{isCheckingProvider ? 'Checking...' : 'Recheck'}</span>
                </button>
              </div>
              {!providerChecked ? (
                <p className="text-xs text-zinc-400 font-mono">Checking the server…</p>
              ) : vonageLive ? (
                <p className="text-xs font-mono text-lime-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Vonage SMS is connected (server provider: vonage).</span>
                </p>
              ) : provider ? (
                <p className="text-xs font-mono text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Server provider is &lsquo;{provider}&rsquo; — Vonage is not connected. Set TELEPHONY_PROVIDER=vonage
                    in Railway Variables (see Setup Guide).
                  </span>
                </p>
              ) : (
                <p className="text-xs font-mono text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Couldn&rsquo;t reach the server to check. Try Recheck.</span>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-xs font-bold text-white">Vonage trial limits</div>
              <ul className="text-[11px] text-zinc-400 leading-relaxed font-sans list-disc pl-4 space-y-1">
                <li>Texts only go to your registered number plus up to 4 verified numbers.</li>
                <li>Every text gets [FREE SMS DEMO, TEST MESSAGE] added at the end.</li>
                <li>Trial credit can&rsquo;t buy a phone number — a Vonage number on the account is required as the sender (VONAGE_FROM_NUMBER).</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Send a real test text via Vonage */}
        {activeTab === 'test_text' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-lime-500/30 space-y-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-lime-400" />
                <span>Send a Real Test Text</span>
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Sends one real text through Vonage to the number you enter. On trial, that number must be
                your registered number or a verified test number. Vonage adds its demo tag to the end.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black border border-zinc-800">
              <div className="text-[10px] text-zinc-400 font-mono mb-1">Message that will be sent:</div>
              <p className="text-xs text-zinc-200 font-sans">{TEST_MESSAGE}</p>
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Your Mobile Number (digits only is fine)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+14707832596"
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSendTestText}
                  disabled={isSendingText || !businessId}
                  className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingText ? 'Sending...' : 'Send Test Text'}</span>
                </button>
              </div>
              {!businessId && (
                <p className="text-[10px] text-amber-300 mt-1">
                  Your business isn&rsquo;t loaded — close this and reopen the app, then try again.
                </p>
              )}
            </div>

            {testTextResult && (
              <div className={`p-3 rounded-2xl text-xs font-mono border ${
                testTextResult.ok
                  ? 'bg-lime-500/10 border-lime-500/30 text-lime-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="font-bold flex items-start gap-1.5">
                  {testTextResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testTextResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Vonage setup guide */}
        {activeTab === 'instructions' && (
          <div className="space-y-3 text-xs text-zinc-300 font-sans leading-relaxed max-h-72 overflow-y-auto pr-1">
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">1</span>
                <span>Create a Vonage API account</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                Go to <a href="https://dashboard.nexmo.com" target="_blank" rel="noreferrer" className="text-lime-400 underline inline-flex items-center gap-0.5">Vonage Dashboard <ExternalLink className="w-2.5 h-2.5" /></a> and sign up.
                Verify your email and your phone number — that number becomes your trial&rsquo;s registered number.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">2</span>
                <span>Put the keys in Railway Variables (never in the app)</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                In the Vonage dashboard, find your API Key and API Secret. In Railway → your app service → Variables, set:{' '}
                <code className="text-zinc-200 font-mono">TELEPHONY_PROVIDER=vonage</code>,{' '}
                <code className="text-zinc-200 font-mono">VONAGE_API_KEY</code>,{' '}
                <code className="text-zinc-200 font-mono">VONAGE_API_SECRET</code>, and{' '}
                <code className="text-zinc-200 font-mono">VONAGE_FROM_NUMBER</code> (your Vonage number, digits only, no +).
                Never type keys into the app.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">3</span>
                <span>Know the trial limits</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                Trial texts only go to your registered number plus up to 4 verified numbers, and every text gets
                [FREE SMS DEMO, TEST MESSAGE] added. Trial credit can&rsquo;t buy a number, so you need a Vonage
                number on the account for the sender line. Voice needs no setup — calls happen inside the app
                over the internet (LiveKit).
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-lime-400" />
            <span>Vonage SMS • LiveKit Voice • No PSTN carrier</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
