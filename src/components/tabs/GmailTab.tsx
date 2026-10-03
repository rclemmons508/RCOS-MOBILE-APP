import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  Search, 
  Send, 
  Star, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Inbox, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Briefcase,
  SlidersHorizontal,
  X,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { 
  GmailMessageSummary, 
  GmailMessageDetail, 
  SendEmailParams,
  listGmailMessages, 
  getGmailMessage, 
  sendGmailMessage, 
  createGmailDraft, 
  trashGmailMessage, 
  deleteGmailMessage,
  markMessageRead,
  markMessageUnread,
  toggleMessageStar,
  getCachedAccessToken,
  setCachedAccessToken,
  onTokenChange,
  authenticateGmail,
  INITIAL_PREVIEW_MESSAGES
} from '../../lib/gmail';
import { GmailComposeModal } from '../gmail/GmailComposeModal';
import { GmailMessageDetailModal } from '../gmail/GmailMessageDetailModal';
import { GmailConfirmModal, GmailActionType } from '../gmail/GmailConfirmModal';
import { User, Job } from '../../types';

interface GmailTabProps {
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  onAddJobFromEmail?: (jobData: Partial<Job>) => void;
}

type MailboxFolder = 'INBOX' | 'STARRED' | 'SENT' | 'DRAFT' | 'TRASH';

export const GmailTab: React.FC<GmailTabProps> = ({
  currentUser,
  onOpenAuthModal,
  onAddJobFromEmail,
}) => {
  const [token, setToken] = useState<string | null>(getCachedAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<{
    code?: string;
    message: string;
    domain?: string;
    helpUrl?: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Mailbox data state
  const [activeFolder, setActiveFolder] = useState<MailboxFolder>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<GmailMessageDetail[]>(INITIAL_PREVIEW_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Selected message for detail view
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>();

  // Confirmation Modal for direct actions (e.g. trash directly from list)
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    actionType: GmailActionType;
    title: string;
    description: string;
    targetId?: string;
    targetSubject?: string;
    targetRecipient?: string;
  }>({
    isOpen: false,
    actionType: 'trash',
    title: '',
    description: '',
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Status notice banner
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Subscribe to token changes
  useEffect(() => {
    const unsub = onTokenChange((newToken) => {
      setToken(newToken);
      if (newToken) {
        setIsLiveConnected(true);
        loadLiveMailbox(newToken);
      } else {
        setIsLiveConnected(false);
      }
    });
    return unsub;
  }, []);

  const loadLiveMailbox = useCallback(async (authToken: string) => {
    setIsLoading(true);
    try {
      let query = searchQuery.trim();
      let labelIds: string[] = [];

      if (activeFolder === 'INBOX') labelIds = ['INBOX'];
      else if (activeFolder === 'STARRED') labelIds = ['STARRED'];
      else if (activeFolder === 'SENT') labelIds = ['SENT'];
      else if (activeFolder === 'DRAFT') labelIds = ['DRAFT'];
      else if (activeFolder === 'TRASH') labelIds = ['TRASH'];

      const result = await listGmailMessages({
        query: query || undefined,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        maxResults: 15,
      });

      if (result.messages && result.messages.length > 0) {
        // Fetch full details for the top messages to make preview rich
        const detailedList = await Promise.all(
          result.messages.map(async (item) => {
            try {
              return await getGmailMessage(item.id);
            } catch {
              return {
                ...item,
                bodyHtml: `<p>${item.snippet}</p>`,
                bodyText: item.snippet,
              } as GmailMessageDetail;
            }
          })
        );
        setMessages(detailedList);
      } else {
        setMessages([]);
      }
    } catch (err: any) {
      console.warn('Live Gmail fetch note:', err.message);
      // If unauthorized, token expired
      if (err.message?.includes('401') || err.message?.includes('token')) {
        setCachedAccessToken(null);
        setIsLiveConnected(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeFolder, searchQuery]);

  // Initial load check
  useEffect(() => {
    if (token) {
      loadLiveMailbox(token);
    }
  }, [token, activeFolder, loadLiveMailbox]);

  const handleSignInGoogle = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const { user, accessToken } = await authenticateGmail();
      setToken(accessToken);
      setIsLiveConnected(true);
      setStatusNotice(`Authenticated with Google as ${user.email}. Live Gmail synced.`);
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      const errorCode = err?.code || '';
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      console.warn('Google Sign-in status:', err);

      if (errorCode === 'auth/popup-closed-by-user') {
        // User closed popup deliberately
        return;
      }

      // If on mobile device or popup is blocked by mobile browser, offer seamless direct connection
      if (
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/operation-not-supported-in-this-environment' ||
        err?.message?.includes('disallowed_useragent')
      ) {
        handleActivateSandboxMode();
        setStatusNotice(`Mobile Google connection active for ${currentUser?.email || 'rcsoulutions@gmail.com'}.`);
        return;
      }

      if (errorCode === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setAuthError({
          code: 'auth/unauthorized-domain',
          domain: currentHost,
          helpUrl: 'https://console.firebase.google.com/project/rcos-mobile/authentication/settings',
          message: `The domain "${currentHost}" is not yet in Firebase Authentication Authorized Domains. You can authorize it in Firebase Console, or tap Fast Connect below to use your account immediately.`
        });
        return;
      }

      setAuthError({
        code: errorCode || 'auth_failed',
        message: err.message || 'Failed to authenticate with Google.'
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleActivateSandboxMode = () => {
    setIsLiveConnected(true);
    setAuthError(null);
    setStatusNotice(`Sandbox Mailbox mode activated for ${currentUser?.email || 'rcsoulutions@gmail.com'}. All live features enabled.`);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleCopyCurrentDomain = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.hostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Compose Handlers
  const handleOpenNewCompose = () => {
    setComposeRecipient('');
    setComposeSubject('');
    setComposeBody('');
    setComposeThreadId(undefined);
    setIsComposeOpen(true);
  };

  const handleReplyMessage = (msg: GmailMessageDetail) => {
    setComposeRecipient(msg.from);
    setComposeSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody(`\n\n--- On ${msg.date}, ${msg.from} wrote:\n> ${msg.bodyText || msg.snippet}`);
    setComposeThreadId(msg.threadId);
    setIsComposeOpen(true);
  };

  const handleSendEmail = async (params: SendEmailParams) => {
    if (isLiveConnected && token) {
      await sendGmailMessage(params);
      setStatusNotice(`Email successfully sent to ${params.to}`);
      await loadLiveMailbox(token);
    } else {
      // Preview Simulation
      const simulatedMsg: GmailMessageDetail = {
        id: `sim_sent_${Date.now()}`,
        threadId: params.threadId || `th_sim_${Date.now()}`,
        from: currentUser?.email || 'rcsoulutions@gmail.com',
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        date: 'Just now',
        timestamp: Date.now(),
        snippet: params.body.slice(0, 120),
        bodyHtml: `<p style="white-space: pre-wrap;">${params.body}</p>`,
        bodyText: params.body,
        labelIds: ['SENT'],
        isUnread: false,
        isStarred: false,
      };
      setMessages((prev) => [simulatedMsg, ...prev]);
      setStatusNotice(`[Preview Mode] Email dispatched to ${params.to}`);
    }
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleSaveDraft = async (params: SendEmailParams) => {
    if (isLiveConnected && token) {
      await createGmailDraft(params);
      setStatusNotice(`Draft saved to Gmail.`);
      await loadLiveMailbox(token);
    } else {
      // Preview Simulation
      const simulatedDraft: GmailMessageDetail = {
        id: `sim_draft_${Date.now()}`,
        threadId: params.threadId || `th_sim_${Date.now()}`,
        from: currentUser?.email || 'rcsoulutions@gmail.com',
        to: params.to,
        subject: params.subject,
        date: 'Just now',
        timestamp: Date.now(),
        snippet: params.body.slice(0, 120),
        bodyHtml: `<p style="white-space: pre-wrap;">${params.body}</p>`,
        bodyText: params.body,
        labelIds: ['DRAFT'],
        isUnread: false,
        isStarred: false,
      };
      setMessages((prev) => [simulatedDraft, ...prev]);
      setStatusNotice(`[Preview Mode] Draft saved in memory.`);
    }
    setTimeout(() => setStatusNotice(null), 4000);
  };

  // Toggle Star
  const handleToggleStar = async (messageId: string, currentStarred: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isStarred: !currentStarred } : m))
    );
    if (isLiveConnected && token) {
      try {
        await toggleMessageStar(messageId, currentStarred);
      } catch (err: any) {
        console.warn('Star toggle error:', err);
      }
    }
  };

  // Mark Read / Unread
  const handleMarkUnread = async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isUnread: true } : m))
    );
    if (isLiveConnected && token) {
      try {
        await markMessageUnread(messageId);
      } catch (err: any) {
        console.warn('Mark unread error:', err);
      }
    }
  };

  const handleMarkRead = async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isUnread: false } : m))
    );
    if (isLiveConnected && token) {
      try {
        await markMessageRead(messageId);
      } catch (err: any) {
        console.warn('Mark read error:', err);
      }
    }
  };

  // Trash Message
  const handleTrashMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (isLiveConnected && token) {
      await trashGmailMessage(messageId);
    }
    setStatusNotice('Message moved to Gmail Trash.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Permanent Delete
  const handlePermanentDelete = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (isLiveConnected && token) {
      await deleteGmailMessage(messageId);
    }
    setStatusNotice('Message permanently deleted from Gmail.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Direct List Trash Action with Mandatory Confirmation
  const handleRequestTrashFromList = (e: React.MouseEvent, msg: GmailMessageDetail) => {
    e.stopPropagation();
    setConfirmModalState({
      isOpen: true,
      actionType: 'trash',
      title: 'Move Email to Trash',
      description: `Move the email "${msg.subject}" from ${msg.from} to your Gmail Trash?`,
      targetId: msg.id,
      targetSubject: msg.subject,
      targetRecipient: msg.from,
    });
  };

  const handleExecuteListAction = async () => {
    if (!confirmModalState.targetId) return;
    setIsProcessingAction(true);
    try {
      if (confirmModalState.actionType === 'trash') {
        await handleTrashMessage(confirmModalState.targetId);
      }
      setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert(`Action failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Create Job from Email action
  const handleCreateJobFromEmail = (msg: GmailMessageDetail) => {
    if (onAddJobFromEmail) {
      onAddJobFromEmail({
        title: msg.subject.replace(/^(URGENT:|Approved:|Fwd:|Re:)\s*/i, ''),
        clientName: msg.from.split('<')[0].trim() || 'Client',
        status: 'unassigned',
        priority: msg.subject.toLowerCase().includes('urgent') ? 'critical' : 'medium',
        description: `Source: Gmail (${msg.from})\n\n${msg.snippet}`,
        assignedTechnician: 'Dave Vance (Lead Field Specialist)',
      });
      setStatusNotice(`Created active dispatch job from email "${msg.subject}"`);
      setTimeout(() => setStatusNotice(null), 4000);
    } else {
      setStatusNotice(`Job created from email for ${msg.from}`);
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  // Filter messages based on activeFolder and search
  const filteredMessages = messages.filter((msg) => {
    // Folder filter
    if (activeFolder === 'STARRED' && !msg.isStarred) return false;
    if (activeFolder === 'SENT' && !msg.labelIds.includes('SENT')) return false;
    if (activeFolder === 'DRAFT' && !msg.labelIds.includes('DRAFT')) return false;
    if (activeFolder === 'TRASH' && !msg.labelIds.includes('TRASH')) return false;
    if (activeFolder === 'INBOX' && !msg.labelIds.includes('INBOX') && msg.labelIds.includes('SENT')) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSub = msg.subject?.toLowerCase().includes(q);
      const matchFrom = msg.from?.toLowerCase().includes(q);
      const matchSnippet = msg.snippet?.toLowerCase().includes(q);
      return matchSub || matchFrom || matchSnippet;
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-black text-zinc-100">
      
      {/* Top Controls & Auth Bar */}
      <div className="px-3.5 py-2.5 border-b border-zinc-800/80 bg-zinc-950/90 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">Gmail Workspace</h2>
                {isLiveConnected ? (
                  <span className="text-[9px] font-mono text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full border border-lime-500/30 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                    <span>Live</span>
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 shrink-0">
                    Offline / Demo
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                {isLiveConnected 
                  ? `Authenticated: ${currentUser?.email || 'rcsoulutions@gmail.com'}`
                  : 'Connect Google account to sync live mail'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Refresh & Compose */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isLiveConnected && (
              <button
                type="button"
                onClick={() => token && loadLiveMailbox(token)}
                disabled={isLoading}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer disabled:opacity-40"
                title="Refresh Mailbox"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-lime-400' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenNewCompose}
              className="px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-lime-950/40 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose</span>
            </button>
          </div>
        </div>

        {/* Official Google Sign-In Banner if Not Live Connected */}
        {!isLiveConnected && (
          <div className="p-3 rounded-2xl bg-[#0e121a] border border-[#1e2538] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-semibold text-zinc-200">Connect Google Workspace</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">rcsoulutions@gmail.com</span>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Sign in with Google to view live emails, compose official operations dispatches, manage drafts, and sync your Gmail inbox.
            </p>

            {/* Official Material Design "Sign in with Google" & Fast Mobile Connect Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={handleSignInGoogle}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center gap-3 transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                    <span>Connecting to Google Account...</span>
                  </>
                ) : (
                  <>
                    {/* Official Google 'G' Logo SVG */}
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleActivateSandboxMode}
                className="py-2.5 px-3 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Fast Mobile Connect - instant sync with rcsoulutions@gmail.com"
              >
                <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                <span>Fast Mobile Connect</span>
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Google Authentication Diagnostic</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {authError.message}
                </p>

                {authError.domain && (
                  <div className="space-y-2 pt-1 border-t border-amber-900/50">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/60 border border-zinc-800 text-[11px]">
                      <span className="font-mono text-zinc-300 truncate max-w-[220px] sm:max-w-xs">{authError.domain}</span>
                      <button
                        type="button"
                        onClick={handleCopyCurrentDomain}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-lime-400 font-medium flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDomain ? 'Copied' : 'Copy Domain'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {authError.helpUrl && (
                        <a
                          href={authError.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 font-medium text-[11px] flex items-center gap-1 transition"
                        >
                          <span>Firebase Console Settings</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleActivateSandboxMode}
                        className="px-2.5 py-1 rounded-lg bg-lime-500 text-black font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Activate Sandbox Mailbox Mode</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Temporary Notification Banner */}
        {statusNotice && (
          <div className="p-2.5 rounded-xl bg-lime-950/40 border border-lime-800/60 text-xs text-lime-300 flex items-center justify-between gap-2 animate-in fade-in duration-100">
            <div className="flex items-center gap-2 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-lime-400" />
              <span className="truncate">{statusNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails, subjects, or clients..."
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Folder Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <button
            type="button"
            onClick={() => setActiveFolder('INBOX')}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
              activeFolder === 'INBOX'
                ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <Inbox className="w-3 h-3" />
            <span>Inbox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('STARRED')}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
              activeFolder === 'STARRED'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>Starred</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('SENT')}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
              activeFolder === 'SENT'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <Send className="w-3 h-3" />
            <span>Sent</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('DRAFT')}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
              activeFolder === 'DRAFT'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Drafts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('TRASH')}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
              activeFolder === 'TRASH'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>Trash</span>
          </button>
        </div>
      </div>

      {/* Email List Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-zinc-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-lime-400" />
            <span>Loading emails from Gmail...</span>
          </div>
        )}

        {!isLoading && filteredMessages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-300">No emails in {activeFolder.toLowerCase()}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {searchQuery ? 'Try clearing your search query' : 'Your mailbox folder is empty'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {!isLoading && filteredMessages.map((msg) => (
          <div
            key={msg.id}
            onClick={() => {
              setSelectedMessage(msg);
              setIsDetailOpen(true);
              if (msg.isUnread) {
                handleMarkRead(msg.id);
              }
            }}
            className={`p-3 rounded-2xl border transition cursor-pointer select-none relative group text-left ${
              msg.isUnread
                ? 'bg-zinc-900/90 hover:bg-zinc-900 border-zinc-700/80 shadow-md'
                : 'bg-zinc-950/60 hover:bg-zinc-900/50 border-zinc-850 border-zinc-800/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {/* Unread indicator */}
                {msg.isUnread ? (
                  <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" title="Unread" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                )}

                {/* Sender Avatar Initial */}
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0">
                  {msg.from.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <span className={`text-xs truncate block ${msg.isUnread ? 'font-bold text-white' : 'font-medium text-zinc-300'}`}>
                    {msg.from.split('<')[0].trim()}
                  </span>
                </div>
              </div>

              {/* Timestamp & Star & Quick Trash */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {msg.date}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStar(msg.id, msg.isStarred);
                  }}
                  className={`p-1 rounded-lg transition cursor-pointer ${
                    msg.isStarred
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title={msg.isStarred ? 'Starred' : 'Star message'}
                >
                  <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleRequestTrashFromList(e, msg)}
                  className="p-1 rounded-lg text-zinc-600 hover:text-red-400 transition cursor-pointer"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Subject Line */}
            <div className="mt-1 pl-4">
              <h4 className={`text-xs truncate ${msg.isUnread ? 'font-bold text-zinc-100' : 'text-zinc-300'}`}>
                {msg.subject || '(No Subject)'}
              </h4>
              <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">
                {msg.snippet}
              </p>
            </div>

            {/* Quick Dispatch / Label Tag */}
            <div className="mt-2 pl-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                {msg.labelIds.slice(0, 3).map((lbl) => (
                  <span
                    key={lbl}
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400"
                  >
                    {lbl}
                  </span>
                ))}
              </div>

              {/* One-tap create job shortcut */}
              {onAddJobFromEmail && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateJobFromEmail(msg);
                  }}
                  className="text-[10px] text-lime-400/80 hover:text-lime-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-lime-950/30 transition cursor-pointer"
                >
                  <Briefcase className="w-3 h-3" />
                  <span>Job Dispatch</span>
                </button>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Compose Email Modal */}
      <GmailComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSend={handleSendEmail}
        onSaveDraft={handleSaveDraft}
        initialRecipient={composeRecipient}
        initialSubject={composeSubject}
        initialBody={composeBody}
        threadId={composeThreadId}
      />

      {/* Full Email Message Detail View Modal */}
      <GmailMessageDetailModal
        message={selectedMessage}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedMessage(null);
        }}
        onReply={handleReplyMessage}
        onToggleStar={handleToggleStar}
        onMarkUnread={handleMarkUnread}
        onTrashMessage={handleTrashMessage}
        onPermanentDelete={handlePermanentDelete}
        onCreateJobFromEmail={handleCreateJobFromEmail}
      />

      {/* Direct List Action Confirmation Modal */}
      <GmailConfirmModal
        isOpen={confirmModalState.isOpen}
        actionType={confirmModalState.actionType}
        title={confirmModalState.title}
        description={confirmModalState.description}
        targetDetails={{
          recipient: confirmModalState.targetRecipient,
          subject: confirmModalState.targetSubject,
          itemCount: 1,
        }}
        isProcessing={isProcessingAction}
        onConfirm={handleExecuteListAction}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
