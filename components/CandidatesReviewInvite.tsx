import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Users, FileText, Phone, Mail, MapPin, Calendar, Filter, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Video, Shield, AlertCircle, Clock, UserPlus, Briefcase } from 'lucide-react';
import { InterviewSession, Job } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface CandidatesReviewInviteProps {
  companyId: string;
  onViewSession: (sessionId: string) => void;
}

interface ApplicationWithDetails extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  applicationStatus?: string;
  appliedAt?: string;
  applicationId?: string;
  recruitmentStage?: string;
  timeline?: TimelineItem[];
}

interface TimelineItem {
  stage: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  note?: string;
}

const CandidatesReviewInvite: React.FC<CandidatesReviewInviteProps> = ({ companyId, onViewSession }) => {
  const toast = useToast();
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[CANDIDATES-REVIEW] Loading data for company:', companyId);

      const jobsQuery = query(
        collection(db, COLLECTIONS.JOBS),
        where('companyId', '==', companyId)
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsData = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Job));
      setJobs(jobsData);
      console.log('[CANDIDATES-REVIEW] Loaded jobs:', jobsData.length);

      const sessionsQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId),
        where('source', '==', 'job_application'),
        where('status', '==', 'pending_review')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      console.log('[CANDIDATES-REVIEW] Found sessions (pending_review):', sessionsSnapshot.docs.length);

      const applicationsWithDetails: ApplicationWithDetails[] = await Promise.all(
        sessionsSnapshot.docs.map(async (docSnap) => {
          const sessionData = { id: docSnap.id, ...docSnap.data() } as any;
          console.log('[CANDIDATES-REVIEW] Processing session:', docSnap.id, sessionData);

          let jobTitle = 'Unknown Position';
          let jobLocation = 'Unknown Location';
          let applicationStatus = 'Pending';
          let appliedAt = sessionData.date;
          let recruitmentStage = sessionData.recruitmentStage || 'application';
          let timeline = sessionData.timeline || [];

          if (sessionData.jobId) {
            const jobDoc = await getDoc(doc(db, COLLECTIONS.JOBS, sessionData.jobId));
            if (jobDoc.exists()) {
              const job = jobDoc.data();
              jobTitle = job.title;
              jobLocation = job.location;
            }
          }

          if (sessionData.applicationId) {
            const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, sessionData.applicationId));
            if (appDoc.exists()) {
              const app = appDoc.data();
              applicationStatus = app.status;
              appliedAt = app.appliedAt || sessionData.date;
            }
          }

          return {
            ...sessionData,
            jobTitle,
            jobLocation,
            applicationStatus,
            appliedAt,
            recruitmentStage,
            timeline
          } as ApplicationWithDetails;
        })
      );

      applicationsWithDetails.sort((a, b) =>
        new Date(b.appliedAt || b.date).getTime() - new Date(a.appliedAt || a.date).getTime()
      );

      setApplications(applicationsWithDetails);
      console.log('[JOB-APPLICATIONS] ✅ Total applications loaded:', applicationsWithDetails.length);
      console.log('[JOB-APPLICATIONS] Applications:', applicationsWithDetails);
    } catch (error) {
      console.error('[JOB-APPLICATIONS] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecruitmentStage = async (sessionId: string, applicationId: string | undefined, stage: string, note?: string) => {
    try {
      setUpdatingStatus(sessionId);

      const newTimelineItem: TimelineItem = {
        stage,
        status: 'completed',
        date: new Date().toISOString(),
        note
      };

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (sessionSnap.exists()) {
        const currentTimeline = sessionSnap.data().timeline || [];
        await updateDoc(sessionRef, {
          recruitmentStage: stage,
          timeline: [...currentTimeline, newTimelineItem]
        });
      }

      if (applicationId) {
        const appRef = doc(db, COLLECTIONS.APPLICATIONS, applicationId);
        await updateDoc(appRef, {
          status: stage === 'rejected' ? 'Rejected' : 'In Progress',
          lastUpdated: new Date().toISOString()
        });
      }

      await loadData();
    } catch (error) {
      console.error('[JOB-APPLICATIONS] Error updating stage:', error);
      toast.error('Gagal update status. Silakan coba lagi.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (selectedJob !== 'all' && app.jobId !== selectedJob) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'rejected' && app.recruitmentStage !== 'rejected') return false;
      if (statusFilter === 'active' && app.recruitmentStage === 'rejected') return false;
    }
    return true;
  });

  const getStageInfo = (stage?: string) => {
    switch (stage) {
      case 'application':
        return { label: 'Aplikasi Masuk', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FileText size={14} /> };
      case 'integrity_test':
        return { label: 'Test Integritas', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Shield size={14} /> };
      case 'interview_office':
        return { label: 'Interview Office', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Video size={14} /> };
      case 'kyc':
        return { label: 'KYC Process', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: <CheckCircle2 size={14} /> };
      case 'approved':
        return { label: 'Disetujui', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 size={14} /> };
      case 'rejected':
        return { label: 'Ditolak', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={14} /> };
      default:
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} /> };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D95D00]/10 rounded-xl">
              <ClipboardCheck className="text-[#D95D00]" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Review & Invite</h2>
              <p className="text-sm text-gray-500">Review CV kandidat dari portal (Instant OFF) dan undang untuk test</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="bg-[#D95D00]/10 border border-[#D95D00]/20 rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[#D95D00]" />
                <span className="font-bold text-[#D95D00]">{filteredApplications.length}</span>
                <span className="text-sm text-gray-600">Aplikasi</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filter:</span>
          </div>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Posisi ({applications.length})</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({applications.filter(a => a.jobId === job.id).length})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Briefcase size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Belum Ada Aplikasi</h3>
            <p className="text-gray-500">Aplikasi dari kandidat akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => {
              const stageInfo = getStageInfo(app.recruitmentStage);
              const isExpanded = expandedApp === app.id;
              const isUpdating = updatingStatus === app.id;

              return (
                <div
                  key={app.id}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-all hover:border-[#D95D00]/30"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-800">{app.candidate.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${stageInfo.color}`}>
                            {stageInfo.icon}
                            {stageInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={16} className="text-[#D95D00]" />
                            <span className="font-medium">{app.jobTitle}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={16} className="text-gray-400" />
                            <span>{app.jobLocation}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={16} className="text-gray-400" />
                            <span>{new Date(app.appliedAt || app.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Mail size={16} className="text-gray-400" />
                            <a href={`mailto:${app.candidate.email}`} className="hover:text-[#D95D00] transition-colors">
                              {app.candidate.email}
                            </a>
                          </div>
                          {app.whatsapp && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Phone size={16} className="text-gray-400" />
                              <a href={`https://wa.me/${app.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#D95D00] transition-colors">
                                {app.whatsapp}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {app.recruitmentStage !== 'rejected' && app.recruitmentStage !== 'integrity_test' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'integrity_test', 'Kandidat diminta mengikuti test integritas')}
                          disabled={isUpdating}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Shield size={16} />
                          Lanjut Test Integritas
                        </button>
                      )}

                      {app.recruitmentStage === 'integrity_test' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'interview_office', 'Kandidat diundang untuk interview office')}
                          disabled={isUpdating}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Video size={16} />
                          Interview Office
                        </button>
                      )}

                      {app.recruitmentStage === 'interview_office' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'kyc', 'Proses KYC dimulai')}
                          disabled={isUpdating}
                          className="flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 transition-colors text-sm font-medium border border-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 size={16} />
                          Proses KYC
                        </button>
                      )}

                      {app.recruitmentStage === 'kyc' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'approved', 'Kandidat disetujui dan siap bergabung')}
                          disabled={isUpdating}
                          className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 size={16} />
                          Setujui Kandidat
                        </button>
                      )}

                      {app.recruitmentStage !== 'rejected' && app.recruitmentStage !== 'approved' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'rejected', 'Kandidat ditolak')}
                          disabled={isUpdating}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle size={16} />
                          Tolak
                        </button>
                      )}

                      {app.cvUrl && (
                        <button
                          onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200 ml-auto"
                        >
                          <FileText size={16} />
                          {isExpanded ? 'Tutup CV' : 'Lihat CV'}
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>

                    {app.timeline && app.timeline.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Timeline Rekrutmen</h4>
                        <div className="space-y-2">
                          {app.timeline.map((item, idx) => {
                            const itemStageInfo = getStageInfo(item.stage);
                            return (
                              <div key={idx} className="flex items-start gap-3 text-sm">
                                <div className={`mt-0.5 p-1.5 rounded-full ${itemStageInfo.color.split(' ')[0]}`}>
                                  {itemStageInfo.icon}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-800">{itemStageInfo.label}</div>
                                  {item.note && <div className="text-gray-600 text-xs mt-0.5">{item.note}</div>}
                                  {item.date && (
                                    <div className="text-gray-400 text-xs mt-0.5">
                                      {new Date(item.date).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {isExpanded && app.cvUrl && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="bg-white rounded-lg overflow-hidden" style={{ height: '600px' }}>
                        {app.cvUrl.endsWith('.pdf') ? (
                          <iframe
                            src={app.cvUrl}
                            className="w-full h-full"
                            title={`CV ${app.candidate.name}`}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 mb-4">Preview tidak tersedia untuk format file ini</p>
                              <a
                                href={app.cvUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <FileText size={16} />
                                Buka CV di Tab Baru
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#D95D00]/10 to-[#F18F01]/10 border border-[#D95D00]/20 rounded-xl p-6">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Users size={20} className="text-[#D95D00]" />
          Alur Rekrutmen
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-700 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
            <FileText size={14} />
            <span className="font-medium">Aplikasi</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
            <Shield size={14} />
            <span className="font-medium">Test Integritas</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
            <Video size={14} />
            <span className="font-medium">Interview</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-full border border-cyan-200">
            <CheckCircle2 size={14} />
            <span className="font-medium">KYC</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
            <CheckCircle2 size={14} />
            <span className="font-medium">Approved</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidatesReviewInvite;
