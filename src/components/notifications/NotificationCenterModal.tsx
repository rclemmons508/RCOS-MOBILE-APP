import React, { useState } from 'react';
import { RCOSNotification, TabType } from '../../types';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Phone, 
  Trash2, 
  CheckCheck, 
  Settings, 
  X, 
  ChevronRight, 
  ExternalLink 
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: RCOSNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenPreferences: () => void;
  onNavigateTab: (tab: TabType) => void;
  onTriggerTestNotification: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onOpenPreferences,
  onNavigateTab,
  onTriggerTestNotification,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'emergency_dispatch' | 'performance_anomaly'>('all');
  const [selectedNotification, setSelectedNotification] = useState<RCOSNotification | null>(null);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const getIcon = (type: RCOSNotification['type']) => {
    switch (type) {
      case 'emergency_dispatch':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'performance_anomaly':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'task_completion':
        return <CheckCircle2 className="w-4 h-4 text-lime-400" />;
      case 'call_event':
        return <Phone className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  const handleSelectNotif = (notif: RCOSNotification) => {
    onMarkAsRead(notif.id);
    setSelectedNotification(notif);
  };

  const handleActionClick = (notif: RCOSNotification) => {
    if (notif.module === 'Jobs Dispatcher') {
      onNavigateTab('jobs');
    } else if (notif.module === 'Phone System') {
      onNavigateTab('phone');
    } else if (notif.module === 'CRM') {
      onNavigateTab('clients');
    } else {
      onNavigateTab('more');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
        
        {/* Top Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 bg-black/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-lime-500 text-black font-extrabold text-[9px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                RCOS Notifications
              </h3>
              <p className="text-[11px] text-zinc-400">
                {unreadCount > 0 ? `${unreadCount} unread system alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="p-2 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 hover:border-lime-500/40 cursor-pointer"
              title="Notification Preferences"
            >
              <Settings className="w-4 h-4 text-lime-400" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Badges & Quick Action Controls */}
        <div className="p-3 border-b border-zinc-800/60 bg-zinc-950 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-lime-500 text-black'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'unread'
                  ? 'bg-lime-500 text-black'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('emergency_dispatch')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'emergency_dispatch'
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-red-400 hover:text-white'
              }`}
            >
              Dispatches
            </button>
            <button
              type="button"
              onClick={() => setFilter('performance_anomaly')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'performance_anomaly'
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-900 border border-zinc-800 text-amber-400 hover:text-white'
              }`}
            >
              Anomalies
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 px-1">
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[10px] text-zinc-400 hover:text-lime-400 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onTriggerTestNotification}
                className="text-[10px] text-lime-400 hover:underline font-semibold cursor-pointer"
              >
                + Test Push
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedNotification ? (
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  {getIcon(selectedNotification.type)}
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {selectedNotification.module || 'RCOS Notification'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="text-xs text-lime-400 hover:underline font-semibold cursor-pointer"
                >
                  ← Back to List
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">{selectedNotification.title}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed bg-black/50 p-3 rounded-xl border border-zinc-800 font-mono">
                  {selectedNotification.message}
                </p>
              </div>

              {selectedNotification.actionTaken && (
                <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 text-xs flex items-center justify-between">
                  <span>Action Executed:</span>
                  <span className="font-bold">{selectedNotification.actionTaken}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800">
                <span>Priority: <strong className="text-white uppercase">{selectedNotification.priority}</strong></span>
                <span>{selectedNotification.timestamp}</span>
              </div>

              <button
                type="button"
                onClick={() => handleActionClick(selectedNotification)}
                className="w-full py-2.5 rounded-xl bg-lime-500 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-lime-400 transition-all cursor-pointer"
              >
                <span>Open Module View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs text-zinc-400">No notifications in this filter.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleSelectNotif(notif)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer hover:border-zinc-700 flex items-start gap-3 ${
                  !notif.read
                    ? 'bg-zinc-900/90 border-lime-500/30 text-white'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-400'
                }`}
              >
                <div className="p-2 rounded-xl bg-black border border-zinc-800 shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-300">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-zinc-500">{notif.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-tight">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase font-mono">
                      {notif.module || 'RCOS'}
                    </span>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 self-center" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-black/60 flex items-center justify-between pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onOpenPreferences}
            className="text-xs text-lime-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences & Quiet Hours</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-bold hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
