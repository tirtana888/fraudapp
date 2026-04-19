import React, { useState, useEffect } from 'react';
import { Bell, X, Clock } from 'lucide-react';
import { supabase, COLLECTIONS } from '../services/supabase';
import { Notification } from '../types';

interface NotificationCenterProps {
    companyId: string;
    onNavigate?: (path: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ companyId, onNavigate }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [prevUnreadCount, setPrevUnreadCount] = useState(0);

    // Real-time listener for notifications
    useEffect(() => {
        if (!companyId) return;

        console.log('[NOTIF-CENTER] Setting up listener for company:', companyId);

        const loadNotifs = async () => {
            const { data } = await supabase
                .from(COLLECTIONS.NOTIFICATIONS)
                .select('*')
                .eq('companyId', companyId)
                .order('createdAt', { ascending: false })
                .limit(20);

            const notifs = (data || []) as Notification[];
            let unread = notifs.filter(n => !n.read).length;
            setNotifications(notifs);
            setUnreadCount(unread);
            if (unread > prevUnreadCount && prevUnreadCount > 0) {
                playNotificationSound();
            }
            setPrevUnreadCount(unread);
        };

        loadNotifs();

        const channel = supabase
            .channel('notifs-' + companyId)
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: COLLECTIONS.NOTIFICATIONS, filter: `companyId=eq.${companyId}` }, () => loadNotifs())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [companyId]);

    const playNotificationSound = () => {
        try {
            // Use Web Audio API to generate a pleasant notification sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Create a pleasant "ding" sound
            oscillator.frequency.value = 800; // Frequency in Hz
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (err) {
            console.log('[NOTIF-CENTER] Sound play failed:', err);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await supabase.from(COLLECTIONS.NOTIFICATIONS).update({ read: true }).eq('id', notificationId);
        } catch (error) {
            console.error('[NOTIF-CENTER] Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifs = notifications.filter(n => !n.read);
            await Promise.all(
                unreadNotifs.map(n => n.id && markAsRead(n.id))
            );
        } catch (error) {
            console.error('[NOTIF-CENTER] Error marking all as read:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (notification.id) {
            markAsRead(notification.id);
        }
        setIsOpen(false);
        if (onNavigate && notification.link) {
            onNavigate(notification.link);
        }
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('id-ID');
    };

    return (
        <div className="relative">
            {/* Bell Icon with Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title="Notifications"
            >
                <Bell size={20} className="text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Notification Panel */}
                    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 max-h-[600px] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                Notifications {unreadCount > 0 && `(${unreadCount})`}
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Notification List */}
                        <div className="overflow-y-auto flex-1">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell size={48} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        No notifications yet
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {notifications.map((notif) => (
                                        <button
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${!notif.read ? 'bg-orange-50 dark:bg-orange-900/10' : ''
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="text-2xl flex-shrink-0">{notif.icon}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                            {notif.title}
                                                        </h4>
                                                        {!notif.read && (
                                                            <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1" />
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                                        {notif.message}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-2">
                                                        <Clock size={12} />
                                                        <span>{formatTimestamp(notif.createdAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 border-t border-gray-200 dark:border-slate-700">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (onNavigate) {
                                            onNavigate('/candidates');
                                        }
                                    }}
                                    className="w-full text-center text-sm text-orange-600 hover:text-orange-700 font-medium py-2"
                                >
                                    View all candidates
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;
