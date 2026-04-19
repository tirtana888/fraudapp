import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Globe, CheckCircle2, Clock3, Mail, User, Filter, Copy, Loader2 } from 'lucide-react';
import { supabase, COLLECTIONS } from '../services/supabase';
import { useToast } from './Toast';

interface ScheduledInterview {
    sessionId: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    interviewType: 'online' | 'offline';
    location: string;
    scheduledAt: Date;
    confirmationStatus: 'pending' | 'confirmed';
    confirmedAt?: Date;
    companyId: string;
}

interface InterviewSchedulePageProps {
    companyId: string;
    onViewCandidate?: (sessionId: string) => void;
}

const InterviewSchedulePage: React.FC<InterviewSchedulePageProps> = ({ companyId, onViewCandidate }) => {
    const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
    const [filteredInterviews, setFilteredInterviews] = useState<ScheduledInterview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'today' | 'past'>('upcoming');
    const toast = useToast();

    useEffect(() => {
        if (!companyId) return;

        setIsLoading(true);

        const loadInterviews = async () => {
            const { data: sessionsData } = await supabase
                .from(COLLECTIONS.SESSIONS)
                .select('*')
                .eq('companyId', companyId)
                .not('interviewSchedule', 'is', null);

            const interviewData: ScheduledInterview[] = [];

            (sessionsData || []).forEach((data: any) => {
                if (data.interviewSchedule) {
                    const scheduledAtDate = data.interviewSchedule.scheduledAt
                        ? new Date(data.interviewSchedule.scheduledAt)
                        : new Date();
                    const confirmedAtDate = data.interviewSchedule.confirmedAt
                        ? new Date(data.interviewSchedule.confirmedAt)
                        : undefined;

                    interviewData.push({
                        sessionId: data.id,
                        candidateName: data.candidate?.name || 'Unknown',
                        candidateEmail: data.candidate?.email || '',
                        jobTitle: data.jobTitle || data.candidate?.role || 'Position not specified',
                        interviewDate: data.interviewSchedule.date,
                        interviewTime: data.interviewSchedule.time,
                        interviewType: data.interviewSchedule.type,
                        location: data.interviewSchedule.link || data.interviewSchedule.location || '',
                        scheduledAt: scheduledAtDate,
                        confirmationStatus: data.interviewSchedule.confirmationStatus || 'pending',
                        confirmedAt: confirmedAtDate,
                        companyId: data.companyId
                    });
                }
            });

            // Sort by interview date (newest first)
            interviewData.sort((a, b) => {
                const dateA = new Date(`${a.interviewDate} ${a.interviewTime}`);
                const dateB = new Date(`${b.interviewDate} ${b.interviewTime}`);
                return dateB.getTime() - dateA.getTime();
            });

            setInterviews(interviewData);
            setIsLoading(false);
        };

        loadInterviews();

        const channel = supabase
            .channel('interviews-' + companyId)
            .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.SESSIONS, filter: `companyId=eq.${companyId}` }, () => loadInterviews())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [companyId]);

    useEffect(() => {
        // Apply filter
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let filtered = interviews;

        switch (filter) {
            case 'upcoming':
                filtered = interviews.filter(interview => {
                    const interviewDate = new Date(`${interview.interviewDate} ${interview.interviewTime}`);
                    return interviewDate >= now;
                });
                break;
            case 'today':
                filtered = interviews.filter(interview => {
                    const interviewDate = new Date(interview.interviewDate);
                    return interviewDate.toDateString() === today.toDateString();
                });
                break;
            case 'past':
                filtered = interviews.filter(interview => {
                    const interviewDate = new Date(`${interview.interviewDate} ${interview.interviewTime}`);
                    return interviewDate < now;
                });
                break;
            default:
                filtered = interviews;
        }

        setFilteredInterviews(filtered);
    }, [interviews, filter]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusBadge = (status: 'pending' | 'confirmed') => {
        if (status === 'confirmed') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-full text-xs font-semibold">
                    <CheckCircle2 size={14} />
                    Confirmed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded-full text-xs font-semibold">
                <Clock3 size={14} />
                Pending
            </span>
        );
    };

    // Helper to group interviews
    const groupInterviews = (interviews: ScheduledInterview[]) => {
        const groups: { [key: string]: ScheduledInterview[] } = {};

        interviews.forEach(interview => {
            const date = new Date(interview.interviewDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            let groupKey = 'Lainnya';
            if (date.toDateString() === today.toDateString()) groupKey = 'Hari Ini';
            else if (date.toDateString() === tomorrow.toDateString()) groupKey = 'Besok';
            else if (date < today) groupKey = 'Selesai';
            else groupKey = 'Akan Datang';

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(interview);
        });

        // Sort keys logic
        const orderedKeys = ['Hari Ini', 'Besok', 'Akan Datang', 'Selesai'];
        return orderedKeys.filter(key => groups[key] && groups[key].length > 0).map(key => ({
            title: key,
            items: groups[key]
        }));
    };

    const groupedInterviews = groupInterviews(filteredInterviews);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Link meeting berhasil disalin!');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center">
                    <Loader2 className="animate-spin h-10 w-10 text-brand-orange mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Memuat jadwal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Calendar className="text-brand-orange" size={32} />
                        Jadwal Wawancara
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                        Kelola agenda interview dan pantau konfirmasi kandidat.
                    </p>
                </div>

                {/* Stats Cards - Compact */}
                <div className="flex gap-3">
                    <div className="bg-white dark:bg-slate-800 px-5 py-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col items-center min-w-[100px]">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{interviews.length}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">Total</span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/10 px-5 py-3 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col items-center min-w-[100px]">
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {interviews.filter(i => i.confirmationStatus === 'confirmed').length}
                        </span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-green-600 dark:text-green-400">Fixed</span>
                    </div>
                </div>
            </div>

            {/* Smart Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
                <nav className="flex space-x-8" aria-label="Tabs">
                    {[
                        { id: 'upcoming', label: 'Akan Datang' },
                        { id: 'today', label: 'Hari Ini', count: interviews.filter(i => new Date(i.interviewDate).toDateString() === new Date().toDateString()).length },
                        { id: 'past', label: 'Riwayat' },
                        { id: 'all', label: 'Semua' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as any)}
                            className={`
                                relative py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200
                                ${filter === tab.id
                                    ? 'border-brand-orange text-brand-orange'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }
                            `}
                        >
                            <span className="flex items-center gap-2">
                                {tab.label}
                                {tab.count && tab.count > 0 && (
                                    <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 py-0.5 px-2 rounded-full text-xs font-bold">
                                        {tab.count}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            {groupedInterviews.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                    <div className="bg-white dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                        <Calendar className="text-gray-300 dark:text-gray-600" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Tidak ada jadwal</h3>
                    <p className="text-gray-500 dark:text-gray-400">Belum ada sesi wawancara untuk filter ini.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {groupedInterviews.map((group) => (
                        <div key={group.title}>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 pl-1">
                                {group.title}
                            </h2>
                            <div className="space-y-4">
                                {group.items.map((interview) => (
                                    <div
                                        key={interview.sessionId}
                                        className="group bg-white dark:bg-brand-slate-850 rounded-2xl border border-gray-200 dark:border-slate-700 p-0 hover:shadow-lg hover:border-brand-orange/30 transition-all duration-300 dark:hover:border-slate-600 overflow-hidden"
                                    >
                                        <div className="flex flex-col md:flex-row">
                                            {/* Left: Date Block */}
                                            <div className="md:w-32 bg-gray-50 dark:bg-slate-800/80 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 group-hover:bg-brand-orange/5 dark:group-hover:bg-brand-orange/10 transition-colors">
                                                <span className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                                                    {new Date(interview.interviewDate).toLocaleDateString('id-ID', { month: 'short' })}
                                                </span>
                                                <span className="text-3xl font-bold text-gray-900 dark:text-white my-1">
                                                    {new Date(interview.interviewDate).getDate()}
                                                </span>
                                                <div className="flex items-center gap-1 text-sm font-semibold text-brand-orange">
                                                    <Clock size={14} />
                                                    {interview.interviewTime}
                                                </div>
                                            </div>

                                            {/* Middle: Info */}
                                            <div className="flex-1 p-6 flex flex-col justify-center">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-4">
                                                        {/* Avatar */}
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                            {getInitials(interview.candidateName)}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-brand-orange transition-colors">
                                                                {interview.candidateName}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-medium">
                                                                    {interview.jobTitle}
                                                                </span>
                                                                {interview.interviewType === 'online' && (
                                                                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded font-medium">
                                                                        <Globe size={12} /> Online
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge (Desktop) */}
                                                    <div className="hidden md:block">
                                                        {getStatusBadge(interview.confirmationStatus)}
                                                    </div>
                                                </div>

                                                {/* Location / Link */}
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg max-w-[80%]">
                                                        {interview.interviewType === 'online' ? (
                                                            <Globe size={14} className="text-blue-500" />
                                                        ) : (
                                                            <MapPin size={14} className="text-red-500" />
                                                        )}
                                                        <span className="truncate flex-1 font-medium">
                                                            {interview.location || 'Lokasi belum diatur'}
                                                        </span>
                                                        {interview.interviewType === 'online' && interview.location && (
                                                            <button
                                                                onClick={() => copyToClipboard(interview.location)}
                                                                className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                                                title="Copy Link"
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="p-6 md:w-48 border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-700 flex flex-row md:flex-col items-center justify-center gap-3 bg-gray-50/50 dark:bg-slate-800/30">
                                                {interview.interviewType === 'online' && interview.location ? (
                                                    <a
                                                        href={interview.location}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full text-center py-2 px-4 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg text-sm font-semibold shadow-sm shadow-orange-200 dark:shadow-none transition-all hover:scale-[1.02]"
                                                    >
                                                        Join Meeting
                                                    </a>
                                                ) : (
                                                    <button
                                                        onClick={() => onViewCandidate?.(interview.sessionId)}
                                                        className="w-full py-2 px-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                                                    >
                                                        Lihat Detail
                                                    </button>
                                                )}

                                                {interview.interviewType === 'online' && interview.location && (
                                                    <button
                                                        onClick={() => onViewCandidate?.(interview.sessionId)}
                                                        className="w-full py-2 px-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 group/btn"
                                                    >
                                                        <User size={14} className="text-gray-500 group-hover/btn:text-brand-orange transition-colors" />
                                                        Profile
                                                    </button>
                                                )}

                                                <button className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
                                                    Reschedule
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InterviewSchedulePage;
