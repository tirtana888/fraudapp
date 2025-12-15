import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Globe, CheckCircle2, Clock3, Mail, User, Filter } from 'lucide-react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../services/firebase';
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
}

const InterviewSchedulePage: React.FC<InterviewSchedulePageProps> = ({ companyId }) => {
    const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
    const [filteredInterviews, setFilteredInterviews] = useState<ScheduledInterview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'today' | 'past'>('upcoming');
    const toast = useToast();

    useEffect(() => {
        if (!companyId) return;

        setIsLoading(true);

        // Real-time listener for interviews
        const q = query(
            collection(db, COLLECTIONS.SESSIONS),
            where('companyId', '==', companyId),
            where('interviewSchedule', '!=', null)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const interviewData: ScheduledInterview[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.interviewSchedule) {
                    // Handle scheduledAt - could be Timestamp or ISO string
                    let scheduledAtDate = new Date();
                    if (data.interviewSchedule.scheduledAt) {
                        if (typeof data.interviewSchedule.scheduledAt.toDate === 'function') {
                            scheduledAtDate = data.interviewSchedule.scheduledAt.toDate();
                        } else if (typeof data.interviewSchedule.scheduledAt === 'string') {
                            scheduledAtDate = new Date(data.interviewSchedule.scheduledAt);
                        }
                    }

                    // Handle confirmedAt - could be Timestamp or ISO string
                    let confirmedAtDate = undefined;
                    if (data.interviewSchedule.confirmedAt) {
                        if (typeof data.interviewSchedule.confirmedAt.toDate === 'function') {
                            confirmedAtDate = data.interviewSchedule.confirmedAt.toDate();
                        } else if (typeof data.interviewSchedule.confirmedAt === 'string') {
                            confirmedAtDate = new Date(data.interviewSchedule.confirmedAt);
                        }
                    }

                    interviewData.push({
                        sessionId: doc.id,
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
        }, (error) => {
            console.error('Error fetching interviews:', error);
            toast.error('Gagal memuat jadwal wawancara');
            setIsLoading(false);
        });

        return () => unsubscribe();
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Memuat jadwal wawancara...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Calendar className="text-brand-orange" size={28} />
                            Jadwal Wawancara
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Kelola dan pantau semua jadwal wawancara kandidat
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                        >
                            <option value="all">Semua</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="today">Hari Ini</option>
                            <option value="past">Selesai</option>
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {interviews.length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Jadwal</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {interviews.filter(i => i.confirmationStatus === 'confirmed').length}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">Confirmed</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                            {interviews.filter(i => i.confirmationStatus === 'pending').length}
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">Pending</div>
                    </div>
                </div>
            </div>

            {/* Interview List */}
            {filteredInterviews.length === 0 ? (
                <div className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
                    <Calendar size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Tidak ada jadwal wawancara
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {filter === 'upcoming' && 'Belum ada wawancara yang dijadwalkan untuk masa depan'}
                        {filter === 'today' && 'Tidak ada wawancara yang dijadwalkan hari ini'}
                        {filter === 'past' && 'Belum ada wawancara yang selesai'}
                        {filter === 'all' && 'Jadwalkan wawancara dari detail kandidat'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredInterviews.map((interview) => (
                        <div
                            key={interview.sessionId}
                            className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    {/* Candidate Info */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-brand-orange/10 rounded-full flex items-center justify-center">
                                            <User size={20} className="text-brand-orange" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {interview.candidateName}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {interview.jobTitle}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Interview Details */}
                                    <div className="grid grid-cols-2 gap-4 ml-13">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar size={16} className="text-gray-400" />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {formatDate(interview.interviewDate)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock size={16} className="text-gray-400" />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {interview.interviewTime} WIB
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm col-span-2">
                                            {interview.interviewType === 'online' ? (
                                                <>
                                                    <Globe size={16} className="text-gray-400" />
                                                    <a
                                                        href={interview.location}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-brand-orange hover:underline truncate"
                                                    >
                                                        {interview.location}
                                                    </a>
                                                </>
                                            ) : (
                                                <>
                                                    <MapPin size={16} className="text-gray-400" />
                                                    <span className="text-gray-700 dark:text-gray-300 truncate">
                                                        {interview.location}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail size={16} className="text-gray-400" />
                                            <span className="text-gray-500 dark:text-gray-400 truncate">
                                                {interview.candidateEmail}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="ml-4">
                                    {getStatusBadge(interview.confirmationStatus)}
                                    {interview.confirmedAt && (
                                        <p className="text-xs text-gray-400 mt-2 text-right">
                                            Confirmed {interview.confirmedAt.toLocaleDateString('id-ID')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InterviewSchedulePage;
