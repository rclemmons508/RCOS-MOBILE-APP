import React, { useState, useEffect } from 'react';
import { TelephonyConfig } from '../../types';
import { 
  Phone, 
  Settings, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Copy, 
  ExternalLink, 
  PhoneCall, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Clock, 
  RefreshCw,
  PhoneForwarded,
  Sliders,
  Send
} from 'lucide-react';

interface RealPhoneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TelephonyConfig | null;
  onSaveConfig: (updated: Partial<TelephonyConfig>) => Promise<void>;
  onTriggerNotification?: (title: string, message: string) => void;
}

export const RealPhoneSetupModal: React.FC<RealPhoneSetupModalProps> = ({
  isOpen,
  onClose,
  config: initialConfig,
  onSaveConfig,
  onTriggerNotification
}) => {
  const [config, setConfig] = useState<Partial<TelephonyConfig>>(initialConfig || {});
  const [activeTab, setActiveTab] = useState<'status' | 'routing' | 'test_call' | 'instructions'>('status');
  
  // Carrier test state
  const [isTestingCarrier, setIsTestingCarrier] = useState(false);
  const [carrierStatus, setCarrierStatus] = useState<any>(null);

  // Real test call state
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isPlacingCall, setIsPlacingCall] = useState(false);
  const [testCallResult, setTestCallResult] = useState<any>(null);

  // Copy state
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const handleTestCarrier = async () => {
    setIsTestingCarrier(true);
    setCarrierStatus(null);
    try {
      const res = await fetch('/api/twilio/test-carrier', { method: 'POST' });
      const data = await res.json();
      setCarrierStatus(data);
    } catch (err: any) {
      setCarrierStatus({
        success: false,
        error: err?.message || 'Network connection failed'
      });
    } finally {
      setIsTestingCarrier(false);
    }
  };

  const handlePlaceRealCall = async () => {
    if (!testPhoneNumber) return;
    setIsPlacingCall(true);
    setTestCallResult(null);
    try {
      const res = await fetch('/api/twilio/voice/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPhone: testPhoneNumber })
      });
      const data = await res.json();
      setTestCallResult(data);
      if (data.success && onTriggerNotification) {
        onTriggerNotification(
          'Outbound Call Dispatched',
          `Calling ${testPhoneNumber} from carrier line ${config.phoneNumber || ''}`
        );
      }
    } catch (err: any) {
      setTestCallResult({
        success: false,
        error: err?.message || 'Failed to place call'
      });
    } finally {
      setIsPlacingCall(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig(config);
      if (onTriggerNotification) {
        onTriggerNotification('PBX Settings Saved', 'Carrier routing rules and phone numbers updated.');
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    const url = config.webhookUrl || `${window.location.origin}/api/twilio/voice/incoming`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const webhookUrl = config.webhookUrl || `${window.location.origin}/api/twilio/voice/incoming`;

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
                Real Telecom PBX Configuration
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-900 text-lime-400 border border-zinc-800">
                  Twilio PSTN
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Carrier Phone Line, AI Voice Receptionist & Live Transfers</p>
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
            <span>Carrier Line</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routing')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'routing' 
                ? 'bg-lime-500 text-black shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PhoneForwarded className="w-3.5 h-3.5" />
            <span>Transfers & Depts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test_call')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'test_call' 
                ? 'bg-lime-500 text-black shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Test Real Phone</span>
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

        {/* Tab 1: Carrier Line & Webhook */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            {/* Live Webhook Card */}
            <div className="p-3.5 rounded-2xl bg-black border border-lime-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-lime-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Incoming Voice Webhook URL (Public PSTN Endpoint)</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">HTTP POST</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-lime-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  {copiedWebhook ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWebhook ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Paste this URL into your Twilio Console under: 
                <strong className="text-zinc-200"> Phone Numbers → Active Numbers → Voice & Fax → "A Call Comes In" → Webhook</strong>.
              </p>
            </div>

            {/* Carrier Credentials Status */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Twilio Carrier Connection</span>
                <button
                  type="button"
                  onClick={handleTestCarrier}
                  disabled={isTestingCarrier}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isTestingCarrier ? 'animate-spin' : ''}`} />
                  <span>{isTestingCarrier ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-xl bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-400">Account SID:</div>
                  <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                    {config.accountSidConfigured ? (
                      <span className="text-lime-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Needs Env Secret
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-400">Auth Token:</div>
                  <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                    {config.authTokenConfigured ? (
                      <span className="text-lime-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Needs Env Secret
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {carrierStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono border ${
                  carrierStatus.success 
                    ? 'bg-lime-500/10 border-lime-500/30 text-lime-300' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="font-bold">{carrierStatus.message || carrierStatus.error}</div>
                  {carrierStatus.accountFriendlyName && (
                    <div className="text-[10.5px] mt-1 text-zinc-400">
                      Account: {carrierStatus.accountFriendlyName} ({carrierStatus.accountStatus})
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Business Carrier Number */}
            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                RC Solutions Public Carrier Phone Number (Caller ID)
              </label>
              <input
                type="text"
                value={config.phoneNumber || ''}
                onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                placeholder="+1 (800) 555-7267 or Twilio DID"
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                This is the real telephone number your customers dial from standard cellular or landline phones.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Routing Strategy & Real Forwarding Numbers */}
        {activeTab === 'routing' && (
          <div className="space-y-3.5">
            {/* Answering Strategy Selector */}
            <div>
              <label className="text-xs font-bold text-white block mb-1.5">
                Incoming Call Answering Strategy
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, answeringStrategy: 'ai_first' })}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    config.answeringStrategy === 'ai_first'
                      ? 'bg-purple-600/15 border-purple-500 text-white shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      AI Receptionist First
                    </span>
                    {config.answeringStrategy === 'ai_first' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    Voice Concierge (Kore) answers immediately. Screens calls, answers questions, takes messages, and transfers when requested.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, answeringStrategy: 'human_first' })}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    config.answeringStrategy === 'human_first'
                      ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      Human Operator First
                    </span>
                    {config.answeringStrategy === 'human_first' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    Rings your real mobile phone for 15 seconds. If busy or unanswered, AI Voice Receptionist picks up so you never lose a job.
                  </p>
                </button>
              </div>
            </div>

            {/* Operator Forwarding Phone */}
            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-300 block mb-1">
                Human Operator / Main Mobile Forwarding Line
              </label>
              <input
                type="text"
                value={config.operatorForwardingPhone || ''}
                onChange={(e) => setConfig({ ...config, operatorForwardingPhone: e.target.value })}
                placeholder="+1 (555) 019-4820"
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-0.5">
                The real phone number that rings when callers say "let me speak to a human" or during human-first mode.
              </p>
            </div>

            {/* Department Real Forwarding Numbers */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <PhoneForwarded className="w-3.5 h-3.5 text-lime-400" />
                  <span>Real Department Transfer Numbers (PSTN Routing)</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">TwiML &lt;Dial&gt;</span>
              </div>
              <p className="text-[10.5px] text-zinc-400">
                When a caller asks to be transferred, the AI Receptionist dials these real phone lines:
              </p>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-28 text-zinc-400 shrink-0">Dispatch (Ext 101):</span>
                  <input
                    type="text"
                    value={config.departmentForwardingNumbers?.dispatch || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      departmentForwardingNumbers: {
                        ...(config.departmentForwardingNumbers as any),
                        dispatch: e.target.value
                      }
                    })}
                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-28 text-zinc-400 shrink-0">Billing (Ext 102):</span>
                  <input
                    type="text"
                    value={config.departmentForwardingNumbers?.billing || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      departmentForwardingNumbers: {
                        ...(config.departmentForwardingNumbers as any),
                        billing: e.target.value
                      }
                    })}
                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-28 text-zinc-400 shrink-0">Emergency (103):</span>
                  <input
                    type="text"
                    value={config.departmentForwardingNumbers?.emergency || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      departmentForwardingNumbers: {
                        ...(config.departmentForwardingNumbers as any),
                        emergency: e.target.value
                      }
                    })}
                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-28 text-zinc-400 shrink-0">Sales (Ext 104):</span>
                  <input
                    type="text"
                    value={config.departmentForwardingNumbers?.sales || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      departmentForwardingNumbers: {
                        ...(config.departmentForwardingNumbers as any),
                        sales: e.target.value
                      }
                    })}
                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Place Real Test Call to User's Phone */}
        {activeTab === 'test_call' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-lime-500/30 space-y-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-lime-400" />
                <span>Place a Real Live Telephone Call</span>
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Enter your actual personal cell phone number below. When you click 
                <strong className="text-white"> "Call My Phone"</strong>, the carrier will dial your physical phone!
                When you answer, the Voice Receptionist (Kore) will greet you live over the phone line.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-mono font-semibold text-zinc-400 block mb-1">
                Your Real Cell Phone Number (E.164 Format)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+14155552671"
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handlePlaceRealCall}
                  disabled={isPlacingCall || !testPhoneNumber}
                  className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPlacingCall ? 'Dialing...' : 'Call My Phone'}</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Include country code, e.g. <strong className="text-zinc-400">+1</strong> for US/Canada.
              </p>
            </div>

            {testCallResult && (
              <div className={`p-3 rounded-2xl text-xs font-mono border ${
                testCallResult.success
                  ? 'bg-lime-500/10 border-lime-500/30 text-lime-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  {testCallResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{testCallResult.message || testCallResult.error}</span>
                </div>
                {testCallResult.callSid && (
                  <div className="text-[10.5px] mt-1 text-zinc-400">
                    Twilio Call SID: <span className="text-white">{testCallResult.callSid}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Step-by-Step Twilio Setup Guide */}
        {activeTab === 'instructions' && (
          <div className="space-y-3 text-xs text-zinc-300 font-sans leading-relaxed max-h-72 overflow-y-auto pr-1">
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">1</span>
                <span>Get a Phone Number on Twilio</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                Go to <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-lime-400 underline inline-flex items-center gap-0.5">Twilio Console <ExternalLink className="w-2.5 h-2.5" /></a>, buy or select an active US/International phone number capable of Voice and SMS.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">2</span>
                <span>Configure the Voice Webhook</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                In Twilio Phone Number settings under <strong>Voice Configuration</strong>:
                <br />- Set <strong>"A Call Comes In"</strong> to <strong>Webhook</strong>
                <br />- URL: <code className="text-lime-300 font-mono bg-black px-1 rounded">{webhookUrl}</code>
                <br />- Method: <strong>HTTP POST</strong>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-lime-500/20 text-lime-400 text-[11px] font-mono flex items-center justify-center font-bold">3</span>
                <span>Set Secrets in AI Studio</span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                Add <code className="text-zinc-200 font-mono">TWILIO_ACCOUNT_SID</code>, <code className="text-zinc-200 font-mono">TWILIO_AUTH_TOKEN</code>, and <code className="text-zinc-200 font-mono">TWILIO_PHONE_NUMBER</code> into your environment secrets.
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-lime-400" />
            <span>PSTN Telephony Gateway Active</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-lime-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
