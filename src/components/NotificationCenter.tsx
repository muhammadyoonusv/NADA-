import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Info, CheckCheck, Check } from 'lucide-react';
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
  onClearAll?: () => void;
  onMarkAsRead: (id: string) => void;
}

export function NotificationCenter({ notifications, onMarkAllAsRead, onMarkAsRead }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
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
          <>
            {/* Mobile Android Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs sm:hidden z-40"
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-3 right-3 top-18 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-85 max-w-md sm:max-w-none bg-white rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl border border-gray-200/80 overflow-hidden z-50 flex flex-col max-h-[calc(100vh-7rem)] sm:max-h-[28rem]"
            >
              {/* Android Touch Pull/Drag Handle */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-slate-50 border-b border-gray-100">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                    <Bell size={14} className="text-slate-500" />
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-mono">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      title="Mark all as read"
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200/70 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={14} />
                      <span className="hidden sm:inline">Mark all as read</span>
                      <span className="sm:hidden">Read all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

            <div className="overflow-y-auto flex-1 p-1.5 bg-white">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <Bell size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">All caught up!</p>
                  <p className="text-xs mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {notifications.map((notif) => (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`group p-3 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
                          notif.read ? 'bg-white hover:bg-slate-50/80 border border-transparent' : 'bg-indigo-50/40 hover:bg-indigo-50/70 border border-indigo-100/70 shadow-3xs'
                        }`}
                        onClick={() => !notif.read && onMarkAsRead(notif.id)}
                      >
                        <div className="mt-0.5 shrink-0 bg-white rounded-full p-1 shadow-3xs border border-gray-100">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-relaxed ${notif.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <span className="text-[10px] text-gray-400 font-medium tracking-wide font-mono">
                              {formatTime(notif.timestamp)}
                            </span>
                            {notif.read ? (
                              <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                <CheckCheck size={12} className="text-slate-400" />
                                <span>Read</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAsRead(notif.id);
                                }}
                                className="px-2 py-0.5 text-[11px] font-semibold text-indigo-600 bg-white hover:bg-indigo-50 hover:text-indigo-800 border border-indigo-200/80 rounded-md flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                                title="Mark this notification as read"
                              >
                                <Check size={11} strokeWidth={2.5} />
                                <span>Mark as read</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {!notif.read && (
                          <div className="shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-2" title="Unread" />
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
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
