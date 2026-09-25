import React, { useEffect } from 'react';
import { RCOSNotification } from '../../types';
import { Bell, AlertTriangle, CheckCircle2, Zap, Phone, X, ArrowRight } from 'lucide-react';

interface NotificationToastProps {
  notification: RCOSNotification | null;
  onClose: () => void;
  onView: (notification: RCOSNotification) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onView,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'emergency_dispatch':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'performance_anomaly':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'task_completion':
        return <CheckCircle2 className="w-5 h-5 text-lime-400" />;
      case 'call_event':
        return <Phone className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-purple-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.priority) {
      case 'critical':
        return 'border-red-500/60 bg-red-950/80';
      case 'high':
        return 'border-amber-500/60 bg-amber-950/80';
      case 'medium':
        return 'border-lime-500/60 bg-zinc-950';
      default:
        return 'border-zinc-800 bg-zinc-950';
    }
  };

  return (
    <div className="fixed top-14 sm:top-16 left-0 right-0 z-50 px-3 max-w-md mx-auto pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`pointer-events-auto p-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 transition-all ${getBorderColor()}`}
      >
        <div className="p-2 rounded-xl bg-black/60 border border-zinc-800 shrink-0 mt-0.5">
          {getIcon()}
        </div>

        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {notification.module || 'RCOS System'}
            </span>
            <span className="text-[10px] text-zinc-400">{notification.timestamp}</span>
          </div>

          <h4 className="text-xs font-bold text-white truncate">{notification.title}</h4>
          <p className="text-[11px] text-zinc-300 line-clamp-2 leading-tight">{notification.message}</p>

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onView(notification)}
              className="text-[11px] text-lime-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <span className="text-[9px] text-zinc-500 uppercase font-mono">
              PUSH ALERT
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-1 shrink-0 cursor-pointer"
          aria-label="Dismiss Push Notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
