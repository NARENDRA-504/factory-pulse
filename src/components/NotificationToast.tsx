import React, { useEffect, useState } from 'react';
import { LiveNotification } from '../services/notificationService';
import { Bell, AlertTriangle, X, ArrowRight } from 'lucide-react';

interface NotificationToastProps {
  notification: LiveNotification | null;
  onClose: () => void;
  onOpenCenter: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onOpenCenter,
}) => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose();
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [notification]);

  if (!notification || !visible) return null;

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-50 max-w-sm w-full bg-white border border-amber-300 rounded-2xl shadow-xl p-4 animate-slideIn">
      <div className="flex items-start gap-3">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            notification.severity === 'Critical'
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                notification.severity === 'Critical'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {notification.severity} Alert
            </span>
            <button
              onClick={() => {
                setVisible(false);
                onClose();
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h5 className="font-bold text-xs text-slate-900 mt-1 truncate">
            {notification.machineCode}: {notification.title}
          </h5>
          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
            {notification.message}
          </p>

          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-mono">Live Push · Instant</span>
            <button
              onClick={() => {
                setVisible(false);
                onOpenCenter();
              }}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>View Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
