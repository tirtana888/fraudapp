import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  MessageSquare,
  Shield,
  UserCheck,
  Mail,
  Upload,
  PlayCircle
} from 'lucide-react';

interface TimelineEvent {
  stage: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  note?: string;
}

interface CandidateActivityTimelineProps {
  timeline?: TimelineEvent[];
  candidateName: string;
}

const CandidateActivityTimeline: React.FC<CandidateActivityTimelineProps> = ({
  timeline = [],
  candidateName
}) => {
  const getEventIcon = (stage: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'applied': <Mail size={16} className="text-brand-blue" />,
      'cv_uploaded': <Upload size={16} className="text-brand-blue" />,
      'screening': <FileText size={16} className="text-brand-orange" />,
      'integrity_assessment': <Shield size={16} className="text-brand-orange" />,
      'assessment_started': <PlayCircle size={16} className="text-brand-orange" />,
      'assessment_completed': <CheckCircle2 size={16} className="text-yellow-600" />,
      'technical_test': <FileText size={16} className="text-purple-600" />,
      'hr_interview': <MessageSquare size={16} className="text-blue-600" />,
      'user_interview': <MessageSquare size={16} className="text-indigo-600" />,
      'interview': <MessageSquare size={16} className="text-brand-orange" />,
      'bc_check': <Shield size={16} className="text-brand-blue" />,
      'background_check': <Shield size={16} className="text-brand-blue" />,
      'bc_completed': <CheckCircle2 size={16} className="text-green-600" />,
      'hired': <UserCheck size={16} className="text-green-600" />,
      'approved': <UserCheck size={16} className="text-green-600" />,
      'rejected': <Circle size={16} className="text-red-600" />
    };
    return iconMap[stage] || <Circle size={16} className="text-gray-400" />;
  };

  const getEventLabel = (stage: string) => {
    const labelMap: { [key: string]: string } = {
      'applied': 'Kandidat Apply',
      'cv_uploaded': 'CV Berhasil Diunggah',
      'screening': 'Tahap Screening',
      'integrity_assessment': 'Integrity Assessment',
      'assessment_started': 'Mulai Mengerjakan Assessment',
      'assessment_completed': 'Need Review',
      'technical_test': 'Tes Teknikal',
      'hr_interview': 'Interview HR',
      'user_interview': 'Interview User',
      'processing': 'Proses Analisis AI',
      'review': 'Dalam Review HR',
      'interview': 'Wawancara Scheduled',
      'bc_check': 'Pemeriksaan Latar Belakang',
      'background_check': 'Background Check Process',
      'bc_completed': 'Background Check Selesai',
      'hired': 'Hire',
      'approved': 'Disetujui',
      'rejected': 'Tolak'
    };
    return labelMap[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventColor = (stage: string, status: string) => {
    if (status === 'completed') {
      return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400';
    }
    if (status === 'current') {
      return 'bg-orange-100 border-orange-300 text-brand-orange dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400';
    }
    return 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-slate-800 dark:border-slate-600 dark:text-gray-400';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sortedTimeline = [...timeline].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-brand-orange" />
          <h3 className="font-bold text-gray-800 dark:text-white">Riwayat Aktivitas</h3>
        </div>
        <div className="text-center py-8">
          <Clock size={48} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Belum ada aktivitas tercatat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-brand-orange" />
        <h3 className="font-bold text-gray-800 dark:text-white">Riwayat Aktivitas Kandidat</h3>
      </div>

      {/* Timeline container with aggressive spacing to prevent overlap */}
      <div className="relative pt-8">
        {/* Vertical line with lower z-index */}
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700 z-0"></div>

        <div className="space-y-6">{/* Timeline items */}
          {sortedTimeline.map((event, index) => (
            <div key={index} className="relative flex gap-4">
              {/* Icon container with solid background to prevent overlap */}
              <div className={`z-20 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 shadow-sm ${event.status === 'completed'
                ? 'bg-green-50 border-green-500 dark:bg-green-900/50 dark:border-green-600'
                : event.status === 'current'
                  ? 'bg-orange-50 border-brand-orange dark:bg-orange-900/50 dark:border-brand-orange'
                  : 'bg-gray-50 border-gray-300 dark:bg-slate-700 dark:border-slate-600'
                }`}>
                {getEventIcon(event.stage)}
              </div>

              <div className="flex-1 pb-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getEventColor(event.stage, event.status)}`}>
                  <span className="font-semibold text-sm">{getEventLabel(event.stage)}</span>
                  {event.status === 'completed' && (
                    <CheckCircle2 size={14} className="text-green-600" />
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Clock size={12} />
                  <span>{formatDate(event.date)}</span>
                </div>

                {event.note && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 rounded-lg p-3 leading-relaxed">
                    {event.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Total Aktivitas: {timeline.length}</span>
          <span>Kandidat: {candidateName}</span>
        </div>
      </div>
    </div>
  );
};

export default CandidateActivityTimeline;
