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
    const iconMap: { [key: string]: JSX.Element } = {
      'applied': <Mail size={16} className="text-blue-600" />,
      'cv_uploaded': <Upload size={16} className="text-cyan-600" />,
      'screening': <FileText size={16} className="text-purple-600" />,
      'assessment_started': <PlayCircle size={16} className="text-yellow-600" />,
      'assessment_completed': <CheckCircle2 size={16} className="text-green-600" />,
      'interview': <MessageSquare size={16} className="text-orange-600" />,
      'bc_check': <Shield size={16} className="text-indigo-600" />,
      'background_check': <Shield size={16} className="text-indigo-600" />,
      'hired': <UserCheck size={16} className="text-emerald-600" />,
      'approved': <UserCheck size={16} className="text-emerald-600" />,
      'rejected': <Circle size={16} className="text-red-600" />
    };
    return iconMap[stage] || <Circle size={16} className="text-gray-400" />;
  };

  const getEventLabel = (stage: string) => {
    const labelMap: { [key: string]: string } = {
      'applied': 'Melamar Posisi',
      'cv_uploaded': 'CV Terupload',
      'screening': 'Tahap Screening',
      'assessment_started': 'Mulai Assessment',
      'assessment_completed': 'Selesai Assessment',
      'processing': 'Proses Analisis AI',
      'review': 'Dalam Review HR',
      'interview': 'Wawancara',
      'bc_check': 'Background Check',
      'background_check': 'Background Check',
      'hired': 'Diterima',
      'approved': 'Diterima',
      'rejected': 'Ditolak'
    };
    return labelMap[stage] || stage;
  };

  const getEventColor = (stage: string, status: string) => {
    if (status === 'completed') {
      return 'bg-green-100 border-green-300 text-green-800';
    }
    if (status === 'current') {
      return 'bg-orange-100 border-orange-300 text-orange-800';
    }
    return 'bg-gray-100 border-gray-300 text-gray-600';
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-gray-600" />
          <h3 className="font-bold text-gray-800">Riwayat Aktivitas</h3>
        </div>
        <div className="text-center py-8">
          <Clock size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Belum ada aktivitas tercatat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={20} className="text-[#D95D00]" />
        <h3 className="font-bold text-gray-800">Riwayat Aktivitas Kandidat</h3>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-4">
          {sortedTimeline.map((event, index) => (
            <div key={index} className="relative flex gap-4">
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                event.status === 'completed'
                  ? 'bg-green-50 border-green-500'
                  : event.status === 'current'
                  ? 'bg-orange-50 border-orange-500'
                  : 'bg-gray-50 border-gray-300'
              }`}>
                {getEventIcon(event.stage)}
              </div>

              <div className="flex-1 pb-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getEventColor(event.stage, event.status)}`}>
                  <span className="font-semibold text-sm">{getEventLabel(event.stage)}</span>
                  {event.status === 'completed' && (
                    <CheckCircle2 size={14} className="text-green-600" />
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                  <Clock size={12} />
                  <span>{formatDate(event.date)}</span>
                </div>

                {event.note && (
                  <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                    {event.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Total Aktivitas: {timeline.length}</span>
          <span>Kandidat: {candidateName}</span>
        </div>
      </div>
    </div>
  );
};

export default CandidateActivityTimeline;
