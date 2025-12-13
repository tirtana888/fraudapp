import React from 'react';
import { CheckCircle2, XCircle, Clock, Shield, Calendar } from 'lucide-react';

interface BackgroundCheckHeroProps {
    status: 'approved' | 'declined' | 'pending' | 'in_progress';
    decision?: string;
    verifiedAt?: string;
    candidateName?: string;
}

const BackgroundCheckHero: React.FC<BackgroundCheckHeroProps> = ({
    status,
    decision,
    verifiedAt,
    candidateName
}) => {
    const statusConfig = {
        approved: {
            bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
            icon: <CheckCircle2 size={48} className="text-white" />,
            title: 'Verifikasi Berhasil',
            subtitle: 'Identitas kandidat telah diverifikasi dan aman',
            badge: 'APPROVED'
        },
        declined: {
            bg: 'bg-gradient-to-r from-red-500 to-rose-600',
            icon: <XCircle size={48} className="text-white" />,
            title: 'Verifikasi Ditolak',
            subtitle: 'Ditemukan masalah dengan identitas kandidat',
            badge: 'DECLINED'
        },
        pending: {
            bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
            icon: <Clock size={48} className="text-white" />,
            title: 'Menunggu Verifikasi',
            subtitle: 'Kandidat belum menyelesaikan verifikasi KYC',
            badge: 'PENDING'
        },
        in_progress: {
            bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
            icon: <Clock size={48} className="text-white animate-pulse" />,
            title: 'Sedang Diproses',
            subtitle: 'Verifikasi sedang berjalan',
            badge: 'IN PROGRESS'
        }
    };

    const config = statusConfig[status] || statusConfig.pending;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={`${config.bg} rounded-2xl shadow-xl overflow-hidden`}>
            {/* Decorative Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Icon */}
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                        {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl md:text-3xl font-bold text-white">
                                {config.title}
                            </h2>
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold text-white uppercase tracking-wider">
                                {config.badge}
                            </span>
                        </div>
                        <p className="text-white/80 text-sm md:text-base mb-3">
                            {decision || config.subtitle}
                        </p>

                        {/* Meta Info */}
                        <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
                            {candidateName && (
                                <div className="flex items-center gap-2">
                                    <Shield size={14} />
                                    <span>{candidateName}</span>
                                </div>
                            )}
                            {verifiedAt && (
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} />
                                    <span>Verified: {formatDate(verifiedAt)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trust Badge */}
                    <div className="hidden md:flex flex-col items-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                        <Shield size={32} className="text-white mb-2" />
                        <span className="text-xs text-white/80 font-medium">Didit KYC</span>
                        <span className="text-[10px] text-white/60">Verified</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackgroundCheckHero;
