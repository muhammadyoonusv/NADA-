import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Trash2, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'err' | 'info';
  timestamp: number;
  read: boolean;
}

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
}

export function NotificationCenter({ notifications, onMarkAllAsRead, onClearAll, onMarkAsRead }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'err': return <AlertCircle size={16} className="text-rose-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition-all shadow-3xs cursor-pointer ${
          isOpen
            ? 'bg-slate-900 border-slate-900 text-white scale-[0.98]'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900'
        }`}
      >
        <Bell size={14} className={isOpen ? 'text-white' : 'text-slate-500'} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 shadow-sm">
            <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[28rem]"
          >
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                <Bell size={14} className="text-slate-500" />
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    title="Mark all as read"
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <CheckSquare size={14} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    title="Clear all"
                    className="p-1 hover:bg-rose-100 rounded text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-1 bg-white">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <Bell size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">All caught up!</p>
                  <p className="text-xs mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <AnimatePresence initial={false}>
                    {notifications.map((notif) => (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`group p-3 rounded-lg flex items-start gap-3 transition-colors ${
                          notif.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
                        }`}
                        onClick={() => !notif.read && onMarkAsRead(notif.id)}
                      >
                        <div className="mt-0.5 shrink-0 bg-white rounded-full p-0.5 shadow-xs">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-relaxed ${notif.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 font-medium tracking-wide">
                            {formatTime(notif.timestamp)}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
            {notifications.length > 5 && (
              <div className="p-2 border-t border-gray-50 bg-gray-50/50 text-center text-[10px] text-gray-400 font-medium">
                Scroll to view older notifications
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
