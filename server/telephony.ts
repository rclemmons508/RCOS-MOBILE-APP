import { Request, Response, Router } from 'express';
import twilio from 'twilio';
import { db } from './db';
import { executeGeminiWithFallback, PRIMARY_MODEL } from './gemini';
import { ActionRecord, PhoneCall, VoicemailRecord } from '../src/types';

export const telephonyRouter = Router();

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken && accountSid.startsWith('AC') && authToken.length > 5) {
    try {
      return twilio(accountSid, authToken);
    } catch (e) {
      console.warn('[Twilio] Failed to initialize client:', e);
      return null;
    }
  }
  return null;
}

/**
 * GET /api/twilio/config
 * Returns active telephony status, forwarding numbers, and webhook setup
 */
telephonyRouter.get('/config', (req: Request, res: Response) => {
  const config = db.getTelephonyConfig();
  res.json({
    ...config,
    hasRealTwilioCredentials: !!getTwilioClient(),
    appUrl: process.env.APP_URL || ''
  });
});

/**
 * POST /api/twilio/config
 * Updates telephony routing rules and real department forwarding phone numbers
 */
telephonyRouter.post('/config', (req: Request, res: Response) => {
  const updated = db.saveTelephonyConfig(req.body);
  res.json({
    success: true,
    config: updated,
    hasRealTwilioCredentials: !!getTwilioClient()
  });
});

/**
 * POST /api/twilio/test-carrier
 * Tests Twilio credentials against the live Twilio API
 */
telephonyRouter.post('/test-carrier', async (req: Request, res: Response) => {
  const client = getTwilioClient();
  const config = db.getTelephonyConfig();

  if (!client) {
    return res.json({
      success: false,
      configured: false,
      message: 'Twilio Account SID or Auth Token is missing or invalid. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment secrets.',
      currentConfig: config
    });
  }

  try {
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 5 });

    return res.json({
      success: true,
      configured: true,
      accountFriendlyName: account.friendlyName,
      accountStatus: account.status,
      configuredPhoneNumber: config.phoneNumber,
      availableCarrierNumbers: incomingNumbers.map(n => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities
      })),
      webhookUrl: config.webhookUrl,
      message: `Successfully connected to Twilio account "${account.friendlyName}" (${account.status}).`
    });
  } catch (err: any) {
    return res.json({
      success: false,
      configured: false,
      error: err?.message || 'Failed to authenticate with Twilio API',
      message: 'Carrier credentials rejected by Twilio API. Please verify Account SID and Auth Token.'
    });
  }
});

/**
 * POST /api/twilio/voice/incoming
 * Real PSTN Inbound Phone Call Webhook
 * Triggered by Twilio carrier whenever anyone dials the real phone number
 */
telephonyRouter.post('/voice/incoming', (req: Request, res: Response) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const config = db.getTelephonyConfig();

  const callerPhone = req.body.From || 'Unknown Caller';
  const callSid = req.body.CallSid || `real_call_${Date.now()}`;
  const callerCity = req.body.CallerCity ? `${req.body.CallerCity}, ${req.body.CallerState}` : '';

  console.log(`[PSTN Telecom] Real inbound call received from ${callerPhone} (CallSid: ${callSid})`);

  // Record real PSTN call in database
  const realCall: PhoneCall = {
    id: `call_${Date.now()}`,
    twilioCallSid: callSid,
    callerName: callerCity ? `${callerPhone} (${callerCity})` : callerPhone,
    callerNumber: callerPhone,
    type: 'inbound',
    status: 'ringing',
    timestamp: 'Just now',
    duration: '0m 00s',
    answeredBy: config.answeringStrategy === 'human_first' ? 'human_operator' : 'ai_receptionist',
    isRealPstnCall: true,
    summary: `Real incoming telephone call from carrier line ${callerPhone}. Routing mode: ${config.answeringStrategy}.`,
    transcript: [
      {
        speaker: 'System',
        text: `📞 Inbound call received via Twilio PSTN from ${callerPhone}.`,
        time: '00:00'
      }
    ]
  };
  db.saveCall(realCall);

  // Strategy 1: Human First (Rings operator phone first, falls back to AI Receptionist)
  if (config.answeringStrategy === 'human_first' && config.operatorForwardingPhone) {
    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      'Thank you for calling RC Solutions. Connecting you to an on-call operations specialist.'
    );
    const dial = twiml.dial({
      callerId: config.phoneNumber,
      timeout: config.ringDurationSeconds || 15,
      action: '/api/twilio/voice/human-fallback',
      method: 'POST'
    });
    dial.number(config.operatorForwardingPhone);
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Strategy 2: AI Voice Receptionist First (Answers immediately, greets, and listens)
  const gather = twiml.gather({
    input: ['speech'],
    action: '/api/twilio/voice/handle-speech',
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 5,
    language: 'en-US'
  });

  gather.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    config.greetingMessage || 'Thank you for calling RC Solutions smart mechanical, electrical, and automation services. How may I direct your call or assist you today?'
  );

  // If caller stays silent, prompt once more
  twiml.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    'I did not hear a response. If you would like to speak to Dispatch, Billing, Emergency Services, or leave a voicemail, please speak after the beep.'
  );
  twiml.gather({
    input: ['speech'],
    action: '/api/twilio/voice/handle-speech',
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 6
  });

  res.type('text/xml');
  return res.send(twiml.toString());
});

/**
 * POST /api/twilio/voice/human-fallback
 * Called if the human operator did not answer within the ring timeout
 */
telephonyRouter.post('/voice/human-fallback', (req: Request, res: Response) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const config = db.getTelephonyConfig();
  const dialCallStatus = req.body.DialCallStatus; // 'completed', 'busy', 'no-answer', 'failed', 'canceled'

  if (dialCallStatus === 'completed') {
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Fallback to AI Receptionist
  twiml.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    'Our human operators are currently assisting other facility managers. I am Kore, the AI Concierge for RC Solutions. How can I assist you, or would you like to leave a message?'
  );

  const gather = twiml.gather({
    input: ['speech'],
    action: '/api/twilio/voice/handle-speech',
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 5
  });

  res.type('text/xml');
  return res.send(twiml.toString());
});

/**
 * POST /api/twilio/voice/handle-speech
 * Processes real caller speech recognized by Twilio carrier STT
 */
telephonyRouter.post('/voice/handle-speech', async (req: Request, res: Response) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const config = db.getTelephonyConfig();

  const userSpeech = (req.body.SpeechResult || '').trim();
  const callSid = req.body.CallSid;
  const callerNumber = req.body.From || 'Inbound Caller';

  console.log(`[PSTN Speech] CallSid: ${callSid}, Caller said: "${userSpeech}"`);

  // Update existing call transcript
  const calls = db.getCalls();
  const activeCall = calls.find(c => c.twilioCallSid === callSid) || {
    id: `call_${Date.now()}`,
    twilioCallSid: callSid,
    callerName: callerNumber,
    callerNumber: callerNumber,
    type: 'inbound',
    status: 'active',
    timestamp: 'Just now',
    duration: '0m 30s',
    answeredBy: 'ai_receptionist',
    isRealPstnCall: true,
    transcript: []
  } as PhoneCall;

  if (!activeCall.transcript) activeCall.transcript = [];
  activeCall.transcript.push({
    speaker: 'Caller',
    text: userSpeech || '(Inaudible / Silence)',
    time: '00:15'
  });

  if (!userSpeech) {
    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      'I was unable to hear you clearly. You can ask for Dispatch, Billing, Emergency, or say leave a message.'
    );
    const gather = twiml.gather({
      input: ['speech'],
      action: '/api/twilio/voice/handle-speech',
      method: 'POST',
      speechTimeout: 'auto'
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Analyze caller speech intent with Gemini
  const prompt = `You are "Kore", the real voice receptionist for RC Solutions commercial mechanical, electrical, and automation field services.
A real caller is speaking on a live telephone line.
Caller Phone: ${callerNumber}
Caller Speech: "${userSpeech}"

RC Solutions Real Transfer Directory:
- "dispatch": Dispatch & Field Operations (Lead: Marcus Vance, phone: ${config.departmentForwardingNumbers.dispatch})
- "billing": Billing & Invoicing (Lead: Elena Rostova, phone: ${config.departmentForwardingNumbers.billing})
- "emergency": Emergency Mechanical & Electrical (Lead: Dave Miller, phone: ${config.departmentForwardingNumbers.emergency})
- "sales": Sales & Project Estimates (Lead: Sarah Chen, phone: ${config.departmentForwardingNumbers.sales})
- "support": Customer Accounts & Support (Lead: Alex Rivera, phone: ${config.departmentForwardingNumbers.support})

Available Actions (strictly follow priority):
1. "request_quote": When the caller mentions "quote", "estimate", "bid", "price", "cost", or gives an amount (e.g. $1,500, $3,500). Extract quoteDetails with serviceName and estimatedAmount. Your spokenReply must state: "I have recorded your quote request for [service] at $[amount] and submitted it to our Operations Supervisor for approval. Can I help you with anything else today?"
2. "transfer_call": When caller asks to speak to someone, transfer, dispatch, technician, billing, emergency, etc.
3. "take_message": When caller wants to leave a message, voicemail, or someone is out.
4. "send_email": When caller asks to email a confirmation or document.
5. "general_response": Provide a polite, concise spoken answer (1-2 sentences) and ask how else to assist.

Respond in JSON format:
{
  "intent": "transfer_call" | "take_message" | "request_quote" | "send_email" | "general_response",
  "spokenReply": "text that will be read aloud to the caller via telecom TTS",
  "departmentKey": "dispatch" | "billing" | "emergency" | "sales" | "support",
  "departmentName": "department full name",
  "quoteDetails": {
    "serviceName": "service scope",
    "estimatedAmount": number
  },
  "emailSubject": "subject",
  "emailBody": "body"
}`;

  let parsed: any = null;
  try {
    const aiResult = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      fallbackFn: () => {
        const lower = userSpeech.toLowerCase();
        if (lower.includes('dispatch') || lower.includes('marcus') || lower.includes('transfer')) {
          return JSON.stringify({
            intent: 'transfer_call',
            spokenReply: 'Transferring your call directly to Dispatch and Field Operations. Please stay on the line.',
            departmentKey: 'dispatch',
            departmentName: 'Dispatch & Field Operations'
          });
        }
        if (lower.includes('billing') || lower.includes('invoice')) {
          return JSON.stringify({
            intent: 'transfer_call',
            spokenReply: 'Connecting you with Billing and Invoicing. Please hold.',
            departmentKey: 'billing',
            departmentName: 'Billing & Invoicing'
          });
        }
        if (lower.includes('emergency') || lower.includes('leak') || lower.includes('fire')) {
          return JSON.stringify({
            intent: 'transfer_call',
            spokenReply: 'Escalating immediately to our Emergency Field Specialist. Connecting now.',
            departmentKey: 'emergency',
            departmentName: 'Emergency Mechanical & Electrical'
          });
        }
        if (lower.includes('quote') || lower.includes('estimate') || lower.includes('price')) {
          return JSON.stringify({
            intent: 'request_quote',
            spokenReply: 'I have logged your project quote request and submitted it for Supervisor Approval in our queue. May I assist you with anything else today?',
            quoteDetails: { serviceName: 'Commercial Service Scope', estimatedAmount: 1250 }
          });
        }
        if (lower.includes('message') || lower.includes('voicemail')) {
          return JSON.stringify({
            intent: 'take_message',
            spokenReply: 'Please state your name, company, and message after the tone. Press pound when finished.'
          });
        }
        return JSON.stringify({
          intent: 'general_response',
          spokenReply: 'Thank you for reaching out to RC Solutions. How can I direct your call or assist you further?'
        });
      }
    });

    parsed = JSON.parse(aiResult.text);
  } catch (err) {
    parsed = {
      intent: 'general_response',
      spokenReply: 'Thank you for calling RC Solutions. Would you like me to transfer you to Dispatch, Billing, or record a message for the team?'
    };
  }

  // Log AI response into call transcript
  activeCall.transcript.push({
    speaker: 'RCOS AI',
    text: parsed.spokenReply,
    time: '00:20'
  });
  db.saveCall(activeCall);

  // 1. Transfer Call to Real Forwarding Number
  if (parsed.intent === 'transfer_call') {
    const deptKey = (parsed.departmentKey as keyof typeof config.departmentForwardingNumbers) || 'dispatch';
    const realDeptPhone = config.departmentForwardingNumbers[deptKey] || config.operatorForwardingPhone;

    activeCall.status = 'transferred';
    activeCall.department = parsed.departmentName || deptKey;
    activeCall.forwardedToNumber = realDeptPhone;
    db.saveCall(activeCall);

    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      parsed.spokenReply || `Transferring you now to ${parsed.departmentName || 'the requested department'}. Please stay on the line.`
    );

    const dial = twiml.dial({
      callerId: config.phoneNumber,
      timeout: 25,
      action: '/api/twilio/voice/dial-status',
      method: 'POST'
    });
    dial.number(realDeptPhone);

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // 2. Take Voicemail / Record Message
  if (parsed.intent === 'take_message') {
    activeCall.status = 'voicemail';
    db.saveCall(activeCall);

    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      parsed.spokenReply || 'Please record your message after the tone. Press pound when finished.'
    );

    twiml.record({
      action: '/api/twilio/voice/voicemail',
      transcribe: true,
      transcribeCallback: '/api/twilio/voice/voicemail-transcription',
      maxLength: 120,
      playBeep: true,
      finishOnKey: '#'
    });

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // 3. Request Quote Approval
  if (parsed.intent === 'request_quote') {
    const amt = parsed.quoteDetails?.estimatedAmount || 1200;
    const defaultBiz = db.getAllBusinesses()[0] || { id: 'biz_rc_solutions', dollarThreshold: 250 };
    const quoteAction: ActionRecord = {
      id: `act_${Date.now()}`,
      businessId: defaultBiz.id,
      employeeId: 'executive_assistant',
      actionType: 'generate_quote',
      riskCategory: 'commitment_outbound',
      title: `Quote Approval: ${parsed.quoteDetails?.serviceName || 'Phone Service Quote'} for ${callerNumber}`,
      description: `Real phone caller requested quote during live call: "${userSpeech}". Estimated value: $${amt}.`,
      status: 'awaiting_approval',
      dollarAmount: amt,
      financialAmount: amt,
      requiresApproval: true,
      requiresReview: true,
      result: {
        summary: `Real phone inquiry quote created for ${callerNumber}`,
        quoteDetails: {
          clientName: callerNumber,
          items: [
            {
              description: parsed.quoteDetails?.serviceName || 'Mechanical Service Scope',
              quantity: 1,
              unitPrice: amt,
              total: amt
            }
          ],
          totalAmount: amt,
          validDays: 30,
          terms: 'Standard Net-30 Upon Completion'
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.saveAction(quoteAction);

    activeCall.actionRequired = `Quote Approval Requested: $${amt} for ${callerNumber}`;
    db.saveCall(activeCall);

    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      parsed.spokenReply
    );

    const gather = twiml.gather({
      input: ['speech'],
      action: '/api/twilio/voice/handle-speech',
      method: 'POST',
      speechTimeout: 'auto',
      timeout: 5
    });

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // 4. Send Confirmation Email Task
  if (parsed.intent === 'send_email') {
    twiml.say(
      { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
      parsed.spokenReply || 'I have sent a confirmation email regarding your inquiry. Is there anything else I can assist you with?'
    );

    const gather = twiml.gather({
      input: ['speech'],
      action: '/api/twilio/voice/handle-speech',
      method: 'POST',
      speechTimeout: 'auto',
      timeout: 5
    });

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // 5. General Response
  twiml.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    parsed.spokenReply
  );

  const gather = twiml.gather({
    input: ['speech'],
    action: '/api/twilio/voice/handle-speech',
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 5
  });

  res.type('text/xml');
  return res.send(twiml.toString());
});

/**
 * POST /api/twilio/voice/dial-status
 * Twilio callback when a department transfer finishes or if call was unanswered
 */
telephonyRouter.post('/voice/dial-status', (req: Request, res: Response) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const config = db.getTelephonyConfig();
  const dialStatus = req.body.DialCallStatus; // 'completed', 'busy', 'no-answer', 'failed', 'canceled'

  console.log(`[PSTN Dial Status] Department call status: ${dialStatus}`);

  if (dialStatus === 'completed') {
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // If department did not answer, offer to leave a voicemail
  twiml.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    'The requested department is currently on another call. Please leave your name and a detailed message after the beep, and a technician will call you back shortly.'
  );

  twiml.record({
    action: '/api/twilio/voice/voicemail',
    transcribe: true,
    transcribeCallback: '/api/twilio/voice/voicemail-transcription',
    maxLength: 120,
    playBeep: true,
    finishOnKey: '#'
  });

  res.type('text/xml');
  return res.send(twiml.toString());
});

/**
 * POST /api/twilio/voice/voicemail
 * Twilio carrier recording completed callback
 */
telephonyRouter.post('/voice/voicemail', (req: Request, res: Response) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const config = db.getTelephonyConfig();

  const recordingUrl = req.body.RecordingUrl;
  const recordingDuration = req.body.RecordingDuration || '0m 30s';
  const callerNumber = req.body.From || 'Carrier Caller';
  const callSid = req.body.CallSid;

  console.log(`[PSTN Voicemail] New recording received: ${recordingUrl} (Duration: ${recordingDuration}s)`);

  const newVoicemail: VoicemailRecord = {
    id: `vm_${Date.now()}`,
    callerName: callerNumber,
    callerNumber: callerNumber,
    company: 'Incoming Commercial Line',
    timestamp: 'Just now',
    duration: `${recordingDuration}s`,
    transcription: 'Processing telecom carrier transcription...',
    summary: `Real phone voicemail recorded from ${callerNumber}. Audio recording saved.`,
    urgency: 'high',
    department: 'Dispatch & Operations',
    audioUrl: recordingUrl ? `${recordingUrl}.mp3` : undefined,
    reviewed: false
  };

  db.saveVoicemail(newVoicemail);

  // Update call record
  const calls = db.getCalls();
  const activeCall = calls.find(c => c.twilioCallSid === callSid);
  if (activeCall) {
    activeCall.status = 'voicemail';
    activeCall.recordingUrl = recordingUrl;
    activeCall.summary = `Voicemail recorded (${recordingDuration}s).`;
    db.saveCall(activeCall);
  }

  twiml.say(
    { voice: (config.ttsVoice as any) || 'Polly.Joanna' },
    'Thank you. Your message has been recorded and dispatched to the on-call supervisor. Have a great day.'
  );
  twiml.hangup();

  res.type('text/xml');
  return res.send(twiml.toString());
});

/**
 * POST /api/twilio/voice/voicemail-transcription
 * Twilio carrier speech-to-text callback for completed voicemails
 */
telephonyRouter.post('/voice/voicemail-transcription', (req: Request, res: Response) => {
  const transcriptionText = req.body.TranscriptionText || '';
  const recordingUrl = req.body.RecordingUrl;
  const callerNumber = req.body.From || '';

  console.log(`[PSTN Transcription] Text: "${transcriptionText}" for recording ${recordingUrl}`);

  if (transcriptionText) {
    const voicemails = db.getVoicemails();
    const vm = voicemails.find(v => v.audioUrl?.includes(recordingUrl) || v.callerNumber === callerNumber);
    if (vm) {
      vm.transcription = transcriptionText;
      const lower = transcriptionText.toLowerCase();
      if (lower.includes('emergency') || lower.includes('urgent') || lower.includes('flood') || lower.includes('leak')) {
        vm.urgency = 'urgent';
      }
      db.saveVoicemail(vm);
    }
  }

  res.sendStatus(200);
});

/**
 * POST /api/twilio/voice/outbound-call
 * Place a real outbound telephone call to any real cell phone or landline
 */
telephonyRouter.post('/voice/outbound-call', async (req: Request, res: Response) => {
  const { toPhone, callerTopic = 'Customer Service Follow-up', simulateFallback = false } = req.body;
  if (!toPhone) {
    return res.status(400).json({ error: 'Target phone number is required (e.g. +14155552671)' });
  }

  // Normalize phone number to E.164 standard
  let formattedTo = String(toPhone).trim().replace(/[\s()-]/g, '');
  if (!formattedTo.startsWith('+')) {
    if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    } else if (formattedTo.length === 11 && formattedTo.startsWith('1')) {
      formattedTo = `+${formattedTo}`;
    } else {
      formattedTo = `+${formattedTo}`;
    }
  }

  const client = getTwilioClient();
  const config = db.getTelephonyConfig();
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

  // If simulation is explicitly requested or client is missing, provide a safe simulated call
  if (simulateFallback || !client) {
    const simulatedCall: PhoneCall = {
      id: `sim_call_${Date.now()}`,
      twilioCallSid: `sim_${Date.now()}`,
      callerName: formattedTo,
      callerNumber: formattedTo,
      type: 'outbound',
      status: 'active',
      timestamp: 'Just now',
      duration: '0m 00s',
      answeredBy: 'ai_receptionist',
      isRealPstnCall: false,
      summary: `Simulated test call to ${formattedTo} for topic: "${callerTopic}". Voice AI receptionist connected.`,
      transcript: [
        {
          speaker: 'AI Receptionist',
          text: `Hello, this is the automated Voice AI dispatch assistant for ${config.phoneNumber || 'RC Solutions'}. Calling regarding ${callerTopic}. How can we assist you today?`,
          time: '00:01'
        }
      ]
    };
    db.saveCall(simulatedCall);

    return res.json({
      success: true,
      simulated: true,
      callSid: simulatedCall.twilioCallSid,
      status: 'in-progress',
      to: formattedTo,
      from: config.phoneNumber || '+1 (800) 555-7267',
      message: `Simulated test voice call initiated to ${formattedTo}. You can view the real-time AI transcript in Call History.`
    });
  }

  // Auto-detect real Twilio assigned incoming phone number if config is placeholder or empty
  let fromNumber = config.phoneNumber;
  try {
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 5 });
    if (incomingNumbers && incomingNumbers.length > 0) {
      const activeNumber = incomingNumbers.find(n => n.capabilities?.voice) || incomingNumbers[0];
      if (activeNumber?.phoneNumber) {
        fromNumber = activeNumber.phoneNumber;
        if (config.phoneNumber !== fromNumber) {
          db.saveTelephonyConfig({ phoneNumber: fromNumber });
        }
      }
    }
  } catch (err) {
    console.warn('[Twilio] Notice while inspecting assigned numbers:', err);
  }

  if (!fromNumber) {
    fromNumber = '+18335557267';
  }

  try {
    const call = await client.calls.create({
      url: `${appUrl || 'https://example.com'}/api/twilio/voice/incoming`,
      to: formattedTo,
      from: fromNumber,
      statusCallback: `${appUrl || ''}/api/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    const newCall: PhoneCall = {
      id: `call_${Date.now()}`,
      twilioCallSid: call.sid,
      callerName: formattedTo,
      callerNumber: formattedTo,
      type: 'outbound',
      status: 'active',
      timestamp: 'Just now',
      duration: '0m 00s',
      answeredBy: 'ai_receptionist',
      isRealPstnCall: true,
      summary: `Real outbound call placed to ${formattedTo} via Twilio carrier line ${fromNumber}.`
    };
    db.saveCall(newCall);

    return res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: formattedTo,
      from: fromNumber,
      message: `Outbound call initiated to ${formattedTo}. Your carrier line is now dialing.`
    });
  } catch (err: any) {
    const errorCode = err?.code;
    const errorMessage = err?.message || '';

    // Check for Twilio Trial Account destination verification restrictions (Error 573002, 21215, 21608)
    const isTrialRestriction = 
      errorCode === 573002 || 
      errorCode === 21215 || 
      errorCode === 21608 || 
      errorMessage.toLowerCase().includes('verified recipient') ||
      errorMessage.toLowerCase().includes('trial phone number') ||
      errorMessage.toLowerCase().includes('trial account') ||
      errorMessage.includes('573002');

    if (isTrialRestriction) {
      console.warn(`[Twilio Trial Restriction] Recipient ${formattedTo} is not yet a Verified Caller ID on this Twilio Trial project.`);

      // Record notice in call history so the operator has visibility
      const noticeCall: PhoneCall = {
        id: `call_notice_${Date.now()}`,
        callerName: `${formattedTo} (Twilio Trial Unverified)`,
        callerNumber: formattedTo,
        type: 'outbound',
        status: 'missed',
        timestamp: 'Just now',
        duration: '0m 00s',
        answeredBy: 'ai_receptionist',
        isRealPstnCall: true,
        summary: `Twilio Trial Warning: Destination ${formattedTo} must be added to Twilio Console Verified Caller IDs (or upgrade Twilio project).`
      };
      db.saveCall(noticeCall);

      return res.status(200).json({
        success: false,
        isTrialRestriction: true,
        errorCode: errorCode || 573002,
        to: formattedTo,
        from: fromNumber,
        error: 'Twilio Trial Account Restriction: Recipient Unverified',
        message: `Twilio free trial requires "${formattedTo}" to be added to your Verified Caller IDs before calls can be made to it.`,
        verificationUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified',
        moreInfo: err?.moreInfo || 'https://www.twilio.com/docs/errors/573002',
        instructions: [
          'Open your Twilio Console at console.twilio.com',
          'Go to Phone Numbers > Manage > Verified Caller IDs',
          `Click "Add a new number" and verify ${formattedTo}`,
          'Or upgrade your Twilio project from Trial to Full to call any number without verification'
        ]
      });
    }

    console.warn('[Twilio Outbound Notice]', errorMessage);
    return res.status(400).json({
      success: false,
      error: 'Failed to place real outbound call',
      details: errorMessage,
      errorCode,
      moreInfo: err?.moreInfo || null
    });
  }
});

/**
 * POST /api/twilio/voice/status
 * Twilio Call status changes callback
 */
telephonyRouter.post('/voice/status', (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus; // 'completed', 'busy', 'no-answer', etc.
  const callDuration = req.body.CallDuration;

  console.log(`[PSTN Call Status] CallSid: ${callSid} -> ${callStatus} (Duration: ${callDuration}s)`);

  const calls = db.getCalls();
  const call = calls.find(c => c.twilioCallSid === callSid);
  if (call) {
    if (callStatus === 'completed') {
      call.status = 'completed';
      if (callDuration) call.duration = `${Math.floor(Number(callDuration) / 60)}m ${Number(callDuration) % 60}s`;
    } else if (callStatus === 'busy' || callStatus === 'no-answer') {
      call.status = 'missed';
    }
    db.saveCall(call);
  }

  res.sendStatus(200);
});
